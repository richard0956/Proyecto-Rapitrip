# Despliegue (pruebas)

Flujo simple: **GitHub Actions** prueba y despliega Supabase; **Vercel** despliega las tres apps desde el repositorio.

```
push / PR ──► ci.yml (pgTAP, Deno, Vitest, tipos, lint, build, e2e)
merge a main ─► ci verde ─► deploy-supabase.yml (migraciones + Edge Functions)
              └► Vercel construye y publica store, console y courier (cada una con su filtro de cambios)
```

## 1. Vercel (una sola vez)

Crea **tres proyectos** en Vercel importando este mismo repositorio. En cada uno, *Root Directory* distinto
(el `vercel.json` de cada app ya trae install, build e `ignoreCommand`):

| Proyecto | Root Directory |
|---|---|
| Tienda | `apps/store` |
| Consola | `apps/console` |
| Repartidor | `apps/dealer` |

Rama de producción: `main`. Cada PR genera una vista previa.

Variables de entorno de cada proyecto (Settings → Environment Variables); los nombres están en `.env.example`:
- Las tres: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (y las `SUPABASE_*` de servidor que indique `.env.example`).
- Tienda: `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL` y las de Stripe público.
- Las `NEXT_PUBLIC_*` se incrustan al compilar: si las cambias, vuelve a desplegar.

## 2. GitHub (una sola vez)

Settings → Secrets and variables → Actions → *New repository secret*:
- `SUPABASE_ACCESS_TOKEN`: token personal de Supabase (Account → Access Tokens).
- `SUPABASE_DB_PASSWORD`: contraseña de la base de producción.

Settings → Environments → `production` (opcional): marca *Required reviewers* para que un humano apruebe cada despliegue de base de datos.

Recomendado: en Settings → Branches protege `main` exigiendo que `ci` pase antes de fusionar.

## 3. Lo que no automatiza el flujo
- Los **secretos de las Edge Functions** (`supabase secrets set …`): se cargan a mano y no cambian en cada despliegue.
- El **disparo de `send-outbox`** ya corre en producción con `pg_cron` (migración 97); su secreto vive en Vault.
- Las migraciones son hacia adelante: no se editan las ya aplicadas, se crea una nueva.

## 4. Probar el despliegue
1. Abre un PR: el CI corre y Vercel publica una vista previa.
2. Fusiona a `main`: corre `deploy-supabase` (también puedes lanzarlo a mano en Actions → *Run workflow*).
3. Revisa en Actions que `Migraciones pendientes (vista previa)` liste solo lo esperado.
