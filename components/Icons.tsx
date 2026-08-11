// Modern stroke-based SVG icons - no emoji, clean lines
type IconProps = { size?: number; color?: string; strokeWidth?: number }

const d = { size: 20, color: '#8790a5', strokeWidth: 1.6 }

function I({ size = d.size, color = d.color, strokeWidth = d.strokeWidth, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

// Navigation
export function IconHome(p: IconProps) { return <I {...p}><path d="M3 9.5L12 3l9 6.5V20a1.5 1.5 0 01-1.5 1.5h-3a1 1 0 01-1-1v-4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4a1 1 0 01-1 1h-3A1.5 1.5 0 013 20V9.5z" /></I> }
export function IconBank(p: IconProps) { return <I {...p}><path d="M3 21h18" /><path d="M3 10h18" /><path d="M12 3l9 7H3z" /><path d="M5 10v8" /><path d="M9 10v8" /><path d="M15 10v8" /><path d="M19 10v8" /></I> }
export function IconCreditCard(p: IconProps) { return <I {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></I> }
export function IconCalendar(p: IconProps) { return <I {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></I> }
export function IconArrowsExchange(p: IconProps) { return <I {...p}><path d="M7 10l-3 3 3 3" /><path d="M4 13h16" /><path d="M17 14l3-3-3-3" /><path d="M20 11H4" /></I> }
export function IconTrendUp(p: IconProps) { return <I {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></I> }

// Category icons for expenses
export function IconBolt(p: IconProps) { return <I {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></I> }
export function IconWifi(p: IconProps) { return <I {...p}><path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" /><path d="M8.53 16.11a6 6 0 016.95 0" /><circle cx="12" cy="20" r="1" fill="currentColor" /></I> }
export function IconBuilding(p: IconProps) { return <I {...p}><path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18" /><path d="M2 22h20" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></I> }
export function IconPhone(p: IconProps) { return <I {...p}><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /></I> }
export function IconHeart(p: IconProps) { return <I {...p}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></I> }
export function IconDroplet(p: IconProps) { return <I {...p}><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" /></I> }
export function IconFlame(p: IconProps) { return <I {...p}><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" /></I> }
export function IconShield(p: IconProps) { return <I {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></I> }
export function IconClipboard(p: IconProps) { return <I {...p}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></I> }
export function IconCart(p: IconProps) { return <I {...p}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></I> }
export function IconCar(p: IconProps) { return <I {...p}><path d="M5 17h14v-5H5z" /><path d="M7 17v2" /><path d="M17 17v2" /><path d="M5 12l2-5h10l2 5" /></I> }
export function IconGrad(p: IconProps) { return <I {...p}><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></I> }
export function IconUtensils(p: IconProps) { return <I {...p}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></I> }
export function IconWallet(p: IconProps) { return <I {...p}><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a1 1 0 100 2 1 1 0 000-2z" /></I> }
export function IconBox(p: IconProps) { return <I {...p}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></I> }
export function IconTool(p: IconProps) { return <I {...p}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></I> }
export function IconCheck(p: IconProps) { return <I {...p}><polyline points="20 6 9 17 4 12" /></I> }
export function IconPlus(p: IconProps) { return <I {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></I> }
export function IconRefresh(p: IconProps) { return <I {...p}><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></I> }
export function IconX(p: IconProps) { return <I {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></I> }
export function IconCamera(p: IconProps) { return <I {...p}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></I> }
export function IconImage(p: IconProps) { return <I {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></I> }
export function IconSettings(p: IconProps) { return <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></I> }
export function IconDollar(p: IconProps) { return <I {...p}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></I> }
export function IconPieChart(p: IconProps) { return <I {...p}><path d="M21.21 15.89A10 10 0 118 2.83" /><path d="M22 12A10 10 0 0012 2v10z" /></I> }
export function IconTarget(p: IconProps) { return <I {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></I> }
export function IconBriefcase(p: IconProps) { return <I {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></I> }
export function IconBell(p: IconProps) { return <I {...p}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></I> }
export function IconCash(p: IconProps) { return <I {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M2 10h2" /><path d="M20 10h2" /><path d="M2 14h2" /><path d="M20 14h2" /></I> }

// Map category string to icon component
// lib/categories.ts içindeki 50 kategorinin tamamı burada karşılanır.
// Eksik kalan kategori genel kutu ikonuna düşer; bu yüzden liste tam tutulmalı.
export const CATEGORY_ICON_MAP: Record<string, (p: IconProps) => JSX.Element> = {
  // Konut
  kira: IconHome,
  aidat: IconBuilding,
  elektrik: IconBolt,
  dogalgaz: IconFlame,
  su: IconDroplet,
  internet: IconWifi,
  telefon: IconPhone,
  tv_streaming: IconImage,
  temizlik: IconTool,
  ev_esya: IconBox,
  tamir_tadilat: IconTool,
  // Ulaşım
  yakit: IconCar,
  arac_bakim: IconCar,
  arac_sigorta: IconShield,
  toplu_tasima: IconCar,
  otopark: IconCar,
  kopru_otoyol: IconCar,
  taksi: IconCar,
  // Kişisel
  market: IconCart,
  restoran: IconUtensils,
  saglik: IconHeart,
  eczane: IconHeart,
  giyim: IconCart,
  kozmetik: IconCart,
  spor: IconHeart,
  egitim: IconGrad,
  eglence: IconImage,
  seyahat: IconCar,
  elektronik: IconBolt,
  abonelik: IconRefresh,
  cocuk_okul: IconGrad,
  evcil_hayvan: IconHeart,
  // İş
  personel: IconBriefcase,
  sgk: IconShield,
  vergi: IconClipboard,
  muhasebe: IconClipboard,
  ofis: IconBriefcase,
  reklam: IconTarget,
  yazilim_saas: IconWifi,
  kargo: IconBox,
  is_seyahat: IconBriefcase,
  // Finans
  kredi_odeme: IconBank,
  kk_odeme: IconCreditCard,
  sigorta: IconShield,
  yatirim: IconTrendUp,
  komisyon: IconDollar,
  // Diğer
  hediye: IconBox,
  bagis: IconHeart,
  hizmet: IconTool,
  diger: IconBox,
  // Kategori listesinde olmayan ama kodda kullanılan tipler
  kredi: IconBank,       // taksit planı satırları (source === 'loan')
  kredi_karti: IconCreditCard, // credit_cards tablosundan gelen kartlar
  nakit: IconWallet,
}

export function getCatIcon(category: string, props?: IconProps) {
  const Comp = CATEGORY_ICON_MAP[category] || IconBox
  return <Comp {...props} />
}
