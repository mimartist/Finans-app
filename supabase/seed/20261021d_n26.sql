-- ============================================================================
-- 21 EKİM 2026 (4) — N26 BAKİYESİ
--
--   N26  2.470,76 → 1.826 EUR
--
-- Eylül Mimosso maaşı (1.000 EUR) Revolut bakiyesinin içinde olduğu için
-- ayrıca bir kayıt açılmadı. Tekrarlayan alacak kaydı (aylık 1.000 EUR)
-- olduğu gibi kalır — o kayıt gelecekteki aylık geliri temsil eder,
-- tahsil edilmiş tek bir ayı değil.
-- ============================================================================

update accounts set balance = 1826
 where name = 'N26' and is_active is true;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, bank, currency, balance from accounts where is_active order by bank, name;
