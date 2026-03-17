export const EXPENSE_CATEGORIES = [
  // Konut
  { value: 'kira', label: 'Kira', group: 'Konut', icon: '🏠' },
  { value: 'aidat', label: 'Aidat', group: 'Konut', icon: '🏢' },
  { value: 'elektrik', label: 'Elektrik', group: 'Konut', icon: '⚡' },
  { value: 'dogalgaz', label: 'Doğalgaz', group: 'Konut', icon: '🔥' },
  { value: 'su', label: 'Su', group: 'Konut', icon: '💧' },
  { value: 'internet', label: 'İnternet', group: 'Konut', icon: '📡' },
  // Ulaşım
  { value: 'yakit', label: 'Yakıt', group: 'Ulaşım', icon: '⛽' },
  { value: 'arac_bakim', label: 'Araç Bakım', group: 'Ulaşım', icon: '🔧' },
  { value: 'arac_sigorta', label: 'Araç Sigorta', group: 'Ulaşım', icon: '🛡' },
  { value: 'toplu_tasima', label: 'Toplu Taşıma', group: 'Ulaşım', icon: '🚌' },
  // Kişisel
  { value: 'market', label: 'Market', group: 'Kişisel', icon: '🛒' },
  { value: 'restoran', label: 'Restoran/Kafe', group: 'Kişisel', icon: '🍽' },
  { value: 'saglik', label: 'Sağlık', group: 'Kişisel', icon: '🏥' },
  { value: 'giyim', label: 'Giyim', group: 'Kişisel', icon: '👕' },
  { value: 'kozmetik', label: 'Kozmetik/Bakım', group: 'Kişisel', icon: '💄' },
  { value: 'spor', label: 'Spor', group: 'Kişisel', icon: '💪' },
  { value: 'egitim', label: 'Eğitim', group: 'Kişisel', icon: '📚' },
  { value: 'eglence', label: 'Eğlence', group: 'Kişisel', icon: '🎬' },
  { value: 'seyahat', label: 'Seyahat/Tatil', group: 'Kişisel', icon: '✈️' },
  { value: 'elektronik', label: 'Elektronik', group: 'Kişisel', icon: '📱' },
  // İş
  { value: 'personel', label: 'Personel', group: 'İş', icon: '👤' },
  { value: 'sgk', label: 'SGK', group: 'İş', icon: '🏛' },
  { value: 'vergi', label: 'Vergi', group: 'İş', icon: '📋' },
  { value: 'muhasebe', label: 'Muhasebe', group: 'İş', icon: '📊' },
  { value: 'ofis', label: 'Ofis Gideri', group: 'İş', icon: '🏭' },
  // Finans
  { value: 'kredi_odeme', label: 'Kredi Ödemesi', group: 'Finans', icon: '🏦' },
  { value: 'kk_odeme', label: 'KK Ödemesi', group: 'Finans', icon: '💳' },
  { value: 'sigorta', label: 'Sigorta', group: 'Finans', icon: '🛡' },
  { value: 'yatirim', label: 'Yatırım', group: 'Finans', icon: '📈' },
  // Diğer
  { value: 'hediye', label: 'Hediye', group: 'Diğer', icon: '🎁' },
  { value: 'bagis', label: 'Bağış', group: 'Diğer', icon: '🤲' },
  { value: 'diger', label: 'Diğer', group: 'Diğer', icon: '📦' },
]

export const CATEGORY_GROUPS = Array.from(new Set(EXPENSE_CATEGORIES.map(c => c.group)))
