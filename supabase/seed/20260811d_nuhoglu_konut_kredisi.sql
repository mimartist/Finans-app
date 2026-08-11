-- ============================================================================
-- NUHOĞLU KONUT KREDİSİ — düzenli giderden gerçek krediye taşıma
--
-- Kaynak: banka ekranı (11.08.2026)
--   Kredi tutarı        455.000,00 TL
--   Kalan borç          272.707,47 TL
--   Aylık ödeme           4.845,68 TL
--   Kalan / toplam taksit      70 / 144
--   Faiz oranı                  %0,64 (aylık)
--   Son ödeme tarihi       10.09.2026  (yani Ağustos taksiti ödenmiş)
--   Kredi bitiş tarihi     10.06.2032
--
-- Türetilenler:
--   ödenen taksit = 144 - 70 = 74
--   ilk taksit    = 10.06.2032'den 143 ay geri = 10.07.2020
--   (kontrol: 74. taksit = Ağu 2026, 75. taksit = Eyl 2026 ✓ banka ekranıyla uyumlu)
--
-- Bu dosya:
--   1) 'Nuhoğlu Kredi' düzenli giderini pasife çeker (5.000 TL'lik yaklaşık kalem)
--   2) Krediyi loans tablosuna gerçek verileriyle ekler
--   3) Ağustos 2026 ödeme kaydını giderden krediye taşır (tutarı da düzeltir)
--   4) Şub–Tem 2026 taksitlerini ödenmiş olarak yazar — yoksa kredinin başlangıç
--      tarihi 2020 olduğu için altı ay "Geçmiş Ödenmemiş" listesine düşerdi
--
-- Banka adı boş bırakıldı; uygulamadan Krediler > düzenle ile doldurabilirsin.
-- ============================================================================

do $$
declare
  owner      uuid;
  l_nuhoglu  bigint;
  e_nuhoglu  bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- 1) Yaklaşık tutarlı düzenli gider kalemini pasife çek
  select id into e_nuhoglu
    from recurring_expenses
   where name = 'Nuhoğlu Kredi' and is_active is true
   limit 1;

  if e_nuhoglu is not null then
    update recurring_expenses set is_active = false where id = e_nuhoglu;
  end if;

  -- 2) Krediyi gerçek verileriyle ekle
  insert into loans (name, bank, type, currency, original_amount, remaining_amount,
                     monthly_payment, payment_day, total_installments, paid_installments,
                     interest_rate, start_date, end_date, notes, is_active, user_id)
  values ('Nuhoğlu Konut Kredisi', null, 'konut', 'TRY', 455000, 272707.47,
          4845.68, 10, 144, 74, 0.64, '2020-07-10', '2032-06-10',
          'Hesap 2702-71558109-1003 · 11.08.2026 banka ekranı', true, owner)
  returning id into l_nuhoglu;

  -- 3) Ağustos 2026 ödemesi zaten kayıtlıydı (gidere bağlıydı) — krediye taşı.
  --    Tutar 5.000 idi, bankadan gelen gerçek taksit 4.845,68.
  if e_nuhoglu is not null then
    update recurring_payments
       set expense_id = null,
           loan_id    = l_nuhoglu,
           amount     = 4845.68,
           notes      = 'loan_' || l_nuhoglu || '|başka bankadan havale'
     where expense_id = e_nuhoglu
       and period_year = 2026 and period_month = 8;
  end if;

  -- 4) Son 6 ayın taksitleri ödenmiş olarak yazılır (uygulama 6 ay geriye bakar)
  insert into recurring_payments (expense_id, loan_id, period_year, period_month,
                                  amount, is_paid, paid_date, notes, user_id)
  select null, l_nuhoglu, d.y, d.m, 4845.68, true,
         make_date(d.y, d.m, 10), 'loan_' || l_nuhoglu, owner
    from (values (2026,2),(2026,3),(2026,4),(2026,5),(2026,6),(2026,7)) as d(y,m)
   where not exists (
     select 1 from recurring_payments p
      where p.loan_id = l_nuhoglu
        and p.period_year = d.y and p.period_month = d.m
   );
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, monthly_payment, paid_installments, total_installments,
--        remaining_amount, start_date, end_date
--   from loans where is_active order by name;
--
-- select period_year, period_month, amount, notes
--   from recurring_payments
--  where loan_id = (select id from loans where name = 'Nuhoğlu Konut Kredisi')
--  order by period_year, period_month;
