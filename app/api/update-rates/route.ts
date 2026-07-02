import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Veritabanına yazan ve dış API çağıran bir uç — yalnızca giriş yapmış kullanıcı
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  try {
    let usd_try = 0
    let eur_try = 0
    let gold_try = 0
    let btc_usd = 0
    let eth_usd = 0

    // 1) TCMB XML for USD/TRY and EUR/TRY
    try {
      const tcmbRes = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
      })
      if (!tcmbRes.ok) {
        console.error('TCMB HTTP error:', tcmbRes.status)
      } else {
        const xml = await tcmbRes.text()
        console.log('TCMB XML length:', xml.length)

        const usdMatch = xml.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<ForexSelling>([\d.,]+)<\/ForexSelling>/)
        if (usdMatch) usd_try = parseFloat(usdMatch[1].replace(',', '.'))

        const eurMatch = xml.match(/<Currency[^>]*Kod="EUR"[^>]*>[\s\S]*?<ForexSelling>([\d.,]+)<\/ForexSelling>/)
        if (eurMatch) eur_try = parseFloat(eurMatch[1].replace(',', '.'))

        console.log('TCMB parsed — USD/TRY:', usd_try, 'EUR/TRY:', eur_try)
      }
    } catch (e) {
      console.error('TCMB fetch failed:', e)
    }

    // 2) Gold price (XAU/USD -> gram TRY)
    try {
      const goldRes = await fetch('https://api.gold-api.com/price/XAU', { cache: 'no-store' })
      if (goldRes.ok) {
        const goldData = await goldRes.json()
        const xauUsd = goldData.price || 0
        if (xauUsd > 0 && usd_try > 0) {
          gold_try = (xauUsd * usd_try) / 31.1035
        }
        console.log('Gold XAU/USD:', xauUsd, '-> gram TRY:', gold_try)
      }
    } catch (e) {
      console.error('Gold API fetch failed:', e)
    }

    // 3) BTC, ETH, PEAQ, USDC from CoinGecko
    let peaq_usd = 0
    let usdc_usd = 0
    try {
      const cryptoRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,peaq,usd-coin&vs_currencies=usd',
        { cache: 'no-store' }
      )
      if (cryptoRes.ok) {
        const cryptoData = await cryptoRes.json()
        btc_usd = cryptoData.bitcoin?.usd || 0
        eth_usd = cryptoData.ethereum?.usd || 0
        peaq_usd = cryptoData.peaq?.usd || 0
        usdc_usd = cryptoData['usd-coin']?.usd || 1
        console.log('CoinGecko — BTC:', btc_usd, 'ETH:', eth_usd, 'PEAQ:', peaq_usd, 'USDC:', usdc_usd)
      }
    } catch (e) {
      console.error('CoinGecko fetch failed:', e)
    }

    // 4) BIST TNZTP price from Yahoo Finance
    let tnztpPrice = 0
    try {
      const tnztpRes = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/TNZTP.IS?interval=1d&range=1d',
        { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
      )
      if (tnztpRes.ok) {
        const tnztpData = await tnztpRes.json()
        tnztpPrice = tnztpData?.chart?.result?.[0]?.meta?.regularMarketPrice || 0
        console.log('Yahoo TNZTP price:', tnztpPrice)
      }
    } catch (e) {
      console.error('Yahoo TNZTP fetch failed:', e)
    }

    // 5) GTA (Garanti Portföy Altın Fonu) price from TEFAS
    let gtaPrice = 0
    try {
      const tefasRes = await fetch('https://www.tefas.gov.tr/api/DB/BindHistoryInfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
        body: `fontip=YAT&fonkod=GTA&baession=&fession=&fontupipi=&session=`,
        cache: 'no-store',
      })
      if (tefasRes.ok) {
        const tefasData = await tefasRes.json()
        if (tefasData?.data?.length > 0) {
          gtaPrice = tefasData.data[0]?.ToplamDeger || tefasData.data[0]?.BirimPayDeger || 0
          console.log('TEFAS GTA price:', gtaPrice)
        }
      }
    } catch (e) {
      console.error('TEFAS GTA fetch failed:', e)
    }

    // Validate we got at least one rate
    if (usd_try === 0 && eur_try === 0) {
      console.error('No rates fetched from any source')
      return NextResponse.json({ error: 'Kur verisi alinamadi — TCMB erisim hatasi' }, { status: 502 })
    }

    const today = new Date().toISOString().split('T')[0]

    const rates = {
      date: today,
      usd_try: Math.round(usd_try * 10000) / 10000,
      eur_try: Math.round(eur_try * 10000) / 10000,
      gold_try: Math.round(gold_try * 100) / 100,
      btc_usd: Math.round(btc_usd * 100) / 100,
      eth_usd: Math.round(eth_usd * 100) / 100,
    }

    console.log('Saving rates to supabase:', rates)

    // Try delete + insert (most reliable approach)
    const { error: delError } = await supabase.from('exchange_rates').delete().eq('date', today)
    if (delError) console.log('Delete (expected if no row):', delError.message)

    const { data: inserted, error: insError } = await supabase.from('exchange_rates').insert(rates).select()

    if (insError) {
      console.error('Supabase insert FAILED:', insError)
      return NextResponse.json({ error: 'DB kayit hatasi: ' + insError.message, rates }, { status: 500 })
    }

    console.log('Supabase insert SUCCESS:', inserted)

    // Auto-update all investment snapshots
    const { data: allInvestments } = await supabase
      .from('investments').select('id, name, symbol, quantity, currency, type')
      .eq('is_active', true)

    const priceMap: Record<string, { price: number; currency: string }> = {}
    if (tnztpPrice > 0) priceMap['TNZTP'] = { price: tnztpPrice, currency: 'TRY' }
    if (btc_usd > 0) priceMap['BTC'] = { price: btc_usd, currency: 'USD' }
    if (usdc_usd > 0) priceMap['USDC'] = { price: usdc_usd, currency: 'USD' }
    if (peaq_usd > 0) priceMap['PEAQ'] = { price: peaq_usd, currency: 'USD' }
    if (gtaPrice > 0) priceMap['GTA'] = { price: gtaPrice, currency: 'TRY' }

    // Name-to-key mapping for investments without proper symbol
    const nameMap: Record<string, string> = {
      'bitcoin': 'BTC', 'btc': 'BTC',
      'usdc': 'USDC', 'usd coin': 'USDC',
      'peaq': 'PEAQ',
      'ethereum': 'ETH', 'eth': 'ETH',
      'tnztp': 'TNZTP', 'tapdi': 'TNZTP', 'tinaztepe': 'TNZTP',
    }

    const updatedSnapshots: string[] = []
    for (const inv of (allInvestments || [])) {
      const symbol = (inv.symbol || '').toUpperCase()
      const nameLower = (inv.name || '').toLowerCase()
      // Match by symbol, name, or partial match for fund codes
      const match = priceMap[symbol]
        || priceMap[nameMap[symbol.toLowerCase()] || '']
        || priceMap[nameMap[nameLower] || '']
        || (nameLower.includes('gta') || symbol.includes('GTA') ? priceMap['GTA'] : null)
      if (!match) continue

      const totalValue = inv.quantity * match.price
      let totalValueTry = totalValue
      if (match.currency === 'USD' && usd_try > 0) totalValueTry = totalValue * usd_try
      else if (match.currency === 'EUR' && eur_try > 0) totalValueTry = totalValue * eur_try

      await supabase.from('investment_snapshots').delete()
        .eq('investment_id', inv.id).eq('snapshot_date', today)

      await supabase.from('investment_snapshots').insert({
        investment_id: inv.id,
        snapshot_date: today,
        price: Math.round(match.price * 1000000) / 1000000,
        total_value: Math.round(totalValue * 100) / 100,
        total_value_try: Math.round(totalValueTry * 100) / 100,
      })
      updatedSnapshots.push(`${symbol}: ${match.price}`)
      console.log(`${symbol} snapshot updated — price: ${match.price}, total: ${totalValue}, TRY: ${totalValueTry}`)
    }

    return NextResponse.json({ success: true, rates, saved: inserted, snapshots: updatedSnapshots })
  } catch (e: any) {
    console.error('Unhandled error:', e)
    return NextResponse.json({ error: e.message || 'Bilinmeyen hata' }, { status: 500 })
  }
}
