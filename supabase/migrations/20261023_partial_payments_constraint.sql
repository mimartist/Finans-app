-- ============================================================================
-- KISMİ ÖDEME — benzersizlik kısıtını kaldır
--
-- recurring_payments üzerinde (expense_id, period_year, period_month) için
-- bir unique constraint vardı: "bir gidere bir ayda tek ödeme kaydı".
--
-- Kısmi ödeme özelliği tam da bunun tersini gerektiriyor — 150.000'lik kart
-- borcunun 125.000'i 14 Eylül'de, kalanı başka bir gün ödendiğinde iki ayrı
-- kayıt gerekiyor. Kısıt bu ikinci kaydı reddediyordu:
--   duplicate key value violates unique constraint
--   "recurring_payments_expense_id_period_year_period_month_key"
--
-- Kredi taksitlerinde sorun çıkmıyordu çünkü orada expense_id null kalıyor ve
-- Postgres null değerleri benzersizlik kısıtında çakıştırmıyor.
--
-- Mükerrer kayıt koruması artık arayüzde: ödeme ekranı o ayın bütün
-- ödemelerini tarihiyle listeliyor ve her biri tek tek silinebiliyor.
-- ============================================================================

alter table if exists public.recurring_payments
  drop constraint if exists recurring_payments_expense_id_period_year_period_month_key;

-- Sorgular için faydalı, benzersizlik dayatmayan indeks
create index if not exists recurring_payments_expense_period_idx
  on public.recurring_payments (expense_id, period_year, period_month);

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select conname from pg_constraint
--  where conrelid = 'public.recurring_payments'::regclass and contype = 'u';
