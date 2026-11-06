-- Dispara la función `send-outbox` cada minuto (correos y WhatsApp encolados). En local lo hace `pnpm outbox:loop`.
-- El secreto y la URL no viven en el repositorio: se guardan en Vault, una sola vez por entorno, con:
--   select vault.create_secret('<OUTBOX_SECRET>', 'outbox_secret');
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-outbox', 'outbox_url');
-- Sin esos dos valores la tarea no hace nada (así local y pruebas no llaman a ningún sitio).

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function private.invoke_send_outbox()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
  v_url text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'outbox_secret' limit 1;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'outbox_url' limit 1;
  if coalesce(v_secret, '') = '' or coalesce(v_url, '') = '' then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-outbox-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
end $$;
revoke all on function private.invoke_send_outbox() from public, anon, authenticated, service_role;

select cron.unschedule('send-outbox') where exists (select 1 from cron.job where jobname = 'send-outbox');
select cron.schedule('send-outbox', '* * * * *', 'select private.invoke_send_outbox()');
