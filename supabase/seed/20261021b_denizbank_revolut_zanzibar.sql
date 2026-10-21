-- ============================================================================
-- 21 EKİM 2026 (2) — DENİZBANK, REVOLUT, ZANZİBAR TAHSİLATI
--
--   Denizbank vadesiz   558.037 − 240.000 (bugün BTD'ye) = 318.037
--   Revolut             920,89 EUR → 4.020 EUR
--   Zanzibar            3.000 EUR alacağın 1.000'i tahsil edildi → kalan 2.000
--   Mimosso UG          400 EUR borç verildi
--
-- NOT — BTD'ye gidecek 240.000: bakiye talebin üzerine düşürüldü, ama hangi
-- taşeron kalemine ait olduğunu bilmediğim için 21.10 tarihli iki 240.000'lik
-- giderden hiçbiri "ödendi" işaretlenmedi. Uygulamadan öderken yöntem olarak
-- NAKİT seç (Hesaptan dersen bakiye ikinci kez düşer). Hangisi olduğunu
-- söylersen kaydı krediyle/hesapla doğru şekilde bağlarım.
--
-- Revolut'taki 4.020 EUR'nun bileşimi (kullanıcı notu): 1.000 Zanzibar
-- tahsilatı + 500 Zanzibar ilave aydınlatma işi + önceki bakiye ve diğerleri.
-- İlave aydınlatma işi tahsil edilmiş olduğu için alacak yazılmadı.
-- ============================================================================

do $$
declare
  owner      uuid;
  d_zanzibar bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ── 1. DENİZBANK ─────────────────────────────────────────────────────────
  if exists (select 1 from accounts where name = 'Denizbank Vadesiz' and is_active is true) then
    update accounts set balance = 318037
     where name = 'Denizbank Vadesiz' and is_active is true;
  else
    insert into accounts (name, bank, type, currency, balance, notes, is_active, user_id)
    values ('Denizbank Vadesiz', 'Denizbank', 'vadesiz', 'TRY', 318037,
            '558.037 − 240.000 (21.10 BTD ödemesi)', true, owner);
  end if;

  -- ── 2. REVOLUT ───────────────────────────────────────────────────────────
  update accounts set balance = 4020
   where name = 'Revolut' and is_active is true;

  -- ── 3. ZANZİBAR — 1.000 EUR KISMİ TAHSİLAT ───────────────────────────────
  select id into d_zanzibar from debt_records
   where person_name = 'Zanzibar Projesi' and is_settled is false limit 1;

  if d_zanzibar is not null then
    update debt_records
       set amount       = 2000,
           paid_amount  = coalesce(paid_amount, 0) + 1000,
           total_amount = coalesce(total_amount, 3000)
     where id = d_zanzibar;

    insert into debt_transactions (debt_id, type, amount, currency,
                                   transaction_date, notes, user_id)
    select d_zanzibar, 'tahsilat', 1000, 'EUR', '2026-10-21', 'Revolut''a geldi', owner
     where not exists (
       select 1 from debt_transactions
        where debt_id = d_zanzibar and transaction_date = '2026-10-21' and amount = 1000
     );
  end if;

  -- ── 4. MİMOSSO UG'YE VERİLEN BORÇ ────────────────────────────────────────
  insert into debt_records (person_name, type, amount, currency, description,
                            transaction_date, due_date, is_settled, user_id)
  select 'Mimosso UG', 'alacak', 400, 'EUR', 'Verilen borç',
         '2026-10-21', null, false, owner
   where not exists (
     select 1 from debt_records
      where person_name = 'Mimosso UG' and transaction_date = '2026-10-21'
   );
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, bank, currency, balance from accounts where is_active order by bank, name;
-- select person_name, amount, currency, paid_amount, due_date
--   from debt_records where is_settled is false order by due_date nulls last;
