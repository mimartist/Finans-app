-- ============================================================================
-- ONARIM — "Geçmiş Ödenmemiş" listesindeki taksit, Nakit ile ödendiğinde
--          listeden düşmüyordu
--
-- Kök neden: Kredi taksiti ödeme kaydı ile kredi arasındaki tek bağ
-- recurring_payments.loan_id kolonuydu. Ödeme yöntemi Nakit/Kredi Kartı
-- seçildiğinde notes alanına "nakit" / "kk_3" yazılıyor, kredi kimliği
-- yalnızca loan_id'ye düşüyordu. Bu kolon veritabanında yoksa uygulama
-- kaydı kolonsuz olarak yazıyor (insert başarılı görünüyor) ama kayıt hiçbir
-- krediyle eşleşmiyordu -> taksit "hâlâ ödenmemiş" olarak listede kalıyordu.
--
-- Kod tarafı düzeltildi: kredi kimliği artık HEM loan_id'ye HEM de notes'a
-- "loan_<id>|nakit" biçiminde yazılıyor; kolon olmasa bile bağ kopmuyor.
--
-- Bu dosya veritabanını onarır:
--   1) loan_id kolonu yoksa ekler
--   2) notes'tan kredi kimliğini çıkarıp loan_id'ye yazar
--   3) kimliksiz kalmış (nakit/kart notlu) kayıtları tutar + dönem eşleşmesiyle
--      doğru krediye bağlar
--   4) notes alanını yeni biçime çevirir
--   5) aynı kredi + aynı ay için oluşmuş mükerrer kayıtları temizler ve
--      kredinin ödenen taksit sayacını buna göre geri alır
--
-- Güvenlik: 3. adımda yalnızca TEK bir krediyle eşleşen kayıtlar güncellenir.
-- Aynı taksit tutarına sahip birden fazla kredi varsa kayıt dokunulmadan
-- bırakılır (yanlış eşleştirmektense elle düzeltmek doğrudur).
-- ============================================================================

-- 1) Kolon yoksa ekle
alter table if exists public.recurring_payments
  add column if not exists loan_id bigint references public.loans(id) on delete set null;

-- 2) notes = 'loan_<id>' veya 'loan_<id>|yöntem' -> loan_id
update public.recurring_payments p
set loan_id = substring(p.notes from '^loan_([0-9]+)')::bigint
where p.loan_id is null
  and p.notes ~ '^loan_[0-9]+(\||$)'
  and exists (
    select 1 from public.loans l
    where l.id = substring(p.notes from '^loan_([0-9]+)')::bigint
  );

-- 3) Kimliksiz kalmış kayıtlar: tutarı + dönemi tek bir krediyle eşleşiyorsa bağla
update public.recurring_payments p
set loan_id = m.loan_id
from (
  select p2.id as payment_id, min(l.id) as loan_id
  from public.recurring_payments p2
  join public.loans l
    on l.monthly_payment = p2.amount
   and (p2.user_id is null or l.user_id is null or l.user_id = p2.user_id)
   -- kredi o dönemde gerçekten aktif olmalı
   and (l.start_date is null
        or date_trunc('month', l.start_date)
           <= make_date(p2.period_year, p2.period_month, 1))
   and (l.end_date is null
        or date_trunc('month', l.end_date)
           >= make_date(p2.period_year, p2.period_month, 1))
  where p2.loan_id is null
    and p2.expense_id is null
    and (p2.notes is null or p2.notes !~ '^(loan_|cc_)[0-9]+')
    and p2.period_year is not null
    and p2.period_month is not null
  group by p2.id
  having count(distinct l.id) = 1
) m
where p.id = m.payment_id;

-- 4) notes'u yeni biçime çevir: 'nakit' -> 'loan_12|nakit', 'kk_3' -> 'loan_12|kk_3'
update public.recurring_payments p
set notes = 'loan_' || p.loan_id || '|' || p.notes
where p.loan_id is not null
  and p.notes is not null
  and p.notes !~ '^loan_[0-9]+(\||$)';

-- notu hiç olmayan kayıtlara da bağı yaz
update public.recurring_payments p
set notes = 'loan_' || p.loan_id
where p.loan_id is not null
  and (p.notes is null or p.notes = '');

-- 5) Mükerrer kayıtları temizle (aynı kredi + aynı dönem) ve taksit sayacını düzelt
with dupes as (
  select id, loan_id,
         row_number() over (
           partition by loan_id, period_year, period_month
           order by id
         ) as rn
  from public.recurring_payments
  where loan_id is not null
    and is_paid is true
    and period_year is not null
    and period_month is not null
),
removed as (
  delete from public.recurring_payments p
  using dupes d
  where p.id = d.id and d.rn > 1
  returning p.loan_id
),
counts as (
  select loan_id, count(*)::int as cnt from removed group by loan_id
)
update public.loans l
set paid_installments = greatest(0, coalesce(l.paid_installments, 0) - c.cnt)
from counts c
where l.id = c.loan_id;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- Hâlâ hiçbir kredi/gider ile eşleşmemiş ödeme kaydı kaldı mı?
--   select id, period_year, period_month, amount, notes
--     from recurring_payments
--    where loan_id is null and expense_id is null
--      and (notes is null or notes !~ '^(loan_|cc_)[0-9]+');
--
-- Kredi bazında hangi aylar ödenmiş görünüyor?
--   select l.name, p.period_year, p.period_month, p.amount, p.notes
--     from recurring_payments p join loans l on l.id = p.loan_id
--    order by l.name, p.period_year, p.period_month;
