import { EXPENSE_CATEGORIES } from './categories'

export type ExtractedTransaction = {
  transaction_date: string
  description: string
  category: string
  amount: number
  currency: string
}

const validCategories = new Set(EXPENSE_CATEGORIES.map(c => c.value))
const labelToValue = new Map(EXPENSE_CATEGORIES.map(c => [c.label.toLowerCase(), c.value]))

export function mapCategory(suggested: string): string {
  if (!suggested) return 'diger'
  const lower = suggested.toLowerCase().trim()
  if (validCategories.has(lower)) return lower
  const fromLabel = labelToValue.get(lower)
  if (fromLabel) return fromLabel
  // Keyword matching
  const keywords: Record<string, string> = {
    market: 'market', migros: 'market', bim: 'market', a101: 'market', sok: 'market', carrefour: 'market',
    restoran: 'restoran', kafe: 'restoran', cafe: 'restoran', yemek: 'restoran', restaurant: 'restoran',
    akaryakit: 'yakit', benzin: 'yakit', opet: 'yakit', shell: 'yakit', bp: 'yakit', petrol: 'yakit',
    eczane: 'eczane', ilac: 'eczane', pharmacy: 'eczane',
    hastane: 'saglik', klinik: 'saglik', doktor: 'saglik', hospital: 'saglik',
    giyim: 'giyim', zara: 'giyim', hm: 'giyim', lcw: 'giyim', mavi: 'giyim',
    elektronik: 'elektronik', teknosa: 'elektronik', mediamarkt: 'elektronik', apple: 'elektronik',
    spor: 'spor', gym: 'spor',
    egitim: 'egitim', okul: 'egitim', kurs: 'egitim',
    sigorta: 'sigorta',
    abonelik: 'abonelik', netflix: 'abonelik', spotify: 'abonelik', youtube: 'abonelik',
    taksi: 'taksi', uber: 'taksi',
    otopark: 'otopark', park: 'otopark',
    internet: 'internet',
    telefon: 'telefon',
    elektrik: 'elektrik',
    dogalgaz: 'dogalgaz', dogal: 'dogalgaz',
    su: 'su',
    kira: 'kira',
    aidat: 'aidat',
    kargo: 'kargo',
    hediye: 'hediye',
    kozmetik: 'kozmetik',
  }
  for (const [kw, cat] of Object.entries(keywords)) {
    if (lower.includes(kw)) return cat
  }
  return 'diger'
}

export function buildOcrPrompt(type: 'ekstre' | 'fis'): string {
  const categoryList = EXPENSE_CATEGORIES.map(c => `${c.value} (${c.label})`).join(', ')

  if (type === 'fis') {
    return `Bu bir Turkce fis/makbuz goruntusu. Goruntuden asagidaki bilgileri cikar:
- Isyeri adi (description olarak)
- Toplam tutar (amount)
- Tarih (transaction_date, YYYY-MM-DD formatinda)
- Para birimi (currency, varsayilan TRY)
- Kategori (category)

Kategori icin su degerlerden birini sec: ${categoryList}

Yaniti SADECE su JSON formatinda ver, baska hicbir sey yazma:
{"transactions": [{"transaction_date": "YYYY-MM-DD", "description": "...", "amount": 123.45, "category": "...", "currency": "TRY"}]}`
  }

  return `Bu bir Turkce kredi karti ekstresi goruntusu. Goruntudeki TUM harcama satirlarini cikar.

Her islem icin:
- description: Isyeri/islem aciklamasi
- amount: Tutar (pozitif sayi, virgul yerine nokta kullan)
- transaction_date: Tarih (YYYY-MM-DD formatinda)
- currency: Para birimi (varsayilan TRY)
- category: Kategori

Kategori icin su degerlerden birini sec: ${categoryList}

Eger tarih sadece gun/ay iceriyorsa, yili ekstre doneminden cikar veya mevcut yili kullan.
Odeme, iade veya masraf satirlarini da dahil et.

Yaniti SADECE su JSON formatinda ver, baska hicbir sey yazma:
{"transactions": [{"transaction_date": "YYYY-MM-DD", "description": "...", "amount": 123.45, "category": "...", "currency": "TRY"}]}`
}

export function parseOcrResponse(text: string): ExtractedTransaction[] {
  // Try to extract JSON from the response
  let jsonStr = text.trim()

  // If wrapped in markdown code block, extract it
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim()

  const parsed = JSON.parse(jsonStr)
  const txs: ExtractedTransaction[] = parsed.transactions || []

  return txs.map(tx => ({
    transaction_date: normalizeDate(tx.transaction_date),
    description: String(tx.description || '').trim(),
    category: mapCategory(tx.category),
    amount: Math.abs(typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount).replace(',', '.')) || 0),
    currency: tx.currency || 'TRY',
  })).filter(tx => tx.description && tx.amount > 0)
}

function normalizeDate(d: string): string {
  if (!d) return new Date().toISOString().split('T')[0]
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  // DD/MM/YYYY or DD.MM.YYYY
  const match = d.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  // DD/MM (no year)
  const noYear = d.match(/^(\d{1,2})[./-](\d{1,2})$/)
  if (noYear) {
    const year = new Date().getFullYear()
    return `${year}-${noYear[2].padStart(2, '0')}-${noYear[1].padStart(2, '0')}`
  }
  return new Date().toISOString().split('T')[0]
}
