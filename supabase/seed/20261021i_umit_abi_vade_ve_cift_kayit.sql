-- ============================================================================
-- 21 EKİM 2026 (son) — İKİ DÜZELTME
--
-- 1) ÇİFT KAYIT: "İnfosec · Mimari hizmetler bedeli" (325.000) ile
--    "İnfosec · Mimari Proje — kalan %50" (390.000) aynı alacak.
--    650.000 KDV hariç sözleşmenin yarısı: 325.000 hariç = 390.000 dahil.
--    KDV dahil olan, vadesi ve proje bağı olan kayıt tutuluyor; diğeri kapanıyor.
--
-- 2) Mimar Ümit abi'nin 400.000'ine vade: en kötü ihtimalle 31.12.2026.
--    Vadesi olmayan alacak projeksiyona girmiyordu.
-- ============================================================================

update debt_records
   set is_settled = true,
       notes = coalesce(notes || ' · ', '') ||
               'Mükerrer kayıt — "Mimari Proje — kalan %50" (390.000 KDV dahil) ile aynı alacak'
 where person_name = 'İnfosec'
   and description = 'Mimari hizmetler bedeli'
   and is_settled is false;

update debt_records
   set due_date = '2026-12-31'
 where person_name like 'Mimar ümit%'
   and is_settled is false
   and due_date is null;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select person_name, description, amount, currency, due_date, is_settled
--   from debt_records where type='alacak' order by is_settled, due_date nulls last;
