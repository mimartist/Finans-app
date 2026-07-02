-- ============================================================================
-- GÜVENLİK MİGRASYONU: user_id kolonları + Row Level Security (RLS)
--
-- Bu migration'dan önce anon key'i bilen HERKES tüm tabloları okuyup
-- yazabiliyordu (giriş ekranı sadece görseldi). Bu migration:
--   1. Tüm çekirdek tablolara user_id kolonu ekler (yoksa)
--   2. Mevcut kayıtları ilk kayıtlı kullanıcıya atar
--   3. RLS'i açar: yalnızca giriş yapmış kullanıcılar erişebilir
--   4. recurring_payments'a ödeme geri alma için account_id/account_amount ekler
--
-- Politikalar bilinçli olarak esnek: user_id NULL olan eski kayıtlar da
-- görünür kalır (tek kullanıcılı kurulum). Çok kullanıcılı kullanacaksanız
-- politikalardaki "user_id is null or" kısmını kaldırın.
--
-- UYGULAMA SIRASI: Önce yeni kodu deploy edin, sonra bunu çalıştırın.
-- NOT: RLS açıldıktan sonra cron/push için Vercel'de SUPABASE_SERVICE_ROLE_KEY
-- tanımlı olmalıdır (Supabase Dashboard > Settings > API > service_role).
-- ============================================================================

-- 1) user_id kolonları
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts','loans','credit_cards','credit_card_statements',
    'credit_card_transactions','recurring_expenses','recurring_payments',
    'debt_records','investments','investment_snapshots'
  ] loop
    execute format(
      'alter table if exists public.%I add column if not exists user_id uuid references auth.users(id) on delete cascade',
      t
    );
  end loop;
end $$;

-- 2) Ödeme geri alma için: hangi hesaptan ne kadar düşüldüğü
alter table if exists public.recurring_payments
  add column if not exists account_id bigint references public.accounts(id) on delete set null;
alter table if exists public.recurring_payments
  add column if not exists account_amount numeric;

-- 3) Mevcut kayıtları ilk kullanıcıya ata (tek kullanıcılı kurulum varsayımı)
do $$
declare
  owner uuid;
  t text;
begin
  select id into owner from auth.users order by created_at limit 1;
  if owner is not null then
    foreach t in array array[
      'accounts','loans','credit_cards','credit_card_statements',
      'credit_card_transactions','recurring_expenses','recurring_payments',
      'debt_records','investments','investment_snapshots'
    ] loop
      execute format('update public.%I set user_id = %L where user_id is null', t, owner);
    end loop;
  end if;
end $$;

-- 4) RLS: kullanıcıya özel tablolar
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts','loans','credit_cards','credit_card_statements',
    'credit_card_transactions','recurring_expenses','recurring_payments',
    'debt_records','investments','investment_snapshots'
  ] loop
    execute format('alter table if exists public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id is null or user_id = auth.uid()) with check (user_id is null or user_id = auth.uid())',
      t || '_owner_all', t
    );
  end loop;
end $$;

-- 5) RLS: global tablolar (döviz kurları herkese ortak, girişli kullanıcı erişir)
alter table if exists public.exchange_rates enable row level security;
drop policy if exists exchange_rates_authenticated on public.exchange_rates;
create policy exchange_rates_authenticated on public.exchange_rates
  for all to authenticated using (true) with check (true);

-- 6) RLS: push abonelikleri (API rotası kullanıcı token'ı ile yazar,
--    cron service_role ile okur — service_role RLS'ten muaftır)
alter table if exists public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_owner on public.push_subscriptions;
create policy push_subscriptions_owner on public.push_subscriptions
  for all to authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());
