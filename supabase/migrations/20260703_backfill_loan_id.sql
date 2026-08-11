-- ============================================================================
-- ONARIM: Nakit / kredi kartı ile ödenmiş kredi taksitlerini kredisiyle eşleştir
--
-- Sorun: "Öde" ekranında yöntem olarak Nakit veya Kredi Kartı seçildiğinde
-- ödeme kaydının notes alanına yöntem bilgisi ("nakit" / "kk_3") yazılıyor,
-- kredinin kimliği ise hiçbir yere yazılmıyordu. Hatırlatma ve dashboard
-- kontrolü taksiti kredi kimliğinden aradığı için bu ödemeler görülmüyor,
-- taksit "hâlâ ödenmemiş" sanılıp bildirilmeye devam ediyordu.
--
-- Kod tarafı düzeltildi (artık loan_id her zaman yazılıyor). Bu migration
-- geçmiş kayıtları onarır: kredi ile ilişkisi kurulamamış ödemeleri, aynı
-- tutardaki aktif krediyle eşleştirir.
--
-- Güvenlik: yalnızca tutarı TEK bir krediyle eşleşen kayıtlar güncellenir;
-- birden fazla kredi aynı taksit tutarına sahipse kayıt dokunulmadan bırakılır
-- (yanlış eşleştirme yapmaktansa elle düzeltilmesi daha doğru).
-- ============================================================================

-- loan_id kolonu yoksa ekle (bazı kurulumlarda yalnızca notes kullanılıyordu)
alter table if exists public.recurring_payments
  add column if not exists loan_id bigint references public.loans(id) on delete set null;

-- 1) notes = 'loan_<id>' biçiminde olan kayıtlar: kimliği doğrudan al
update public.recurring_payments p
set loan_id = substring(p.notes from '^loan_([0-9]+)$')::bigint
where p.loan_id is null
  and p.notes ~ '^loan_[0-9]+$'
  and exists (select 1 from public.loans l where l.id = substring(p.notes from '^loan_([0-9]+)$')::bigint);

-- 2) Yöntem notlu ("nakit" / "kk_*") ya da notsuz, gider ile de ilişkisiz kayıtlar:
--    tutarı tek bir krediyle eşleşiyorsa o krediye bağla
update public.recurring_payments p
set loan_id = m.loan_id
from (
  select p2.id as payment_id, min(l.id) as loan_id
  from public.recurring_payments p2
  join public.loans l
    on l.monthly_payment = p2.amount
   and (p2.user_id is null or l.user_id is null or l.user_id = p2.user_id)
  where p2.loan_id is null
    and p2.expense_id is null
    and (p2.notes is null or p2.notes !~ '^(loan_|cc_)[0-9]+$')
  group by p2.id
  having count(distinct l.id) = 1
) m
where p.id = m.payment_id;

-- Kontrol: hâlâ eşleşmemiş ödeme kaydı kaldıysa görmek için
--   select id, period_year, period_month, amount, notes
--   from recurring_payments
--   where loan_id is null and expense_id is null
--     and (notes is null or notes !~ '^(loan_|cc_)[0-9]+$');
