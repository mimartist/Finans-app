# Finans Asistan — Next.js PWA

Kişisel finans takip uygulaması. Supabase + Next.js + Vercel.

## Kurulum

### 1. Bağımlılıkları yükle
```bash
npm install
```

### 2. Environment değişkenlerini ayarla
`.env.local.example` dosyasını `.env.local` olarak kopyala:
```bash
cp .env.local.example .env.local
```

Supabase dashboard → Settings → API sayfasından:
- `NEXT_PUBLIC_SUPABASE_URL` → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon/public key

### 3. Local'de çalıştır
```bash
npm run dev
```
→ http://localhost:3000

---

## Vercel Deploy

1. GitHub'a push et
2. https://vercel.com → New Project → repo'yu seç
3. Environment Variables ekle:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

---

## Telefona PWA Olarak Kurma

### iOS (Safari):
1. Vercel URL'ini Safari'de aç
2. Alt menü → "Ana Ekrana Ekle"
3. "Ekle" → artık uygulama gibi açılır

### Android (Chrome):
1. Chrome'da aç
2. "Ana ekrana ekle" bildirimi çıkar veya menüden seç

---

## Proje Yapısı

```
app/
├── page.tsx          → Dashboard (net worth, runway, ödemeler)
├── loans/page.tsx    → Krediler & Kredi Kartları
├── recurring/page.tsx → Düzenli Giderler
├── debts/page.tsx    → Alacak & Verecek
├── investments/page.tsx → Yatırımlar
components/
├── BottomNav.tsx     → Alt navigasyon
lib/
├── supabase.ts       → DB client + types + helpers
styles/
├── globals.css       → Global stiller
```

---

## Sonraki Adımlar

- [ ] Telegram bot entegrasyonu (python-telegram-bot)
- [ ] Döviz kuru otomatik güncelleme (TCMB API)
- [ ] KK ekstre fotoğraf → Claude Vision OCR
- [ ] Araç giderleri modülü
- [ ] Gelir takibi modülü
