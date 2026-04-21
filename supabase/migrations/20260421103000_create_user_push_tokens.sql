create table if not exists public.user_push_tokens (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  token text not null,
  platform text not null default 'expo',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint user_push_tokens_pkey primary key (id),
  constraint user_push_tokens_user_id_fkey
    foreign key (user_id) references public.user_profiles (id) on delete cascade,
  constraint user_push_tokens_user_token_unique unique (user_id, token)
) tablespace pg_default;

create index if not exists idx_user_push_tokens_user_id
  on public.user_push_tokens using btree (user_id) tablespace pg_default;

create index if not exists idx_user_push_tokens_platform
  on public.user_push_tokens using btree (platform) tablespace pg_default;

