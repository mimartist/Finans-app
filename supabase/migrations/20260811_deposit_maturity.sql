-- Vadeli mevduat alanları.
--
-- Sorun: vadeli hesaplar sadece bakiye olarak tutuluyordu; vade tarihi, faiz
-- oranı ve vade sonu değeri yalnızca not alanında düz metin olarak duruyordu.
-- Bu yüzden mevduat geliri uygulamada hiçbir yerde görünmüyordu.
--
-- Çözüm: bu üç bilgi gerçek kolon olur, getiri hesaplanabilir hale gelir.
-- Getiri = maturity_value - balance (bankanın verdiği vade sonu tutarı esas
-- alınır; stopaj/gün sayısı varsayımı yapılmaz).

alter table accounts add column if not exists maturity_date  date;
alter table accounts add column if not exists maturity_value numeric;
alter table accounts add column if not exists interest_rate  numeric;

comment on column accounts.maturity_date  is 'Vadeli hesaplarda vade bitiş tarihi';
comment on column accounts.maturity_value is 'Vade sonunda ele geçecek toplam tutar (banka bildirimi)';
comment on column accounts.interest_rate  is 'Yıllık brüt faiz oranı (%)';

-- ── Mevcut iki mevduatın bilgilerini doldur (11.08.2026 verisi) ─────────────
update accounts
   set maturity_date  = '2026-09-08',
       maturity_value = 2882527.13,
       interest_rate  = 40.75
 where name = 'Vadeli Mevduat 1' and is_active is true;

update accounts
   set maturity_date  = '2026-08-28',
       maturity_value = 927014.80,
       interest_rate  = 41.5
 where name = 'Vadeli Mevduat 2' and is_active is true;
