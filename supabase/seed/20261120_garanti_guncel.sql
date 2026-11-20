-- ============================================================================
-- 20 KASIM 2026 — GARANTİ GÜNCEL DURUM (banka ekranları)
--   Vadeli   3.300.000 · %37,5 · 13.11 → 28.12.2026 (45 gün) · vade sonu 3.425.869
--   GTL      GPY 1. Para Piyasası Fonu · 8.650.740 pay × 0,147047 = 1.272.065,37
--   TNZTP    7.000,162 adet × 21,28 = 148.960
--   EUR      511
--   Vadesiz TL: ekranda yok → 0
-- Tekrar çalıştırmak güvenli.
-- ============================================================================
do $$
declare
  owner uuid; inv_gtl bigint; inv_tnz bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- Vadeli mevduat yenilendi
  update accounts
     set name = 'Vadeli Mevduat', bank = 'Garanti', balance = 3300000,
         maturity_date = '2026-12-28', maturity_value = 3425869, interest_rate = 37.5,
         notes = 'Garanti 425-6701383 · 13.11→28.12.2026 (45 gün) · brüt %37,5 · net faiz 125.869'
   where type = 'vadeli' and is_active is true;

  update accounts set balance = 511 where name = 'Vadesiz EUR' and is_active is true;
  update accounts set balance = 0   where name in ('Ana Hesap', 'Yatırım Sepeti') and is_active is true;

  -- GTL para piyasası fonu
  select id into inv_gtl from investments where symbol = 'GTL' and is_active is true limit 1;
  if inv_gtl is null then
    insert into investments (name, type, symbol, quantity, avg_cost, currency, platform, is_active, user_id)
    values ('GPY 1. Para Piyasası Fonu (GTL)', 'fon', 'GTL', 8650740, 0.145794, 'TRY', 'Garanti', true, owner)
    returning id into inv_gtl;
  else
    update investments set quantity = 8650740, avg_cost = 0.145794 where id = inv_gtl;
  end if;
  delete from investment_snapshots where investment_id = inv_gtl and snapshot_date = '2026-11-20';
  insert into investment_snapshots (investment_id, snapshot_date, price, total_value, total_value_try, user_id)
  values (inv_gtl, '2026-11-20', 0.147047, 1272065.37, 1272065.37, owner);

  -- TNZTP
  select id into inv_tnz from investments where symbol = 'TNZTP' and is_active is true limit 1;
  update investments set quantity = 7000.162, avg_cost = 29.49 where id = inv_tnz;
  delete from investment_snapshots where investment_id = inv_tnz and snapshot_date = '2026-11-20';
  insert into investment_snapshots (investment_id, snapshot_date, price, total_value, total_value_try, user_id)
  values (inv_tnz, '2026-11-20', 21.28, 148960, 148960, owner);
end $$;
