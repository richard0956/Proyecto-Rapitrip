-- Repartidor, etapa 1a: valor del rol.
-- Va sola en su migración: un valor nuevo de enumeración no se puede usar en la misma transacción que lo crea.
-- Diseño: docs/informe/2026-10-23-repartidor-revision-evidencias-y-consolas.md.
alter type identity.app_role add value if not exists 'repartidor';
