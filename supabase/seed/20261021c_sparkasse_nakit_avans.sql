-- ============================================================================
-- 21 EKİM 2026 (3) — SPARKASSE DÜZELTME, EVDEKİ NAKİT, YÜKSEL AVANSI
--
--   Sparkasse      300 → 175 EUR (kullanıcı düzeltmesi)
--   Evdeki nakit   30.000 TL — yeni hesap
--   Yüksel         5.000 TL iş avansı, İnfosec projesi kapsamında
--
-- Avans ödenmiş bir proje maliyeti olarak yazılıyor (hem gider kalemi hem de
-- "ödendi" kaydı), böylece gerçekleşen harcama grafiğine ve ay toplamına
-- girer, ödeme listesinde bekleyen kalem olarak durmaz.
--
-- NOT: Bu 5.000, Kasım personel ödemesinden (75.000) mahsup edilecekse
-- söyle, o kalemi 70.000'e çekeyim — yoksa 5.000 iki kez sayılmış olur.
-- ============================================================================

do $$
declare
  owner    uuid;
  e_avans  bigint;
begin
  select id into owner from auth.users order by created_at limit 1;

  -- ── 1. SPARKASSE DÜZELTMESİ ──────────────────────────────────────────────
  update accounts set balance = 175
   where name = 'Sparkasse' and is_active is true;

  -- ── 2. EVDEKİ NAKİT ──────────────────────────────────────────────────────
  if exists (select 1 from accounts where name = 'Nakit (Evde)' and is_active is true) then
    update accounts set balance = 30000
     where name = 'Nakit (Evde)' and is_active is true;
  else
    insert into accounts (name, bank, type, currency, balance, notes, is_active, user_id)
    values ('Nakit (Evde)', 'Nakit', 'vadesiz', 'TRY', 30000, 'Elde tutulan nakit', true, owner);
  end if;

  -- ── 3. YÜKSEL'E VERİLEN İŞ AVANSI ────────────────────────────────────────
  if not exists (
    select 1 from recurring_expenses
     where name = 'İnfosec Tadilat — Yüksel iş avansı' and expense_date = '2026-10-21'
  ) then
    insert into recurring_expenses (name, category, amount, currency, payment_day,
                                    expense_type, expense_date, is_variable,
                                    remind_days_before, is_active, user_id)
    values ('İnfosec Tadilat — Yüksel iş avansı', 'personel', 5000, 'TRY', 21,
            'one_time', '2026-10-21', false, 1, true, owner)
    returning id into e_avans;

    -- Ödenmiş olarak işaretle (nakit) — bakiyeden ayrıca düşülmez,
    -- evdeki 30.000 zaten avans sonrası bildirilen tutar
    insert into recurring_payments (expense_id, period_year, period_month, amount,
                                    is_paid, paid_date, notes, user_id)
    values (e_avans, 2026, 10, 5000, true, '2026-10-21', 'nakit', owner);
  end if;
end $$;

-- ── Kontrol ─────────────────────────────────────────────────────────────────
-- select name, bank, currency, balance from accounts where is_active order by bank, name;
