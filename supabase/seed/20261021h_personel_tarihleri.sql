-- ============================================================================
-- PERSONEL ÖDEME TARİHLERİ — 20'si yerine 15'i
--   Yüksel Artuk · Kasım  → 15.11.2026
--   Yüksel Artuk · Aralık → 15.12.2026
-- İsim eşleşmesi hem eski hem yeni adlandırmayı kapsar.
-- ============================================================================

update recurring_expenses
   set expense_date = '2026-11-15', payment_day = 15
 where name like '%Personel Yüksel%' and name like '%Kasım%' and is_active;

update recurring_expenses
   set expense_date = '2026-12-15', payment_day = 15
 where name like '%Personel Yüksel%' and name like '%Aralık%' and is_active;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, amount, expense_date from recurring_expenses
--  where name like '%Yüksel%' and is_active order by expense_date;
