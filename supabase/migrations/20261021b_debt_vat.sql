-- ============================================================================
-- ALACAKLARDA KDV BİLGİSİ
--
-- Giderlere eklenen "Tutara KDV dahil" seçeneğinin alacak tarafındaki
-- karşılığı. İşaretliyse tutar KDV dahil kabul edilir ve kâr hesabında
-- KDV ayrıştırılır; bazı işler KDV'siz olduğu için kalem bazında tutulur.
--
-- 0 / null = KDV yok · 20 = standart oran
-- ============================================================================

alter table if exists public.debt_records
  add column if not exists vat_rate numeric;

comment on column public.debt_records.vat_rate is
  'Tutara dahil KDV oranı (%). 0/null = KDV''siz.';

-- İnfosec alacakları KDV dahil tutarlardı
update public.debt_records set vat_rate = 20
 where person_name = 'İnfosec' and vat_rate is null;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select person_name, description, amount, currency, vat_rate
--   from debt_records where is_settled is false order by person_name;
