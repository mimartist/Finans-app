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

---

## Bildirimler (Ödeme Hatırlatmaları)

Her sabah 08:00'de (TR saati) gecikmiş / bugün / 3 gün içinde yaklaşan ödemeler iki kanaldan bildirilir: **Web Push** ve **Telegram**. İkisi de opsiyoneldir, en az biri yapılandırılmalıdır. Zamanlama `vercel.json` içindeki cron ile yapılır (`0 5 * * *` UTC = 08:00 TR).

### Web Push kurulumu

1. VAPID anahtarları üret:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Vercel'e (ve `.env.local`'e) ekle:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` → public key
   - `VAPID_PRIVATE_KEY` → private key
   - `VAPID_SUBJECT` → `mailto:sizin@mailiniz.com`
   - `CRON_SECRET` → rastgele uzun bir değer (cron ucunu korur)
3. Supabase SQL Editor'de `supabase/migrations/20260702_push_subscriptions.sql` dosyasını çalıştır.
4. Deploy et, uygulamayı aç → **Ayarlar → Bildirimler → Push Bildirimleri** toggle'ını aç, izin ver, "Test" ile doğrula.

Notlar:
- **iPhone**: Push yalnızca ana ekrana eklenmiş PWA'da çalışır (Safari → Paylaş → Ana Ekrana Ekle, iOS 16.4+). Bildirimi uygulamanın içinden açman gerekir.
- **Android/Chrome ve masaüstü**: doğrudan çalışır.
- Service worker dev modunda kapalıdır; push'ı production build'de test edin.

### Telegram kurulumu (alternatif/ek kanal)

1. Telegram'da `@BotFather` → `/newbot` → token'ı al → `TELEGRAM_BOT_TOKEN`
2. Botla bir mesajlaş, sonra `https://api.telegram.org/bot<TOKEN>/getUpdates` adresinden `chat.id` değerini al → `TELEGRAM_CHAT_ID`
3. İkisini de Vercel environment variables'a ekle.

Manuel test: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/daily-notification`
