-- ============================================================================
-- 21 EKİM 2026 (5) — TAŞERON/PERSONEL İSİMLERİ + BTD ÖDEMESİNİN KAYDI
--
--   BTD                 → inşaat ve mekanik işleri
--   Uğur Sude Elektrik  → elektrik işleri
--   Yüksel Artık        → personel
--
-- Bugün BTD'ye gönderilen 240.000, mekanik/inşaat kaleminin 1. ödemesi.
-- Denizbank'tan çıktığı için ödeme kaydına hesap bilgisi de yazılıyor; böylece
-- uygulamadan geri alınırsa bakiye otomatik iade edilir.
--
-- Denizbank bakiyesi (318.037) bu ödeme DÜŞÜLMÜŞ hâliyle girilmişti, bu yüzden
-- burada bakiyeye tekrar dokunulmuyor.
--
-- Uğur Sude Elektrik'in 21.10 tarihli 240.000'i ödenmedi olarak bırakıldı —
-- ödendiyse uygulamadan işaretle (yöntem: Hesaptan → ilgili banka).
-- ============================================================================

-- Geri alma için gereken kolonlar (bazı kurulumlarda yoktu)
alter table if exists public.recurring_payments
  add column if not exists account_id bigint references public.accounts(id) on delete set null;
alter table if exists public.recurring_payments
  add column if not exists account_amount numeric;

do $$
declare
  owner    uuid;
  e_btd    bigint;
  a_deniz  bigint;
begin
  select id into owner from auth.users order by created_at limit 1;
  select id into a_deniz from accounts
   where name = 'Denizbank Vadesiz' and is_active is true limit 1;

  -- ── 1. GERÇEK İSİMLER ────────────────────────────────────────────────────
  update recurring_expenses set name = 'İnfosec Tadilat — BTD İnşaat/Mekanik (1. ödeme)'
   where name = 'İnfosec Tadilat — Mekanik/İnşaat (1. ödeme)';
  update recurring_expenses set name = 'İnfosec Tadilat — BTD İnşaat/Mekanik (son ödeme)'
   where name = 'İnfosec Tadilat — Mekanik/İnşaat (son ödeme)';

  update recurring_expenses set name = 'İnfosec Tadilat — Uğur Sude Elektrik (1. ödeme)'
   where name = 'İnfosec Tadilat — Elektrik (1. ödeme)';
  update recurring_expenses set name = 'İnfosec Tadilat — Uğur Sude Elektrik (son ödeme)'
   where name = 'İnfosec Tadilat — Elektrik (son ödeme)';

  update recurring_expenses set name = 'İnfosec Tadilat — Personel Yüksel Artık (Kasım)'
   where name = 'İnfosec Tadilat — Personel (Kasım)';
  update recurring_expenses set name = 'İnfosec Tadilat — Personel Yüksel Artık (Aralık)'
   where name = 'İnfosec Tadilat — Personel (Aralık)';

  update recurring_expenses set name = 'İnfosec Tadilat — Yüksel Artık iş avansı'
   where name = 'İnfosec Tadilat — Yüksel iş avansı';

  -- ── 2. BTD'NİN 240.000'İ ÖDENDİ ──────────────────────────────────────────
  select id into e_btd from recurring_expenses
   where name = 'İnfosec Tadilat — BTD İnşaat/Mekanik (1. ödeme)'
     and expense_date = '2026-10-21' limit 1;

  if e_btd is not null and not exists (
    select 1 from recurring_payments
     where expense_id = e_btd and period_year = 2026 and period_month = 10
  ) then
    insert into recurring_payments (expense_id, period_year, period_month, amount,
                                    is_paid, paid_date, notes,
                                    account_id, account_amount, user_id)
    values (e_btd, 2026, 10, 240000, true, '2026-10-21', null,
            a_deniz, 240000, owner);
  end if;
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select e.name, e.amount, e.expense_date,
--        coalesce((select sum(p.amount) from recurring_payments p
--                   where p.expense_id = e.id and p.is_paid), 0) as odenen
--   from recurring_expenses e
--  where e.name like 'İnfosec%' and e.is_active
--  order by e.expense_date;
