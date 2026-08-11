-- ============================================================================
-- DÜZELTME — 11.08.2026 mali durum yüklemesinin eksiği
--
-- 20260811_mali_durum.sql eski hesap / kredi / gider / yatırım kayıtlarını
-- pasife çekiyordu ama credit_cards tablosunu atlamıştı. Bu yüzden eski
-- kredi kartları (Denizbank Black MC, Denizbank Business MC …) ödeme
-- listesinde ₺0,00 tutarla görünmeye devam etti.
--
-- Not: Garanti ve Denizbank kredi kartların artık "düzenli gider" olarak
-- tutuluyor (senin tercihin), o yüzden credit_cards tarafında aktif kart
-- kalmasına gerek yok. İleride gerçek kart/ekstre takibine geçmek istersen
-- is_active = true yapman yeterli.
-- ============================================================================

-- 1) Eski kredi kartlarını pasife çek
update credit_cards set is_active = false where is_active is true;

-- 2) Kalan fatura kaleminin adını anlaşılır yap
--    (Ağustos faturaları 6.000'di; 3.347 kısmi ödendi, kalanı bu kalem)
update recurring_expenses
   set name = 'Ağustos Faturaları — kalan kısım'
 where name = 'Kalan Faturalar (Ağustos)'
   and is_active is true;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, is_active from credit_cards order by is_active desc, name;
-- select name, amount, expense_date from recurring_expenses
--   where expense_type = 'one_time' and is_active order by expense_date;
