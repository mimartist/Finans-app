-- ============================================================================
-- İNFOSEC TADİLAT FAZ 1 — TAŞERON MALİYETLERİ (21 Ekim 2026 ödemesi)
--
-- Kullanıcı bildirimi (tutarlar KDV HARİÇ):
--   Elektrikçi          toplam 425.000 · yarın ödenecek 200.000
--   Mekanik + inşaat    toplam 400.000 · yarın ödenecek 200.000
--                       ────────────────────────────────────────
--   toplam              825.000  → daha önce bildirilen maliyetle birebir ✓
--
-- Taşeronlar fatura kesiyor, yani kasadan çıkan tutar KDV DAHİL:
--   yarın:   200.000 × 1,20 = 240.000  (her biri)  → 480.000
--   kalan:   elektrik 225.000 → 270.000 dahil
--            mekanik  200.000 → 240.000 dahil      → 510.000
--
-- Bu dosya YALNIZCA yarınki iki ödemeyi yazar. Kalan 510.000'in ödeme
-- tarihi bilinmediği için girilmedi — tarih verilince eklenecek. O zamana
-- kadar projeksiyon bu kadar iyimser görünür.
--
-- KDV: bu faturaların 165.000'lik KDV'si indirilecek KDV olarak mevcut
-- 333.000 alacağa eklenir; iki işin net KDV'si zaten bu alacaktan karşılanıyor.
-- ============================================================================

do $$
declare
  owner uuid;
begin
  select id into owner from auth.users order by created_at limit 1;

  insert into recurring_expenses (name, category, amount, currency, payment_day,
                                  expense_type, expense_date, is_variable,
                                  remind_days_before, is_active, user_id)
  select v.name, 'tamir_tadilat', v.amount, 'TRY', 21,
         'one_time', '2026-10-21', false, 1, true, owner
    from (values
      ('İnfosec Tadilat — Elektrik (1. ödeme)',        240000::numeric),
      ('İnfosec Tadilat — Mekanik/İnşaat (1. ödeme)',  240000::numeric)
    ) as v(name, amount)
   where not exists (
     select 1 from recurring_expenses e
      where e.name = v.name and e.expense_date = '2026-10-21'
   );
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, amount, expense_date, category from recurring_expenses
--  where expense_type = 'one_time' and is_active order by expense_date;
