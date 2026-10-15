create or replace function public.update_my_profile(p_full_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old identity.profile_pii;
  v_name text := btrim(p_full_name);
  v_changed text[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception 'el nombre debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  if p_phone is not null and p_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'teléfono inválido' using errcode = '22023';
  end if;

  select * into v_old from identity.profile_pii where user_id = auth.uid() for update;
  if not found then
    raise exception 'perfil inexistente' using errcode = 'P0002';
  end if;

  if v_old.full_name is distinct from v_name then v_changed := array_append(v_changed, 'full_name'); end if;
  if v_old.phone is distinct from p_phone then v_changed := array_append(v_changed, 'phone'); end if;

  update identity.profile_pii
     set full_name = v_name, phone = p_phone, updated_at = now()
   where user_id = auth.uid();

  if array_length(v_changed, 1) > 0 then
    perform private.write_audit('profile.updated', 'profile', auth.uid()::text, null,
      jsonb_build_object('changed_fields', to_jsonb(v_changed)));
  end if;
end $$;

revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;