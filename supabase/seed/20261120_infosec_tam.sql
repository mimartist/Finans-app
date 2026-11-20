-- ============================================================================
-- İNFOSEC — TAM YENİDEN KURULUM · 20 Kasım 2026
--
-- Kaynak: INFOSEC_Ozel_On_Muhasebe.xlsx (16 Kasım) + kullanıcı ödeme listesi.
-- Eski İnfosec kayıtları silinip 7 müşteri paketi + tedarikçi tarafı kurulur.
--
--   MÜŞTERİ PAKETLERİ   toplam 7.656.079,09 · alınan 4.823.969,83 · kalan 2.832.109,26
--   TEDARİKÇİLER        toplam 4.615.953,00 · ödenen 2.795.953,00 · kalan 1.820.000,00
--   Gerçekleşen kasa    +4.823.969,83 − 2.796.455,56 = +2.027.514,27
--   Bundan sonrası      +2.832.109,26 − 1.820.000,00 = +1.012.109,26
--
-- TARİH UYARISI: kalan tahsilat ve ödemelerin vadesi teyit edilmemiş.
-- Projeksiyonda görünebilmeleri için 31.12.2026 çalışma tarihi verildi
-- (BTD'nin 170.000'i hariç — o "haftaya" denmişti, 27.11'e yazıldı).
-- Gerçek tarihler belli olunca güncellenmeli.
--
-- EKSİK MALİYETLER: Modül Panel zemin, akustik tedarikçi, peyzaj tedarikçi,
-- halı sökümü, 13. kat boya, tabela/logo. Bu yüzden kâr henüz kesin değil.
-- ============================================================================

do $$
declare
  owner uuid;
  p_mim bigint; p_f1 bigint; p_f2 bigint; p_mob bigint; p_ak bigint; p_pey bigint; p_fm bigint;
  d_id bigint; e_id bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ── 0. ESKİ İNFOSEC KAYITLARINI TEMİZLE ──────────────────────────────────
  delete from debt_transactions where debt_id in
    (select id from debt_records where person_name = 'İnfosec');
  delete from debt_records where person_name = 'İnfosec';
  update recurring_expenses set is_active = false where name like 'İnfosec %';
  delete from projects where name like 'İnfosec%';

  -- ── 1. MÜŞTERİ PAKETLERİ (proje + kalan alacak + tahsilat) ───────────────
  insert into projects (name, client, contract_amount, vat_rate, collected, status, start_date, notes, user_id) values
    ('İnfosec M-01 Mimari hizmet',      'İnfosec',  650000.00, 20,  390000.00, 'devam', '2026-10-07', '%50 peşin, %50 teslimde', owner),
    ('İnfosec M-02 Faz 1 tadilat',      'İnfosec', 1107456.07, 20, 1105690.75, 'devam', '2026-10-16', 'İnşaat + elektrik + mekanik · 8 Kasım kapsamı', owner),
    ('İnfosec M-03 Faz 2 cam/zemin/armatür/perde', 'İnfosec', 2021655.84, 20, 1455592.20, 'devam', '2026-11-03', 'Zemin kalemi EUR kuruna duyarlı', owner),
    ('İnfosec M-04 Özel imalat mobilya','İnfosec', 2218501.40, 20, 1597321.01, 'devam', '2026-11-10', 'Hamdi/Yıldız imalatı', owner),
    ('İnfosec M-05 Akustik',            'İnfosec',   77150.00, 20,   55548.00, 'devam', '2026-11-10', 'Tedarikçi maliyeti henüz belli değil', owner),
    ('İnfosec M-06 Bitki ve peyzaj',    'İnfosec',  220000.00, 20,  158400.00, 'devam', '2026-11-10', 'Tedarikçi maliyeti henüz belli değil', owner),
    ('İnfosec M-07 FM200',              'İnfosec',   85302.60, 20,   61417.87, 'devam', '2026-11-10', 'Fenix sistemi', owner);

  -- Kalan alacaklar (vade teyit edilmedi — çalışma tarihi 31.12.2026)
  insert into debt_records (person_name, type, amount, currency, description, transaction_date,
                            due_date, is_settled, vat_rate, total_amount, paid_amount, project_id, notes, user_id)
  select 'İnfosec', 'alacak', v.kalan, 'TRY', v.ad, v.bas, '2026-12-31', false, 20,
         v.toplam, v.alinan, (select id from projects where name = v.proje), 'Vade teyit edilmedi — çalışma tarihi', owner
    from (values
      ('Mimari hizmet — kalan',        390000.00::numeric,  780000.00::numeric,  390000.00::numeric, '2026-10-07'::date, 'İnfosec M-01 Mimari hizmet'),
      ('Faz 1 tadilat — kalan',        223256.53,          1328947.28,          1105690.75, '2026-10-16', 'İnfosec M-02 Faz 1 tadilat'),
      ('Faz 2 cam/zemin/perde — kalan',970394.81,          2425987.01,          1455592.20, '2026-11-03', 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('Özel imalat mobilya — kalan', 1064880.67,          2662201.68,          1597321.01, '2026-11-10', 'İnfosec M-04 Özel imalat mobilya'),
      ('Akustik — kalan',               37032.00,            92580.00,            55548.00, '2026-11-10', 'İnfosec M-05 Akustik'),
      ('Bitki ve peyzaj — kalan',      105600.00,           264000.00,           158400.00, '2026-11-10', 'İnfosec M-06 Bitki ve peyzaj'),
      ('FM200 — kalan',                 40945.25,           102363.12,            61417.87, '2026-11-10', 'İnfosec M-07 FM200')
    ) as v(ad, kalan, toplam, alinan, bas, proje);

  -- Gerçekleşen 4 tahsilat — Mimari kaydına bağlanır (tarih ve tutar esas)
  select id into d_id from debt_records where person_name='İnfosec' and description='Mimari hizmet — kalan';
  insert into debt_transactions (debt_id, type, amount, currency, transaction_date, notes, user_id) values
    (d_id, 'tahsilat',  390000.00, 'TRY', '2026-10-07', 'GIB...0003 · mimari %50', owner),
    (d_id, 'tahsilat',  797068.00, 'TRY', '2026-10-16', 'GIB...0004 · Faz 1 avansı', owner),
    (d_id, 'tahsilat', 1455592.20, 'TRY', '2026-11-03', 'GIB...0005 · Faz 2 avansı', owner),
    (d_id, 'tahsilat', 2181309.63, 'TRY', '2026-11-10', 'Mobilya/akustik/peyzaj/FM200 + Faz 1 kalanları', owner);

  -- ── 2. TEDARİKÇİ ÖDEMELERİ — GERÇEKLEŞEN ─────────────────────────────────
  insert into recurring_expenses (name, category, amount, currency, payment_day, expense_type,
                                  expense_date, is_variable, vat_rate, project_id, remind_days_before, is_active, user_id)
  select v.ad, v.kat, v.tutar, 'TRY', extract(day from v.tar::date)::int, 'one_time',
         v.tar::date, false, v.kdv, (select id from projects where name = v.proje), 1, true, owner
    from (values
      ('İnfosec — BYD/Yasemin Bozkurt (1. ödeme)',   'tamir_tadilat', 240000::numeric, '2026-10-21', 20::numeric, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Sude Elektrik/Uğur Hançer (avans)','tamir_tadilat', 240000, '2026-10-21', 20, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Altun Elektrik (aydınlatma)',      'ev_esya',       190000, '2026-11-09', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Taner Özüş (perde avansı)',        'ev_esya',       660000, '2026-11-09', 10, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Bayrak Metal (cam avansı)',        'tamir_tadilat', 210000, '2026-11-09', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Yıldız Yılmaz (Hamdi mobilya avansı)','ev_esya',   1020000, '2026-11-12', 20, 'İnfosec M-04 Özel imalat mobilya'),
      ('İnfosec — BYD/Yasemin Bozkurt (2. ödeme)',   'tamir_tadilat', 100000, '2026-11-13', 20, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Fenix FM200',                      'tamir_tadilat', 102918, '2026-11-16', 20, 'İnfosec M-07 FM200'),
      ('İnfosec — Yüksel Artuk (avans)',             'personel',       25000, '2026-11-16',  0, 'İnfosec M-01 Mimari hizmet'),
      ('İnfosec — Altun Elektrik (ilave lamba)',     'ev_esya',         8035, '2026-11-16', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — banka masrafları',                 'komisyon',       502.56,'2026-11-16',  0, 'İnfosec M-02 Faz 1 tadilat')
    ) as v(ad, kat, tutar, tar, kdv, proje);

  -- Hepsini ödendi olarak işaretle
  for e_id in select id from recurring_expenses where name like 'İnfosec — %' and is_active loop
    insert into recurring_payments (expense_id, period_year, period_month, amount, is_paid, paid_date, notes, user_id)
    select e_id, extract(year from e.expense_date)::int, extract(month from e.expense_date)::int,
           e.amount, true, e.expense_date, 'nakit', owner
      from recurring_expenses e where e.id = e_id
       and not exists (select 1 from recurring_payments p where p.expense_id = e_id);
  end loop;

  -- ── 3. TEDARİKÇİ ÖDEMELERİ — BEKLEYEN ────────────────────────────────────
  insert into recurring_expenses (name, category, amount, currency, payment_day, expense_type,
                                  expense_date, is_variable, vat_rate, project_id, remind_days_before, is_active, user_id)
  select v.ad, v.kat, v.tutar, 'TRY', extract(day from v.tar::date)::int, 'one_time',
         v.tar::date, false, v.kdv, (select id from projects where name = v.proje), 2, true, owner
    from (values
      ('İnfosec — BYD/Yasemin kalan',          'tamir_tadilat', 170000::numeric, '2026-11-27', 20::numeric, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Sude Elektrik kalan',        'tamir_tadilat', 300000, '2026-12-31', 20, 'İnfosec M-02 Faz 1 tadilat'),
      ('İnfosec — Taner Özüş perde kalan',     'ev_esya',       275000, '2026-12-31', 10, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Bayrak Metal cam kalan',     'tamir_tadilat', 140000, '2026-12-31', 20, 'İnfosec M-03 Faz 2 cam/zemin/armatür/perde'),
      ('İnfosec — Hamdi/Yıldız mobilya kalan', 'ev_esya',       935000, '2026-12-31', 15, 'İnfosec M-04 Özel imalat mobilya')
    ) as v(ad, kat, tutar, tar, kdv, proje);
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, contract_amount, collected from projects order by name;
-- select description, amount, total_amount, paid_amount from debt_records where person_name='İnfosec';
-- select name, amount, expense_date from recurring_expenses where name like 'İnfosec%' and is_active order by expense_date;
