-- Notification preferences per user
create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_confirmations boolean not null default true,
  order_updates boolean not null default true,
  distribution_alerts boolean not null default true,
  account_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_user_id_key unique (user_id)
);

-- RLS
alter table notification_preferences enable row level security;

create policy "Users can read own notification preferences"
  on notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own notification preferences"
  on notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification preferences"
  on notification_preferences for update
  using (auth.uid() = user_id);
