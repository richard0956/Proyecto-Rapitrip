create table private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null check (template in ('commerce_approved', 'commerce_rejected', 'incident_alert')),
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pendiente' check (status in ('pendiente', 'enviando', 'enviado', 'fallido')),
  attempts int not null default 0,
  last_error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table private.email_outbox enable row level security;
revoke all on private.email_outbox from public, anon, authenticated, service_role;

create or replace function private.enqueue_email(p_to text, p_template text, p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into private.email_outbox (to_email, template, data)
  values (lower(btrim(p_to)), p_template, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.claim_outbox(p_limit int default 20)
returns table (id uuid, to_email text, template text, data jsonb, attempts int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with c as (
    select o.id from private.email_outbox o
    where (o.status in ('pendiente', 'fallido') and o.attempts < 5)
       or (o.status = 'enviando' and o.claimed_at < now() - interval '10 minutes')
    order by o.created_at
    limit greatest(p_limit, 1)
    for update skip locked)
  update private.email_outbox o
     set status = 'enviando', attempts = o.attempts + 1, claimed_at = now()
    from c
   where o.id = c.id
  returning o.id, o.to_email, o.template, o.data, o.attempts;
end $$;

create or replace function public.mark_outbox(p_id uuid, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update private.email_outbox
     set status = case when p_ok then 'enviado' else 'fallido' end,
         last_error = left(p_error, 500),
         sent_at = case when p_ok then now() else null end
   where id = p_id;
end $$;

revoke all on function public.claim_outbox(int) from public, anon, authenticated;
revoke all on function public.mark_outbox(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_outbox(int) to service_role;
grant execute on function public.mark_outbox(uuid, boolean, text) to service_role;