-- Fotos de las devoluciones: bucket privado. Cada cliente sube solo a su carpeta (<id_cliente>/...).
-- Solo administración puede leer las fotos para decidir.

insert into storage.buckets (id, name, public)
values ('devoluciones', 'devoluciones', false)
on conflict (id) do nothing;

create policy return_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'devoluciones' and (storage.foldername(name))[1] = auth.uid()::text and private.has_valid_session());

create policy return_photos_read_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'devoluciones' and private.is_admin_console());
