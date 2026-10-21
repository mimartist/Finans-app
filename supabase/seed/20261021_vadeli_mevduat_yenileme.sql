-- ============================================================================
-- VADELİ MEVDUAT — yenileme · 21 Ekim 2026
--
-- Garanti · 3.200.000 TL · brüt %38 · 32 gün · vade 13.11.2026
-- Banka bildirimi: vade sonu 3.287.951 TL (getiri 87.951)
--
-- 12.10.2026'da vadesi dolan 2.850.000'lik mevduatın yenilenmiş hâli
-- (32 gün geri sayınca başlangıç 12.10.2026'ya denk geliyor).
--
-- STOPAJ DÜZELTMESİ: bankanın verdiği 3.287.951 rakamından geri hesaplayınca
-- stopaj %15 değil %17,50 çıkıyor. Aynı varsayımla eski iki mevduatın banka
-- rakamları da tam 32 güne oturuyor — yani konvansiyon kesinleşti:
--     net getiri = anapara × oran × gün/365 × 0,825
-- Uygulamadaki simülasyonun varsayılan stopajı da 17,5'e çekildi.
-- ============================================================================

update accounts
   set name           = 'Vadeli Mevduat',
       bank           = 'Garanti',
       balance        = 3200000,
       maturity_date  = '2026-11-13',
       maturity_value = 3287951,
       interest_rate  = 38,
       notes          = 'Garanti · 32 gün · brüt %38 · stopaj %17,5 · vade 13.11.2026'
 where type = 'vadeli' and is_active is true;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, bank, balance, interest_rate, maturity_date, maturity_value,
--        maturity_value - balance as getiri
--   from accounts where type = 'vadeli' and is_active;
