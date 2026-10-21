-- ============================================================================
-- 21 EKİM 2026 — GARANTİ VARLIK GÜNCELLEMESİ (tek seferde çalıştır)
--
-- Daha önce verdiğim 20261021_vadeli_mevduat_yenileme.sql'in yerine geçer,
-- onu çalıştırdıysan sorun değil — buradaki update'ler aynı sonucu verir.
--
-- İÇİNDEKİLER
--   1. Vadeli mevduat yenilendi: 3.200.000 · %38 · vade 13.11.2026
--   2. Vadesiz TL 335.420 · Vadesiz EUR 519
--   3. GARAN hissesi satıldı → pasife
--   4. TNZTP 7.000 lot · maliyet 29,49 · güncel 22,72
--   5. Yatırım fonu kapandı; THY fonundan beklenen 55.750 alacağa döndü
--
-- STOPAJ: bankanın verdiği 3.287.951'den geri hesaplanınca %17,50 çıkıyor.
-- Aynı çarpanla (0,825) eski iki mevduatın rakamları da tam 32 güne oturuyor:
--     net getiri = anapara × oran × gün/365 × 0,825
-- ============================================================================

do $$
declare
  owner    uuid;
  inv_tnz  bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ── 1. VADELİ MEVDUAT ────────────────────────────────────────────────────
  -- Garanti · 3.200.000 · brüt %38 · 32 gün · vade sonu 3.287.951 (getiri 87.951)
  update accounts
     set name = 'Vadeli Mevduat', bank = 'Garanti',
         balance = 3200000,
         maturity_date = '2026-11-13',
         maturity_value = 3287951,
         interest_rate = 38,
         notes = 'Garanti · 32 gün · brüt %38 · stopaj %17,5 · vade 13.11.2026'
   where type = 'vadeli' and is_active is true;

  -- ── 2. VADESİZ HESAPLAR ──────────────────────────────────────────────────
  update accounts set balance = 335420, bank = 'Garanti'
   where name = 'Ana Hesap' and is_active is true;

  update accounts set balance = 519, bank = 'Garanti'
   where name = 'Vadesiz EUR' and is_active is true;

  -- N26 / Revolut / Sparkasse (Almanya) değişmedi — dokunulmadı.

  -- ── 3. GARAN SATILDI ─────────────────────────────────────────────────────
  -- Satış bedeli zaten vadesiz bakiyenin içinde, ayrıca gelir yazılmaz.
  update investments set is_active = false
   where symbol = 'GARAN' and is_active is true;

  -- ── 4. TNZTP ─────────────────────────────────────────────────────────────
  select id into inv_tnz from investments
   where symbol = 'TNZTP' and is_active is true limit 1;

  update investments set quantity = 7000, avg_cost = 29.49 where id = inv_tnz;

  -- Güncel fiyat kaydı: 7.000 × 22,72 = 159.040 (maliyet 206.430 → %22,96 zarar)
  delete from investment_snapshots
   where investment_id = inv_tnz and snapshot_date = '2026-10-21';
  insert into investment_snapshots (investment_id, snapshot_date, price,
                                    total_value, total_value_try, user_id)
  values (inv_tnz, '2026-10-21', 22.72, 159040, 159040, owner);

  -- ── 5. THY FONU ──────────────────────────────────────────────────────────
  -- Fon tasfiye oldu; artık bir yatırım değil, tahsil edilecek bir alacak.
  update investments set is_active = false
   where type = 'fon' and is_active is true;

  insert into debt_records (person_name, type, amount, currency, description,
                            transaction_date, due_date, is_settled, notes, user_id)
  select 'THY Fonu (tasfiye)', 'alacak', 55750, 'TRY',
         'Fon tasfiyesinden beklenen ödeme',
         '2026-10-21', null, false,
         'Fona 200.000 girilmişti · beklenen 55.750 · tutar ve tarih kesinleşince güncelle', owner
   where not exists (
     select 1 from debt_records where person_name = 'THY Fonu (tasfiye)'
   );
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, bank, type, currency, balance, maturity_date, maturity_value
--   from accounts where is_active order by type, name;
--
-- select name, symbol, quantity, avg_cost, quantity*avg_cost as maliyet
--   from investments where is_active;
--
-- select person_name, amount, currency, due_date from debt_records
--  where is_settled is false order by due_date nulls last;
