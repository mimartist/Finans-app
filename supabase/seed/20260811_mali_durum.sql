-- ============================================================================
-- MALİ DURUM YÜKLEME — 11 Ağustos 2026
--
-- Kaynak: kullanıcının verdiği yapılandırılmış mali tablo (JSON).
-- Bu dosya Supabase Dashboard > SQL Editor'de BİR KEZ çalıştırılır.
--
-- ÖNCE ÇALIŞTIRILMASI GEREKEN:
--   supabase/migrations/20260811_expense_month_overrides.sql
--   (aya özel tutar tablosu — Ağustos'un farklı tutarları için gerekli)
--
-- DAVRANIŞ:
--   * Mevcut hesap / kredi / gider / yatırım kayıtları is_active = false
--     yapılır (silinmez — geri almak istersen tekrar true yapman yeterli).
--   * Alacak kayıtlarına (debt_records) DOKUNULMAZ. Daha önce elle girdiğin
--     alacaklar varsa mükerrer görünebilir; Alacak sayfasından temizleyebilirsin.
--   * Ödeme geçmişi (recurring_payments) silinmez.
--
-- VARSAYIMLAR (rapor edildi, gerekirse uygulamadan düzeltilebilir):
--   * KMH hesabı (bakiye 0, limit 3.000) eklenmedi — sıfır bakiyeli kredi limiti.
--   * TNZTP'nin alış maliyeti verilmediği için güncel fiyat maliyet olarak
--     girildi; kâr/zarar 0 görünecek. Gerçek maliyeti Yatırımlar'dan gir.
--   * Mevduat faizi (~130.000/ay) ve beklenen yeni iş geliri (125.000/ay)
--     ALACAK olarak eklenmedi: bunlar bir kişiden alacak değil, gelir
--     projeksiyonu. Alacak olarak eklenseydi net varlığı yapay şişirirdi.
--   * Kurlar: EUR/TRY 54,04 — USD/TRY 46,893 (11.08.2026 banka ekranı).
-- ============================================================================

do $$
declare
  owner uuid;
  -- gider id'leri (ödenmiş kayıt ve aya özel tutar için gerekli)
  e_garanti   bigint;
  e_arac      bigint;
  e_denizbank bigint;
  e_aidat     bigint;
  e_sgk       bigint;
  e_fatura    bigint;
  e_avcilar   bigint;
  e_nuhoglu   bigint;
  e_muhasebe  bigint;
  e_muhtasar  bigint;
  e_adhoc     bigint;
  inv_tnztp   bigint;
begin
  -- Kayıtlar ilk kullanıcıya bağlanır (RLS ile uyumlu)
  select id into owner from auth.users order by created_at limit 1;

  -- ── 0. ESKİ KAYITLARI PASİFE ÇEK ──────────────────────────────────────────
  update accounts           set is_active = false where is_active is true;
  update loans              set is_active = false where is_active is true;
  update recurring_expenses set is_active = false where is_active is true;
  update investments        set is_active = false where is_active is true;

  -- ── 1. HESAPLAR ───────────────────────────────────────────────────────────
  insert into accounts (name, bank, type, currency, balance, notes, is_active, user_id) values
    ('Ana Hesap',      'Türkiye',   'vadesiz', 'TRY', 430061.29, '350-6640829 · gelen tahsilatlar burada bekliyor', true, owner),
    ('Yatırım Sepeti', 'Türkiye',   'vadesiz', 'TRY',   3159.58, '425-6813146', true, owner),
    ('Vadesiz EUR',    'Türkiye',   'vadesiz', 'EUR',    718.79, null, true, owner),
    ('N26',            'N26',       'vadesiz', 'EUR',   2470.76, 'Almanya · hedge/tampon', true, owner),
    ('Revolut',        'Revolut',   'vadesiz', 'EUR',    920.89, 'Almanya · DE57 1001 0178 1865 0480 27', true, owner),
    ('Sparkasse',      'Sparkasse', 'vadesiz', 'EUR',    300.00, 'Almanya · Giro Privat Komfort · DE23 3705 0198 1936 7144 17', true, owner),
    ('Vadeli Mevduat 1', 'Türkiye', 'vadeli',  'TRY', 2800000.00, '350-6732535 SUADİYE · vade 08.09.2026 · %40,75 · vade sonu 2.882.527', true, owner),
    ('Vadeli Mevduat 2', 'Türkiye', 'vadeli',  'TRY',  900000.00, '350-6732693 SUADİYE · vade 28.08.2026 · %41,5 · vade sonu 927.015', true, owner);

  -- ── 2. YATIRIM ────────────────────────────────────────────────────────────
  insert into investments (name, type, symbol, quantity, avg_cost, currency, platform, is_active, user_id)
  values ('Tapdı Oksijen (TNZTP)', 'hisse', 'TNZTP', 10000.162, 28.62, 'TRY', 'Borsa İstanbul', true, owner)
  returning id into inv_tnztp;

  -- Güncel değer anlık kaydı (11.08.2026)
  insert into investment_snapshots (investment_id, snapshot_date, price, total_value, total_value_try, user_id)
  values (inv_tnztp, '2026-08-11', 28.62, 286204.64, 286204.64, owner);

  -- ── 3. KREDİLER / TAKSİT PLANLARI ─────────────────────────────────────────
  -- Yalova Yapı: 7 taksit kaldı (Ağu 2026 → Şub 2027)
  insert into loans (name, bank, type, currency, original_amount, remaining_amount,
                     monthly_payment, payment_day, total_installments, paid_installments,
                     interest_rate, start_date, end_date, notes, is_active, user_id)
  values ('Yalova Yapı', 'EgeYapı', 'konut', 'TRY', 4165715, 809612,
          115728, 29, 36, 29, 0, '2026-08-01', '2027-02-28',
          'Toplam satış 4.165.715 · kalan 7 taksit', true, owner);

  -- Yalova Arsa: 6 ay ödemesiz dönem bitince Ekim ayında başlıyor (4 taksit)
  insert into loans (name, bank, type, currency, original_amount, remaining_amount,
                     monthly_payment, payment_day, total_installments, paid_installments,
                     interest_rate, start_date, end_date, notes, is_active, user_id)
  values ('Yalova Arsa', 'EgeYapı', 'konut', 'TRY', 270364, 270364,
          67591, 30, 4, 0, 0, '2026-10-01', '2027-01-31',
          'Toplam satış 2.413.535 · Nisan 2026''da 6 ay ödemesiz alındı, ödemesiz dönem Eylül sonunda bitiyor', true, owner);

  -- Yalova Balon Ödeme: ödemesiz dönemin geri ödemesi (3 taksit)
  insert into loans (name, bank, type, currency, original_amount, remaining_amount,
                     monthly_payment, payment_day, total_installments, paid_installments,
                     interest_rate, start_date, end_date, notes, is_active, user_id)
  values ('Yalova Balon Ödeme', 'EgeYapı', 'konut', 'TRY', 504900, 504900,
          168300, 30, 3, 0, 0, '2027-02-01', '2027-04-30',
          '6 ay ödemesiz dönemin geri ödemesi · Şub-Nis 2027', true, owner);

  -- ── 4. DÜZENLİ AYLIK GİDERLER ─────────────────────────────────────────────
  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, remind_days_before, is_active, user_id)
  values ('Garanti Kredi Kartı', 'kk_odeme', 125000, 'TRY', 14, true, 'recurring', 3, true, owner)
  returning id into e_garanti;

  -- Araç kirası Aralık 2026 sonunda bitiyor (Ocak''tan sonra babanın arabası)
  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, end_date, remind_days_before, is_active, user_id)
  values ('Araç Kirası', 'arac_bakim', 85000, 'TRY', 5, true, 'recurring', '2026-12-31', 3, true, owner)
  returning id into e_arac;

  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, remind_days_before, is_active, user_id)
  values ('Denizbank Kredi Kartı', 'kk_odeme', 15000, 'TRY', 25, true, 'recurring', 3, true, owner)
  returning id into e_denizbank;

  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, remind_days_before, is_active, user_id)
  values ('Aidat (Nuhoğlu)', 'aidat', 11000, 'TRY', 10, false, 'recurring', 3, true, owner)
  returning id into e_aidat;

  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, remind_days_before, is_active, user_id)
  values ('SGK', 'sgk', 9000, 'TRY', 30, false, 'recurring', 3, true, owner)
  returning id into e_sgk;

  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, remind_days_before, is_active, user_id)
  values ('Diğer Faturalar (cep, internet, elektrik)', 'diger', 6000, 'TRY', 15, true, 'recurring', 3, true, owner)
  returning id into e_fatura;

  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, remind_days_before, is_active, user_id)
  values ('Avcılar Daire Kredisi', 'kredi_odeme', 6000, 'TRY', 15, false, 'recurring', 3, true, owner)
  returning id into e_avcilar;

  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, remind_days_before, is_active, user_id)
  values ('Nuhoğlu Kredi', 'kredi_odeme', 5000, 'TRY', 10, false, 'recurring', 3, true, owner)
  returning id into e_nuhoglu;

  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, remind_days_before, is_active, user_id)
  values ('Muhasebe', 'muhasebe', 3250, 'TRY', 1, false, 'recurring', 3, true, owner)
  returning id into e_muhasebe;

  insert into recurring_expenses (name, category, amount, currency, payment_day, is_variable, expense_type, remind_days_before, is_active, user_id)
  values ('Muhtasar Vergi', 'vergi', 1000, 'TRY', 26, false, 'recurring', 3, true, owner)
  returning id into e_muhtasar;

  -- ── 5. TEK SEFERLİK GİDERLER ──────────────────────────────────────────────
  insert into recurring_expenses (name, category, amount, currency, payment_day, expense_type, expense_date, is_variable, remind_days_before, is_active, user_id) values
    ('Perde',                       'ev_esya', 65000, 'TRY', 25, 'one_time', '2026-08-25', false, 3, true, owner),
    ('Yaz Ekstra Gideri (Eylül)',   'diger',   75000, 'TRY', 15, 'one_time', '2026-09-15', false, 3, true, owner),
    ('Yaz Ekstra Gideri (Ekim)',    'diger',   75000, 'TRY', 15, 'one_time', '2026-10-15', false, 3, true, owner),
    ('Kalan Faturalar (Ağustos)',   'diger',    2650, 'TRY', 31, 'one_time', '2026-08-31', false, 3, true, owner);

  -- Ağustosta ödenmiş ad-hoc kalem (Oğuzhan Çelebi + virman)
  insert into recurring_expenses (name, category, amount, currency, payment_day, expense_type, expense_date, is_variable, remind_days_before, is_active, user_id)
  values ('Ad-hoc Ödeme (Oğuzhan Çelebi + virman)', 'diger', 15000, 'TRY', 10, 'one_time', '2026-08-10', false, 3, true, owner)
  returning id into e_adhoc;

  -- ── 6. AĞUSTOS 2026 — ÖDENMİŞ KALEMLER ────────────────────────────────────
  insert into recurring_payments (expense_id, period_year, period_month, amount, is_paid, paid_date, notes, user_id) values
    (e_muhasebe, 2026, 8,  3250, true, '2026-08-03', null,   owner),
    (e_arac,     2026, 8, 88788, true, '2026-08-03', null,   owner),
    (e_aidat,    2026, 8, 11494, true, '2026-08-11', null,   owner),
    (e_fatura,   2026, 8,  3347, true, '2026-08-10', null,   owner),
    (e_nuhoglu,  2026, 8,  5000, true, '2026-08-10', 'başka bankadan havale', owner),
    (e_adhoc,    2026, 8, 15000, true, '2026-08-10', null,   owner);

  -- ── 7. AĞUSTOS 2026 — AYA ÖZEL TUTARLAR ───────────────────────────────────
  -- Giderin normal tutarı değişmez; yalnızca bu ay farklı ödenen tutarlar.
  insert into recurring_expense_overrides (expense_id, period_year, period_month, amount, note, user_id) values
    (e_garanti, 2026, 8, 200000, 'Ağustos istisna (normal 125.000)', owner),
    (e_arac,    2026, 8,  88788, 'HGS dahil gerçekleşen',            owner),
    (e_aidat,   2026, 8,  11494, 'gerçekleşen',                      owner),
    (e_fatura,  2026, 8,   3347, 'kısmi ödendi, kalan 2.650 ayrı kalem', owner)
  on conflict (expense_id, period_year, period_month) do update
    set amount = excluded.amount, note = excluded.note, updated_at = now();

  -- ── 8. ALACAKLAR ──────────────────────────────────────────────────────────
  -- Tahsil edilmiş (kayıt/geçmiş amaçlı, varlık toplamına eklenmez)
  insert into debt_records (person_name, type, amount, currency, description, transaction_date, is_settled, user_id) values
    ('Vito Firması',            'alacak', 2500, 'EUR', 'Proje bedeli (USD olarak ödendi)', '2026-08-01', true, owner),
    ('Mimosso Web Sitesi',      'alacak', 2000, 'EUR', 'Web sitesi işi',                   '2026-08-01', true, owner),
    ('Yeşilköy Asil Sitesi',    'alacak', 150000, 'TRY', '1. kısım',                       '2026-08-01', true, owner);

  -- Bekleyen tek seferlik alacaklar
  insert into debt_records (person_name, type, amount, currency, description, transaction_date, due_date, is_settled, notes, user_id) values
    ('Mimosso',              'alacak',   1000, 'EUR', 'Temmuz maaşı', '2026-07-20', '2026-08-20', false, 'Revolut''ta "Dir geschuldet" olarak bekliyor', owner),
    ('Zanzibar Projesi',     'alacak',   3000, 'EUR', 'Proje bedeli', '2026-08-01', '2026-08-31', false, null, owner),
    ('Yeşilköy Asil Sitesi', 'alacak', 100000, 'TRY', 'Kalan kısım',  '2026-08-01', null,         false, 'ileride', owner),
    ('Araç Güvence Bedeli',  'alacak', 138000, 'TRY', 'Güvence bedeli iadesi', '2026-08-01', '2026-12-31', false, 'araç tesliminde', owner);

  -- Tekrarlayan aylık alacaklar
  insert into debt_records (person_name, type, amount, currency, description, transaction_date, is_settled, is_recurring, frequency, expected_day, notes, user_id) values
    ('Mimosso',      'alacak',  1000, 'EUR', 'Aylık maaş',   '2026-08-01', false, true, 'aylik', 20, 'Ocak 2027''den itibaren 2.000 EUR planlanıyor', owner),
    ('Kira Yardımı', 'alacak', 12000, 'TRY', 'Aylık kira yardımı', '2026-08-01', false, true, 'aylik', 1, 'Ağu 2026 → Oca 2028 (18 ay)', owner);

end $$;

-- ── DOĞRULAMA ───────────────────────────────────────────────────────────────
-- Aşağıdakileri çalıştırıp sonuçları kontrol edebilirsin:
--
-- select name, bank, currency, balance from accounts where is_active order by balance desc;
-- select name, monthly_payment, payment_day, start_date, end_date, remaining_amount from loans where is_active order by start_date;
-- select name, amount, payment_day, expense_type from recurring_expenses where is_active order by expense_type, payment_day;
-- select e.name, o.amount as bu_ay, e.amount as normal
--   from recurring_expense_overrides o join recurring_expenses e on e.id = o.expense_id
--   where o.period_year = 2026 and o.period_month = 8;
