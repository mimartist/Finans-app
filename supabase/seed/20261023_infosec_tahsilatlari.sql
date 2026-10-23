-- ============================================================================
-- İNFOSEC — TAHSİL EDİLMİŞ TUTARLARI HAREKET OLARAK İŞLE
--
-- Sorun: 797.068 (Tadilat %60) ve 390.000 (Mimari %50) tahsil edilmişti ama
-- yalnızca banka bakiyesine yansımıştı. Hiçbir tahsilat kaydı olmadığı için
-- ana sayfada "bu ay giren para" içinde görünmüyorlardı.
--
-- Çözüm: alacak kayıtları sözleşmenin TAMAMI üzerinden kurulur
--   total_amount = toplam sözleşme (KDV dahil)
--   paid_amount  = tahsil edilen
--   amount       = kalan  (DEĞİŞMİYOR — varlık toplamı aynı kalır)
-- ve tahsilatlar debt_transactions'a yazılır.
--
-- Böylece aynı para iki kez sayılmaz: varlıkta hâlâ yalnızca kalan görünür,
-- tahsilat ise geldiği ayın gelirinde görünür.
--
-- TARİHLER: Tadilat peşinatı Ekim'e yazıldı (20.10.2026). Mimari'nin %50'si
-- daha önce gelmişti, proje başlangıcına (01.08.2026) yazıldı ki Ekim'i
-- şişirmesin. Gerçek tarihleri biliyorsan transaction_date'i düzelt.
-- ============================================================================

do $$
declare
  owner uuid;
  d_tad bigint;
  d_mim bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ── TADİLAT FAZ 1 — %60 peşinat 797.068 ──────────────────────────────────
  select id into d_tad from debt_records
   where person_name = 'İnfosec' and description = 'Tadilat Faz 1 — kalan %40'
     and is_settled is false limit 1;

  if d_tad is not null then
    update debt_records
       set total_amount = 1328446.67,
           paid_amount  = 797068
     where id = d_tad;

    insert into debt_transactions (debt_id, type, amount, currency,
                                   transaction_date, notes, user_id)
    select d_tad, 'tahsilat', 797068, 'TRY', '2026-10-20', '%60 peşin ödeme', owner
     where not exists (
       select 1 from debt_transactions
        where debt_id = d_tad and amount = 797068 and type = 'tahsilat'
     );
  end if;

  -- ── MİMARİ PROJE — %50 390.000 ───────────────────────────────────────────
  select id into d_mim from debt_records
   where person_name = 'İnfosec' and description = 'Mimari Proje — kalan %50'
     and is_settled is false limit 1;

  if d_mim is not null then
    update debt_records
       set total_amount = 780000,
           paid_amount  = 390000
     where id = d_mim;

    insert into debt_transactions (debt_id, type, amount, currency,
                                   transaction_date, notes, user_id)
    select d_mim, 'tahsilat', 390000, 'TRY', '2026-08-01', '%50 ilk ödeme', owner
     where not exists (
       select 1 from debt_transactions
        where debt_id = d_mim and amount = 390000 and type = 'tahsilat'
     );
  end if;
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select d.person_name, d.description, d.total_amount, d.paid_amount, d.amount
--   from debt_records d where d.person_name = 'İnfosec';
-- select t.transaction_date, t.amount, t.notes, d.description
--   from debt_transactions t join debt_records d on d.id = t.debt_id
--  order by t.transaction_date;
