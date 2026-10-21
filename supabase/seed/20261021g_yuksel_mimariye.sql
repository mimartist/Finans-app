-- ============================================================================
-- YÜKSEL ARTUK GİDERLERİNİ MİMARİ PROJEYE TAŞI — 21 Ekim 2026
--
-- Üç kalem (Kasım 75.000, Aralık 75.000, iş avansı 5.000 = 155.000) tadilat
-- projesinden çıkarılıp mimari projeye bağlanıyor. Personel maaşı olduğu
-- için KDV yok (vat_rate 0).
--
-- Etkisi — toplam kâr değişmiyor, yalnızca doğru projeye yazılıyor:
--   Tadilat Faz 1   127.039 (%11,5)  →  282.039 (%25,5)
--   Mimari Proje    650.000 (%100)   →  495.000 (%76,2)
--   Toplam          777.039          =  777.039
--
-- Kalemler "İnfosec Mimari — " önekiyle yeniden adlandırılıyor; böylece
-- tadilat kalemlerini toplu etiketleyen sorgular bunları geri almaz.
-- ============================================================================

do $$
declare
  p_mim bigint;
begin
  select id into p_mim from projects where name = 'İnfosec Mimari Proje';
  if p_mim is null then
    raise exception 'İnfosec Mimari Proje bulunamadı — önce proje kurulum script''ini çalıştır';
  end if;

  update recurring_expenses
     set project_id = p_mim,
         vat_rate   = 0,
         name       = replace(replace(name, 'İnfosec Tadilat — Personel Yüksel Artık',
                                            'İnfosec Mimari — Personel Yüksel Artuk'),
                              'İnfosec Tadilat — Yüksel Artık iş avansı',
                              'İnfosec Mimari — Yüksel Artuk iş avansı')
   where name like '%Yüksel%';
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select e.name, e.amount, e.expense_date, e.vat_rate, p.name as proje
--   from recurring_expenses e left join projects p on p.id = e.project_id
--  where e.is_active and e.name like 'İnfosec%' order by p.name, e.expense_date;
