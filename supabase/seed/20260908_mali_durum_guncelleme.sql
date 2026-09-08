-- ============================================================================
-- MALİ DURUM GÜNCELLEME — 8 Eylül 2026
--
-- Kaynak: banka "Durumum / Varlıklar-Borçlar" ekranları + kullanıcı notları.
--
-- DOKUNULMAYANLAR (kullanıcının açık talebi):
--   * recurring_expenses  — düzenli ve tek seferlik giderler
--   * loans               — kredi / taksit planları
--   * recurring_payments  — ödendi/ödenmedi kayıtları
--   Bu üçü elle doğru işleniyor, buradan hiç el sürülmüyor.
--
-- DEĞİŞENLER: hesap bakiyeleri, vadeli mevduat, yatırımlar, alacaklar, kurlar.
-- ============================================================================

do $$
declare
  owner       uuid;
  inv_tnztp   bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ── 1. VADESİZ HESAPLAR ───────────────────────────────────────────────────
  -- Bankada "Vadesiz TL" tek satır: 37.611,13. İki TL hesabın arasındaki
  -- dağılım bilinmiyor; tamamı Ana Hesap'a yazıldı (toplam doğru).
  update accounts set balance = 37611.13
   where name = 'Ana Hesap' and is_active is true;

  update accounts set balance = 0
   where name = 'Yatırım Sepeti' and is_active is true;

  -- Vadesiz EUR 718,79 değişmedi (bankada "Döviz ve Kıymetli Madenler"
  -- 39.197,76 TL = 718,79 EUR × 54,53). N26 / Revolut / Sparkasse de aynı.

  -- ── 2. VADELİ MEVDUAT ─────────────────────────────────────────────────────
  -- Mevduat 2 (900.000) 28.08'de vadesi doldu ve kapandı.
  update accounts set is_active = false
   where name = 'Vadeli Mevduat 2' and is_active is true;

  -- Mevduat 1 bugün vadesi dolup 2.850.000 ile yenilendi: 34 gün, brüt %38,5.
  -- Vade sonu = 2.850.000 + (2.850.000 × 0,385 × 34/365 × 0,85 stopaj sonrası)
  --           = 2.850.000 + 86.878,15 = 2.936.878,15
  -- (365 gün + %15 stopaj konvansiyonu, önceki iki mevduatın banka rakamlarıyla
  --  doğrulandı: ikisi de tam 31,06 gün ima ediyordu)
  update accounts
     set balance        = 2850000,
         maturity_date  = '2026-10-12',
         maturity_value = 2936878.15,
         interest_rate  = 38.5,
         notes          = '350-6732535 SUADİYE · 34 gün · brüt %38,5 · vade 12.10.2026'
   where name = 'Vadeli Mevduat 1' and is_active is true;

  -- ── 3. YATIRIMLAR ─────────────────────────────────────────────────────────
  select id into inv_tnztp from investments
   where symbol = 'TNZTP' and is_active is true limit 1;

  -- TNZTP: 10.000,162 → 8.000,162 adet (2.000 satılmış), gerçek maliyet 29,42
  update investments
     set quantity = 8000.162, avg_cost = 29.42
   where id = inv_tnztp;

  -- 11.08 tarihli fiyat kaydı artık geçersiz (hem adet hem fiyat değişti).
  -- Silinince kalem maliyet bedelinden değerlenir; güncel fiyatı Yatırımlar
  -- sayfasından girince tekrar gerçek değere oturur.
  delete from investment_snapshots where investment_id = inv_tnztp;

  -- (insert'ler "varsa güncelle" biçiminde — dosya iki kez çalışsa da mükerrer olmaz)
  if exists (select 1 from investments where symbol = 'GARAN' and is_active is true) then
    update investments set quantity = 2871, avg_cost = 132.72
     where symbol = 'GARAN' and is_active is true;
  else
    insert into investments (name, type, symbol, quantity, avg_cost, currency, platform, is_active, user_id)
    values ('Garanti BBVA (GARAN)', 'hisse', 'GARAN', 2871, 132.72, 'TRY', 'Borsa İstanbul', true, owner);
  end if;

  -- Fonun kırılımı verilmedi; tek kalem olarak güncel değeriyle giriliyor.
  -- Maliyet = güncel değer olduğu için kâr/zarar 0 görünecek.
  if exists (select 1 from investments where name = 'Yatırım Fonu' and is_active is true) then
    update investments set quantity = 1, avg_cost = 483101.35
     where name = 'Yatırım Fonu' and is_active is true;
  else
    insert into investments (name, type, symbol, quantity, avg_cost, currency, platform, is_active, user_id)
    values ('Yatırım Fonu', 'fon', null, 1, 483101.35, 'TRY', null, true, owner);
  end if;

  -- ── 4. ALACAKLAR ──────────────────────────────────────────────────────────
  -- Mimosso Temmuz maaşı tahsil edildi (bekleyen tek maaş Eylül; o da
  -- tekrarlayan alacak olarak zaten her ay 20'sinde işleniyor).
  update debt_records set is_settled = true
   where person_name = 'Mimosso' and description = 'Temmuz maaşı' and is_settled is false;

  -- Zanzibar 3.000 EUR hâlâ bekliyor, bu aya kaydı
  update debt_records set due_date = '2026-09-30'
   where person_name = 'Zanzibar Projesi' and is_settled is false;

  -- Yeni: verilen 30.000 TL, ay sonunda dönecek
  insert into debt_records (person_name, type, amount, currency, description,
                            transaction_date, due_date, is_settled, notes, user_id)
  select 'Verilen Borç', 'alacak', 30000, 'TRY', 'Ay sonunda dönecek',
         '2026-09-08', '2026-09-30', false,
         'Alacaklı adını Alacak/Borç sayfasından düzenleyebilirsin', owner
   where not exists (
     select 1 from debt_records
      where person_name = 'Verilen Borç' and transaction_date = '2026-09-08'
   );

  -- Yeşilköy kalan 100.000 ve Araç Güvence 138.000 duruyor — dokunulmadı.

  -- ── 5. KURLAR ─────────────────────────────────────────────────────────────
  -- USD/TRY bankadan: 47,6170. EUR/TRY, döviz hesabının TL karşılığından ima
  -- ediliyor: 39.197,76 / 718,79 = 54,5330. Kripto kurları son satırdan taşınır.
  delete from exchange_rates where date = '2026-09-08';
  insert into exchange_rates (date, usd_try, eur_try, btc_usd, eth_usd, gold_try)
  select '2026-09-08', 47.6170, 54.5330,
         coalesce(btc_usd, 0), coalesce(eth_usd, 0), coalesce(gold_try, 0)
    from exchange_rates order by date desc limit 1;
  -- Hiç kur kaydı yoksa yukarıdaki select boş döner — o zaman bu satır yazar
  insert into exchange_rates (date, usd_try, eur_try, btc_usd, eth_usd, gold_try)
  select '2026-09-08', 47.6170, 54.5330, 0, 0, 0
   where not exists (select 1 from exchange_rates where date = '2026-09-08');
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, type, currency, balance, maturity_date, maturity_value, interest_rate
--   from accounts where is_active order by type, name;
--
-- select name, type, quantity, avg_cost, quantity * avg_cost as tutar
--   from investments where is_active order by type, name;
--
-- select person_name, amount, currency, due_date, is_recurring, is_settled
--   from debt_records where is_settled is false order by due_date nulls last;
