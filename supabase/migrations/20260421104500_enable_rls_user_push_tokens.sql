alter table public.user_push_tokens enable row level security;

-- Allow anon key clients to read and insert push tokens.
-- NOTE: This is permissive because the app does not use Supabase Auth JWT.
create policy "anon_select_user_push_tokens"
on public.user_push_tokens
for select
to anon
using (true);

create policy "anon_insert_user_push_tokens"
on public.user_push_tokens
for insert
to anon
with check (true);

