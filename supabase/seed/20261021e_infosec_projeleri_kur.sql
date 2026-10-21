-- ============================================================================
-- İNFOSEC PROJELERİNİ KUR VE MEVCUT KAYITLARI BAĞLA
--
-- ÖNCE: supabase/migrations/20261021_projects.sql çalıştırılmalı.
--
-- İki ayrı proje açılıyor, çünkü marjları birbirine hiç benzemiyor:
--   Mimari Proje   650.000 hariç · doğrudan maliyet yok  → kâr 650.000
--   Tadilat Faz 1  1.107.039 hariç · maliyet 975.000     → kâr 132.039 (%11,9)
-- Tek proje yapılsaydı tadilatın ince marjı mimari projenin içinde kaybolurdu.
--
-- "collected" bugüne dek tahsil edilen (KDV dahil) tutardır; kalan tahsilatlar
-- zaten alacak kaydı olarak duruyor, oradan türetiliyor.
-- ============================================================================

do $$
declare
  owner  uuid;
  p_mim  bigint;
  p_tad  bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ── 1. PROJELER ──────────────────────────────────────────────────────────
  select id into p_mim from projects where name = 'İnfosec Mimari Proje';
  if p_mim is null then
    insert into projects (name, client, contract_amount, vat_rate, collected,
                          status, start_date, end_date, notes, user_id)
    values ('İnfosec Mimari Proje', 'İnfosec', 650000, 20, 390000,
            'devam', '2026-08-01', '2026-12-20',
            'Sözleşme 650.000 + KDV = 780.000 · %50 tahsil edildi · kalan 20.12.2026', owner)
    returning id into p_mim;
  end if;

  select id into p_tad from projects where name = 'İnfosec Tadilat Faz 1';
  if p_tad is null then
    insert into projects (name, client, contract_amount, vat_rate, collected,
                          status, start_date, end_date, notes, user_id)
    values ('İnfosec Tadilat Faz 1', 'İnfosec', 1107038.89, 20, 797068,
            'devam', '2026-10-01', '2026-12-20',
            'Toplam 1.328.446,67 KDV dahil · %60 peşin alındı · iş bitimi 20.12.2026', owner)
    returning id into p_tad;
  end if;

  -- ── 2. ALACAKLARI BAĞLA ──────────────────────────────────────────────────
  update debt_records set project_id = p_mim
   where person_name = 'İnfosec' and description = 'Mimari Proje — kalan %50';

  update debt_records set project_id = p_tad
   where person_name = 'İnfosec' and description = 'Tadilat Faz 1 — kalan %40';

  -- ── 3. GİDERLERİ BAĞLA + KDV ORANLARINI YAZ ──────────────────────────────
  -- Taşeron faturaları KDV dahil ödeniyor (oran 20), personel maaşında KDV yok.
  update recurring_expenses
     set project_id = p_tad,
         vat_rate = case when category = 'tamir_tadilat' then 20 else 0 end
   where name like 'İnfosec Tadilat — %';
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select p.name, p.contract_amount, p.collected,
--        (select coalesce(sum(d.amount),0) from debt_records d
--          where d.project_id = p.id and d.is_settled is false) as kalan_alacak,
--        (select coalesce(sum(e.amount),0) from recurring_expenses e
--          where e.project_id = p.id and e.is_active) as toplam_maliyet
--   from projects p order by p.name;
