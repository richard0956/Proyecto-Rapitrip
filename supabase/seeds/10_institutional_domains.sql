-- Solo para el entorno local: los dominios de las cuentas de demostración y de las pruebas E2E cuentan como institucionales.
-- En producción los agrega la dirección desde la consola (Configuración → Correos institucionales).
insert into identity.institutional_domains (domain) values ('demo.rapitrip.test'), ('e2e.test') on conflict do nothing;
