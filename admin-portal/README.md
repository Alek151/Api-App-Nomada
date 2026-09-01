# Nómada · Portal de administración

Portal web independiente para administrar viajeros, destinos, sellos, insignias, certificaciones, publicaciones y métricas de Nómada.

## Conexión en Cloudflare Workers

En **Workers & Pages → Create → Connect to Git**, selecciona el repositorio `Api-App-Nomada` y la rama `main`.

- **Root directory:** `admin-portal`
- **Build command:** `npm ci && npm run build`
- **Deploy command:** `npx wrangler deploy`

El archivo `wrangler.jsonc` ya declara el Worker `nomada-admin` y el dominio personalizado `adminapp-nomada.innovasoftgt.com`.

## Variables del Worker web

En Cloudflare agrega estas variables de build:

- `VITE_NOMADA_API_URL=https://api-nomada.innovasoftgt.com/api/v1`
- `VITE_GOOGLE_MAPS_API_KEY=<clave web restringida>`

La clave de Google Maps debe ser nueva y restringida por referente HTTP a:

`https://adminapp-nomada.innovasoftgt.com/*`

Habilita **Maps JavaScript API**. Agrega **Places API (New)** únicamente cuando se incorpore autocompletado de direcciones.

## Primer administrador

El portal solo permite cuentas con `users.role = 'admin'`. Promueve la primera cuenta desde PostgreSQL y después administra las demás desde el portal:

```sql
UPDATE users SET role = 'admin', updated_at = now()
WHERE email = 'tu-correo-administrativo@dominio.com';
```

La vista principal muestra actividad turística agregada. El historial individual de visitas solo se consulta desde el perfil de un viajero, requiere rol administrativo y se registra en `admin_audit_logs`.
