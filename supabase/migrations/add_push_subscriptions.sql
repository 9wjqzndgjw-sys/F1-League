create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid references managers(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  unique(endpoint)
);

alter table push_subscriptions enable row level security;

create policy "managers can manage own subscriptions"
  on push_subscriptions for all
  using (manager_id = auth.uid())
  with check (manager_id = auth.uid());
