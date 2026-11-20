-- 20 KASIM 2026 — HEPSİ BİR ARADA (İnfosec + hesaplar + alacaklar). Tekrar çalıştırmak güvenli.
do $$
declare
  owner uuid; d_id bigint; e_id bigint; inv_gtl bigint; inv_tnz bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ===== 1. İNFOSEC: eskiyi temizle =====
  delete from debt_transactions where debt_id in (select id from debt_records where person_name = 'İnfosec');
  delete from debt_records where person_name = 'İnfosec';
  delete from recurring_payments where expense_id in (select id from recurring_expenses where name like 'İnfosec — %');
  delete from recurring_expenses where name like 'İnfosec — %';
  update recurring_expenses set is_active = false where name like 'İnfosec %';
  delete from projects where name like 'İnfosec%';

  -- ===== 2. MÜŞTERİ PAKETLERİ (KDV hariç sözleşme / KDV dahil tahsilat) =====
  insert into projects (name, client, contract_amount, vat_rate, collected, status, start_date, end_date, notes, user_id) values
    ('İnfosec M-01 Mimari hizmet',       'İnfosec',  650000.00, 20,  390000.00, 'devam', '2026-10-07', '2026-12-31', '%50 peşin, %50 teslimde', owner),
    ('İnfosec M-02 Faz 1 tadilat',       'İnfosec', 1107456.07, 20, 1105690.75, 'devam', '2026-10-16', '2026-12-31', 'İnşaat + elektrik + mekanik', owner),
    ('İnfosec M-03 Faz 2 cam/zemin/armatür/perde', 'İnfosec', 2021655.84, 20, 1455592.20, 'devam', '2026-11-03', '2026-12-31', 'Zemin 8.268 EUR × 55,88', owner),
    ('İnfosec M-04 Özel imalat mobilya', 'İnfosec', 2218501.40, 20, 1597321.01, 'devam', '2026-11-10', '2026-12-31', 'Hamdi/Yıldız imalatı', owner),
    ('İnfosec M-05 Akustik',             'İnfosec',   77150.00, 20,   55548.00, 'devam', '2026-11-10', '2026-12-31', 'Modül Panel baffle', owner),
    ('İnfosec M-06 Bitki ve peyzaj',     'İnfosec',  220000.00, 20,  158400.00, 'devam', '2026-11-10', '2026-12-31', 'Maliyet 150.000 + KDV', owner),
    ('İnfosec M-07 FM200',               'İnfosec',   85302.60, 20,   61417.87, 'devam', '2026-11-10', '2026-12-31', 'Fenix', owner);

  insert into debt_records (person_name, type, amount, currency, description, transaction_date,
                            due_date, is_settled, vat_rate, total_amount, paid_amount, project_id, notes, user_id)
  select 'İnfosec', 'alacak', v.kalan, 'TRY', v.ad, v.bas, '2026-12-31', false, 20,
         v.toplam, v.alinan, (select id from projects where name = v.proje), '%40 teslimde', owner
    from (values
      ('Mimari hizmet — kalan',         390000.00::numeric,  780000.00::numeric,  390000.00::numeric, '2026-10-07'::date, 'İnfosec M-01 Mimari hizmet'),
      ('Faz 1 tadilat — kalan',         223256.53,          1328947.28,          1105690.75, '2026-10-16', 'İnfosec M-02 Faz 1 tadilat'),
      ('Faz 2 cam/zemin/perde — kalan', 970394.81,          2425987.01,          1455592.20, '2026-11-03', 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('Özel imalat mobilya — kalan',  1064880.67,          2662201.68,          1597321.01, '2026-11-10', 'İnfosec M-04 Özel imalat mobilya'),
      ('Akustik — kalan',                37032.00,            92580.00,            55548.00, '2026-11-10', 'İnfosec M-05 Akustik'),
      ('Bitki ve peyzaj — kalan',       105600.00,           264000.00,           158400.00, '2026-11-10', 'İnfosec M-06 Bitki ve peyzaj'),
      ('FM200 — kalan',                  40945.25,           102363.12,            61417.87, '2026-11-10', 'İnfosec M-07 FM200')
    ) as v(ad, kalan, toplam, alinan, bas, proje);

  select id into d_id from debt_records where person_name = 'İnfosec' and description = 'Mimari hizmet — kalan';
  insert into debt_transactions (debt_id, type, amount, currency, transaction_date, notes, user_id) values
    (d_id, 'tahsilat',  390000.00, 'TRY', '2026-10-07', 'Mimari %50', owner),
    (d_id, 'tahsilat',  797068.00, 'TRY', '2026-10-16', 'Faz 1 avansı', owner),
    (d_id, 'tahsilat', 1455592.20, 'TRY', '2026-11-03', 'Faz 2 avansı', owner),
    (d_id, 'tahsilat', 2181309.63, 'TRY', '2026-11-10', 'Mobilya/akustik/peyzaj/FM200 + Faz 1', owner);

  -- ===== 3. TEDARİKÇİ — ÖDENENLER =====
  insert into recurring_expenses (name, category, amount, currency, payment_day, expense_type,
                                  expense_date, is_variable, vat_rate, project_id, remind_days_before, is_active, user_id)
  select v.ad, v.kat, v.tutar, 'TRY', extract(day from v.tar::date)::int, 'one_time',
         v.tar::date, false, v.kdv, (select id from projects where name = v.proje), 1, true, owner
    from (values
      ('İnfosec — BYD/Yasemin (1. ödeme)',        'tamir_tadilat', 240000::numeric, '2026-10-21', 20::numeric, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Sude/Uğur Hançer (avans)',      'tamir_tadilat', 240000,    '2026-10-21', 20, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Altun aydınlatma',              'ev_esya',       190000,    '2026-11-09', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Taner Özüş perde (avans)',      'ev_esya',       560000,    '2026-11-09', 10, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Bayrak Metal cam (avans)',      'tamir_tadilat', 210000,    '2026-11-09', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Hamdi/Yıldız mobilya (avans)',  'ev_esya',      1020000,    '2026-11-12', 15, 'İnfosec M-04 Özel imalat mobilya'),
      ('İnfosec — BYD/Yasemin (2. ödeme)',        'tamir_tadilat', 100000,    '2026-11-13', 20, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Modül Panel zemin (avans)',     'tamir_tadilat', 300000,    '2026-11-13', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Fenix FM200',                   'tamir_tadilat', 102918,    '2026-11-16', 20, 'İnfosec M-07 FM200'),
      ('İnfosec — Yüksel Artuk (avans)',          'personel',       25000,    '2026-11-16',  0, 'İnfosec M-01 Mimari hizmet'),
      ('İnfosec — Altun ilave lamba',             'ev_esya',         8035,    '2026-11-16', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — banka masrafları',              'komisyon',      502.56,    '2026-11-16',  0, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Yüksel Artuk (Kasım maaş)',     'personel',       75000,    '2026-11-20',  0, 'İnfosec M-01 Mimari hizmet'),
      ('İnfosec — Altun son ödeme',               'ev_esya',         2600,    '2026-11-20', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde')
    ) as v(ad, kat, tutar, tar, kdv, proje);

  for e_id in select id from recurring_expenses where name like 'İnfosec — %' and is_active loop
    insert into recurring_payments (expense_id, period_year, period_month, amount, is_paid, paid_date, notes, user_id)
    select e.id, extract(year from e.expense_date)::int, extract(month from e.expense_date)::int,
           e.amount, true, e.expense_date, 'nakit', owner
      from recurring_expenses e where e.id = e_id;
  end loop;

  -- ===== 4. TEDARİKÇİ — BEKLEYENLER (toplam 2.497.444) =====
  insert into recurring_expenses (name, category, amount, currency, payment_day, expense_type,
                                  expense_date, is_variable, vat_rate, project_id, remind_days_before, is_active, user_id)
  select v.ad, v.kat, v.tutar, 'TRY', extract(day from v.tar::date)::int, 'one_time',
         v.tar::date, false, v.kdv, (select id from projects where name = v.proje), 2, true, owner
    from (values
      ('İnfosec — BYD/Yasemin kalan',           'tamir_tadilat', 170000::numeric, '2026-11-27', 20::numeric, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Taner Özüş perde kalan',      'ev_esya',       375000, '2026-12-01', 10, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Bayrak Metal cam kalan',      'tamir_tadilat', 140000, '2026-12-10', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Modül Panel zemin kalan',     'tamir_tadilat', 229344, '2026-12-10', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Modül Panel akustik baffle',  'tamir_tadilat',  68100, '2026-12-10', 20, 'İnfosec M-05 Akustik'),
      ('İnfosec — Sude/Uğur Hançer kalan',      'tamir_tadilat', 300000, '2026-12-15', 20, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Yüksel Artuk (Aralık maaş)',  'personel',      100000, '2026-12-15',  0, 'İnfosec M-01 Mimari hizmet'),
      ('İnfosec — Hamdi/Yıldız mobilya kalan',  'ev_esya',       935000, '2026-12-25', 15, 'İnfosec M-04 Özel imalat mobilya'),
      ('İnfosec — Peyzaj tedarikçi',            'ev_esya',       180000, '2026-12-31', 20, 'İnfosec M-06 Bitki ve peyzaj')
    ) as v(ad, kat, tutar, tar, kdv, proje);

  -- ===== 5. HESAPLAR =====
  update accounts
     set name = 'Vadeli Mevduat', bank = 'Garanti', balance = 3300000,
         maturity_date = '2026-12-28', maturity_value = 3425869, interest_rate = 37.5,
         notes = 'Garanti 425-6701383 · 13.11→28.12.2026 (45 gün) · brüt %37,5 · net faiz 125.869'
   where type = 'vadeli' and is_active is true;
  update accounts set balance = 511   where name = 'Vadesiz EUR'  and is_active is true;
  update accounts set balance = 0     where name in ('Ana Hesap', 'Yatırım Sepeti') and is_active is true;
  update accounts set balance = 0, notes = 'Bakiye Garanti''ye aktarıldı (20.11.2026)'
   where name = 'Denizbank Vadesiz' and is_active is true;
  update accounts set balance = 3920  where name = 'Revolut'      and is_active is true;
  update accounts set balance = 236   where name = 'Sparkasse'    and is_active is true;
  update accounts set balance = 0     where name = 'N26'          and is_active is true;
  update accounts set balance = 25000 where name = 'Nakit (Evde)' and is_active is true;

  -- ===== 6. YATIRIMLAR =====
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

  select id into inv_tnz from investments where symbol = 'TNZTP' and is_active is true limit 1;
  if inv_tnz is not null then
    update investments set quantity = 7000.162, avg_cost = 29.49 where id = inv_tnz;
    delete from investment_snapshots where investment_id = inv_tnz and snapshot_date = '2026-11-20';
    insert into investment_snapshots (investment_id, snapshot_date, price, total_value, total_value_try, user_id)
    values (inv_tnz, '2026-11-20', 21.28, 148960, 148960, owner);
  end if;

  -- ===== 7. ALACAKLAR =====
  select id into d_id from debt_records where person_name = 'Davut Kangal' and is_settled is false limit 1;
  if d_id is not null then
    insert into debt_transactions (debt_id, type, amount, currency, transaction_date, notes, user_id)
    values (d_id, 'tahsilat', 40000, 'TRY', '2026-11-05', 'Borç geri alındı', owner);
    update debt_records set is_settled = true where id = d_id;
  end if;

  update debt_records
     set is_settled = true,
         notes = coalesce(notes || ' · ', '') || '20.11.2026: fon kapandı, ödeme gelmeyecek — zarar'
   where person_name = 'THY Fonu (tasfiye)' and is_settled is false;
end $$;
