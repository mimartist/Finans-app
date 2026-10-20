-- ============================================================================
-- 20 EKİM 2026 — TEK SEFERDE ÇALIŞTIR
--
-- Bugün konuştuğumuz her şey bu dosyada. Daha önce parça parça verdiğim
-- dosyaları çalıştırdıysan sorun değil — hepsi "varsa ekleme" biçiminde
-- yazıldı, tekrar çalıştırmak mükerrer kayıt oluşturmaz.
--
-- İÇİNDEKİLER
--   1. İnfosec Mimari Proje — kalan 390.000, vade 20.12.2026
--   2. İnfosec Tadilat Faz 1 — kalan 531.378,67, vade 20.12.2026
--   3. Tadilat taşeron maliyetleri (KDV dahil): 21.10 ve 20.12
--   4. Tadilat personel gideri: 20.11 ve 20.12, 75.000'er
--   5. Davut Kangal'a verilen 40.000, vade 05.11.2026
--
-- DOKUNULMAYANLAR: krediler, düzenli giderler, ödendi/ödenmedi kayıtları.
--
-- RAKAMLARIN KAYNAĞI
--   Mimari   650.000 + KDV = 780.000 · %50 tahsil edildi
--   Tadilat  %60 peşin 797.068 (KDV dahil) → toplam 1.328.446,67
--   Maliyet  elektrik 425.000 + mekanik/inşaat 400.000 = 825.000 (KDV hariç)
--            fatura karşılığı ödendiği için kasadan çıkan: 990.000
--   Personel 2 × 75.000 (maaş, KDV yok)
-- ============================================================================

do $$
declare
  owner uuid;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ── 1 + 2. İNFOSEC KALAN TAHSİLATLARI ────────────────────────────────────
  -- Tahsil edilmiş kısımlar (390.000 + 797.068) banka bakiyelerinde olduğu
  -- için alacak olarak yazılmaz — aynı para iki kez sayılmasın.
  insert into debt_records (person_name, type, amount, currency, description,
                            transaction_date, due_date, is_settled, notes, user_id)
  select 'İnfosec', 'alacak', v.amount, 'TRY', v.description,
         '2026-10-20', '2026-12-20', false, v.notes, owner
    from (values
      ('Mimari Proje — kalan %50',   390000::numeric,
       'Sözleşme 650.000 + KDV = 780.000 · %50 tahsil edildi'),
      ('Tadilat Faz 1 — kalan %40',  531378.67::numeric,
       'Toplam iş 1.328.446,67 KDV dahil · %60 (797.068) tahsil edildi · iş bitimi 20.12.2026')
    ) as v(description, amount, notes)
   where not exists (
     select 1 from debt_records d
      where d.person_name = 'İnfosec' and d.description = v.description
   );

  -- Daha önceki dosyayı çalıştırdıysan Tadilat kalanının vadesi boştu, doldur
  update debt_records
     set due_date = '2026-12-20'
   where person_name = 'İnfosec'
     and description = 'Tadilat Faz 1 — kalan %40'
     and is_settled is false
     and due_date is null;

  -- ── 3 + 4. TADİLAT MALİYETLERİ ───────────────────────────────────────────
  insert into recurring_expenses (name, category, amount, currency, payment_day,
                                  expense_type, expense_date, is_variable,
                                  remind_days_before, is_active, user_id)
  select v.name, v.kategori, v.amount, 'TRY',
         extract(day from v.tarih::date)::int,
         'one_time', v.tarih::date, false, 2, true, owner
    from (values
      -- taşeron: KDV dahil (200.000 × 1,20 = 240.000)
      ('İnfosec Tadilat — Elektrik (1. ödeme)',        'tamir_tadilat', 240000::numeric, '2026-10-21'),
      ('İnfosec Tadilat — Mekanik/İnşaat (1. ödeme)',  'tamir_tadilat', 240000::numeric, '2026-10-21'),
      ('İnfosec Tadilat — Elektrik (son ödeme)',       'tamir_tadilat', 270000::numeric, '2026-12-20'),
      ('İnfosec Tadilat — Mekanik/İnşaat (son ödeme)', 'tamir_tadilat', 240000::numeric, '2026-12-20'),
      -- personel: maaş, KDV yok
      ('İnfosec Tadilat — Personel (Kasım)',           'personel',       75000::numeric, '2026-11-20'),
      ('İnfosec Tadilat — Personel (Aralık)',          'personel',       75000::numeric, '2026-12-20')
    ) as v(name, kategori, amount, tarih)
   where not exists (
     select 1 from recurring_expenses e
      where e.name = v.name and e.expense_date = v.tarih::date
   );

  -- ── 5. DAVUT KANGAL'A VERİLEN BORÇ ───────────────────────────────────────
  insert into debt_records (person_name, type, amount, currency, description,
                            transaction_date, due_date, is_settled, user_id)
  select 'Davut Kangal', 'alacak', 40000, 'TRY', 'Verilen borç',
         '2026-10-20', '2026-11-05', false, owner
   where not exists (
     select 1 from debt_records
      where person_name = 'Davut Kangal' and transaction_date = '2026-10-20'
   );
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select person_name, description, amount, due_date
--   from debt_records where is_settled is false order by due_date nulls last;
--
-- select name, amount, expense_date from recurring_expenses
--  where expense_type = 'one_time' and is_active and expense_date >= '2026-10-01'
--  order by expense_date;
