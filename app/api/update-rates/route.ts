import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
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
        next: { revalidate: 0 },
      })
      const xml = await tcmbRes.text()

      // Parse USD ForexSelling
      const usdMatch = xml.match(/<Currency[^>]*Kod="USD"[^>]*>[\s\S]*?<ForexSelling>([\d.,]+)<\/ForexSelling>/)
      if (usdMatch) usd_try = parseFloat(usdMatch[1].replace(',', '.'))

      // Parse EUR ForexSelling
      const eurMatch = xml.match(/<Currency[^>]*Kod="EUR"[^>]*>[\s\S]*?<ForexSelling>([\d.,]+)<\/ForexSelling>/)
      if (eurMatch) eur_try = parseFloat(eurMatch[1].replace(',', '.'))
    } catch (e) {
      console.error('TCMB fetch failed:', e)
    }

    // 2) Gold price (XAU/USD -> gram TRY)
    try {
      const goldRes = await fetch('https://api.gold-api.com/price/XAU', { next: { revalidate: 0 } })
      if (goldRes.ok) {
        const goldData = await goldRes.json()
        const xauUsd = goldData.price || 0
        if (xauUsd > 0 && usd_try > 0) {
          gold_try = (xauUsd * usd_try) / 31.1035 // troy ounce to gram
        }
      }
    } catch (e) {
      console.error('Gold API fetch failed:', e)
    }

    // 3) BTC and ETH from CoinGecko
    try {
      const cryptoRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',
        { next: { revalidate: 0 } }
      )
      if (cryptoRes.ok) {
        const cryptoData = await cryptoRes.json()
        btc_usd = cryptoData.bitcoin?.usd || 0
        eth_usd = cryptoData.ethereum?.usd || 0
      }
    } catch (e) {
      console.error('CoinGecko fetch failed:', e)
    }

    // Validate we got at least USD/TRY
    if (usd_try === 0 && eur_try === 0) {
      return NextResponse.json({ error: 'Kur verisi alinamadi' }, { status: 502 })
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

    // Upsert into exchange_rates (update if today exists, insert otherwise)
    const { error } = await supabase
      .from('exchange_rates')
      .upsert(rates, { onConflict: 'date' })

    if (error) {
      // If upsert with onConflict fails (no unique constraint), try delete+insert
      await supabase.from('exchange_rates').delete().eq('date', today)
      await supabase.from('exchange_rates').insert(rates)
    }

    return NextResponse.json({ success: true, rates })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Bilinmeyen hata' }, { status: 500 })
  }
}
