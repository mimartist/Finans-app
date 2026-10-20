-- ============================================================================
-- İNFOSEC TADİLAT FAZ 1 — PERSONEL + KALAN MALİYETLER + TAHSİLAT VADESİ
--
-- Kullanıcı bildirimi: işin bitişi ~20 Aralık 2026, 2 ay boyunca aylık
-- 75.000 personel gideri (toplam 150.000).
--
-- Bitiş tarihi üç boşluğu birden dolduruyor:
--   1) Tadilat kalan %40 (531.378,67) tahsilatının vadesi → 20.12.2026
--   2) Kalan taşeron ödemeleri (510.000 KDV dahil)        → 20.12.2026
--   3) Personel: 20.11.2026 ve 20.12.2026
--
-- Personel maaş gideri olduğu için KDV yok — 75.000 doğrudan kasadan çıkar.
-- Taşeron kalanı fatura karşılığı, o yüzden KDV dahil yazıldı:
--   elektrik  225.000 × 1,20 = 270.000
--   mekanik   200.000 × 1,20 = 240.000
-- ============================================================================

do $$
declare
  owner uuid;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- 1) Tadilat kalan tahsilatının vadesi belli oldu
  update debt_records
     set due_date = '2026-12-20',
         notes = 'Toplam iş 1.328.446,67 KDV dahil · %60 (797.068) tahsil edildi · iş bitimi 20.12.2026'
   where person_name = 'İnfosec'
     and description = 'Tadilat Faz 1 — kalan %40'
     and is_settled is false;

  -- 2) Kalan taşeron ödemeleri + personel
  insert into recurring_expenses (name, category, amount, currency, payment_day,
                                  expense_type, expense_date, is_variable,
                                  remind_days_before, is_active, user_id)
  select v.name, v.kategori, v.amount, 'TRY', 20,
         'one_time', v.tarih::date, false, 2, true, owner
    from (values
      ('İnfosec Tadilat — Elektrik (son ödeme)',       'tamir_tadilat', 270000::numeric, '2026-12-20'),
      ('İnfosec Tadilat — Mekanik/İnşaat (son ödeme)', 'tamir_tadilat', 240000::numeric, '2026-12-20'),
      ('İnfosec Tadilat — Personel (Kasım)',           'personel',       75000::numeric, '2026-11-20'),
      ('İnfosec Tadilat — Personel (Aralık)',          'personel',       75000::numeric, '2026-12-20')
    ) as v(name, kategori, amount, tarih)
   where not exists (
     select 1 from recurring_expenses e
      where e.name = v.name and e.expense_date = v.tarih::date
   );
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, amount, expense_date from recurring_expenses
--  where expense_type = 'one_time' and is_active and name like 'İnfosec%'
--  order by expense_date;
--
-- select person_name, description, amount, due_date from debt_records
--  where person_name = 'İnfosec' and is_settled is false order by due_date;
