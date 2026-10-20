-- ============================================================================
-- İNFOSEC PROJELERİ — 20 Ekim 2026
--
-- Kaynak: kullanıcı bildirimi.
--
--   Mimari Proje    650.000 + KDV  = 780.000 (dahil)
--                   %50 tahsil edildi (390.000) · kalan 390.000 → 20.12.2026
--
--   Tadilat Faz 1   %60 peşin olarak 797.068 (KDV dahil) tahsil edildi
--                   → toplam iş 1.328.446,67 (dahil) / 1.107.038,89 (hariç)
--                   → kalan %40 = 531.378,67 (dahil)
--
-- Bu dosya YALNIZCA kalan tahsilatları alacak olarak yazar. Tahsil edilmiş
-- kısımlar (390.000 + 797.068) banka bakiyelerinde olduğu için ayrıca alacak
-- yazılmaz — yoksa aynı para iki kez sayılırdı.
--
-- GİRİLMEYENLER (bilgi bekliyor):
--   * Tadilatın 825.000 + KDV maliyeti — ödeme takvimi belli değil, gider
--     olarak yazılmadı. Girilene kadar runway bu kadar iyimser görünür.
--   * Tadilat kalanının vade tarihi — null bırakıldı, bu yüzden 12 aylık
--     projeksiyona girmez (tarih verilince güncellenir).
--
-- KDV NOTU: iki işin net ödenecek KDV'si 186.407,78. Mevcut 333.000 KDV
-- alacağı bunu tamamen karşılıyor, kasadan KDV çıkmıyor; 146.592,22 alacak
-- kalıyor. Bu yüzden ayrıca bir KDV gideri yazılmadı.
-- ============================================================================

do $$
declare
  owner uuid;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- Mimari Proje — kalan %50, vadesi belli
  insert into debt_records (person_name, type, amount, currency, description,
                            transaction_date, due_date, is_settled, notes, user_id)
  select 'İnfosec', 'alacak', 390000, 'TRY', 'Mimari Proje — kalan %50',
         '2026-10-20', '2026-12-20', false,
         'Sözleşme 650.000 + KDV = 780.000 · %50 tahsil edildi', owner
   where not exists (
     select 1 from debt_records
      where person_name = 'İnfosec' and description = 'Mimari Proje — kalan %50'
   );

  -- Tadilat Faz 1 — kalan %40, vade henüz belli değil
  insert into debt_records (person_name, type, amount, currency, description,
                            transaction_date, due_date, is_settled, notes, user_id)
  select 'İnfosec', 'alacak', 531378.67, 'TRY', 'Tadilat Faz 1 — kalan %40',
         '2026-10-20', null, false,
         'Toplam iş 1.328.446,67 KDV dahil · %60 (797.068) tahsil edildi · vade girilmeli', owner
   where not exists (
     select 1 from debt_records
      where person_name = 'İnfosec' and description = 'Tadilat Faz 1 — kalan %40'
   );
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select person_name, description, amount, due_date, is_settled
--   from debt_records where person_name = 'İnfosec' order by due_date nulls last;
