# Nómada API

API móvil de **Nómada · Explora Guatemala**, diseñada para Cloudflare Workers, PostgreSQL mediante Hyperdrive y archivos privados/públicos en Cloudflare R2.

## Incluye

- Registro local o extranjero, inicio/cierre de sesión y rotación de refresh tokens.
- Contraseñas PBKDF2-SHA256, JWT de corta duración y sesiones revocables.
- Recuperación y cambio de contraseña.
- Perfil, avatar, privacidad y certificación de identidad.
- Destinos, publicaciones, multimedia, likes y comentarios.
- Validación de visitas por radio GPS, evidencia, sellos y pasaporte digital.
- Integración de transición con Supabase Auth mediante `@supabase/server` y su adaptador oficial para Hono.
- Swagger UI en `/api/v1/docs` y especificación OpenAPI en `/api/v1/openapi.json`.
- 18 tablas PostgreSQL, migración inicial y datos semilla.

## Estructura del código

- `src/index.ts`: arranque del Worker, middleware y registro de rutas.
- `src/docs.ts` y `src/openapi.ts`: Swagger UI y spec OpenAPI.
- `src/db/`: acceso a datos y esquema Drizzle.
- `src/lib/`: seguridad, medios y utilidades compartidas.
- `src/middleware/`: autenticación.
- `src/routes/README.md`: mapa funcional de los grupos de rutas.

## Desarrollo local

Requisitos: Node `22.13+`, PostgreSQL y una base llamada `nomada`.

```powershell
Copy-Item .dev.vars.example .dev.vars
Copy-Item .env.example .env
npm install
npm run db:migrate
psql $env:DATABASE_URL -f migrations/seed.sql
npm run dev
```

El comando expone la API en `http://IP-DE-TU-PC:8787`, por lo que también puede consumirla Expo Go desde un teléfono conectado a la misma red.
Por defecto utiliza el PostgreSQL remoto indicado en `.env.supabase`. Para trabajar contra el contenedor PostgreSQL local usa `npm run dev:local`.

Configura una clave `JWT_SECRET` aleatoria de al menos 32 caracteres en `.dev.vars`. La app debe usar:

```text
EXPO_PUBLIC_API_URL=http://IP-DE-TU-PC:8787/api/v1
```

En un teléfono físico, `localhost` apunta al teléfono; usa la IP LAN de la computadora.

La URL pública de producción del Worker es:

```text
https://api-nomada.innovasoftgt.com/api/v1
```

## Cloudflare

1. Crea una instancia PostgreSQL administrada (Neon, Supabase, AWS RDS u otra con conexión pública/TLS).
2. Ejecuta la migración con `DATABASE_URL` apuntando a producción.
3. Crea Hyperdrive con la cadena de PostgreSQL y reemplaza su ID en `wrangler.jsonc`.
4. Los buckets de producción ya están definidos: `nomada-fotos-usuarios` y `nomada-documentos`.
5. Guarda el secreto y despliega:

```powershell
npx wrangler secret put JWT_SECRET
npm run deploy
```

No subas `.dev.vars`, `.env` ni cadenas de conexión al repositorio.

### Almacenamiento R2

| Binding | Bucket | Rutas |
|---|---|---|
| `FOTOS` | `nomada-fotos-usuarios` | `perfil/{userId}/`, `publicaciones/{userId}/`, `visitas/{userId}/` |
| `DOCUMENTOS` | `nomada-documentos` | `certificaciones/{userId}/` |

Usa `POST /api/v1/media?kind=profile|post|visit|identity` con el cuerpo binario de una imagen JPEG, PNG o WebP (máximo 10 MB). Para identidad usa además `slot=dpi-front|dpi-back|passport-front|passport-back|selfie`.

Las fotos de perfil y publicaciones se pueden consultar mediante `GET /api/v1/media/fotos/:key`. La evidencia de visita necesita el token de su propietario. Los documentos se leen solamente mediante `GET /api/v1/media/documentos/:key` con la sesión del propietario y nunca tienen una URL pública.

`createMultipartUpload()` inicia una carga multipart; no genera una URL temporal de descarga. Para documentos privados se usa el endpoint autenticado anterior. Para descargas mediante URL firmada se requeriría firmar una petición S3 compatible desde el Worker.

### Supabase Auth

La URL, la clave publicable y JWKS están configuradas. Coloca la clave secreta completa únicamente en `.dev.vars` para desarrollo y en Cloudflare para producción:

```powershell
npx wrangler secret put SUPABASE_SECRET_KEY
```

No envíes ni guardes `SUPABASE_SECRET_KEY` en archivos versionados. El endpoint `GET /api/v1/supabase/me` acepta `Authorization: Bearer <token-de-Supabase>` y valida el JWT mediante JWKS.

Para mover también las tablas desde PostgreSQL local a Supabase/Hyperdrive hace falta copiar desde Supabase la cadena de conexión y establecerla como `DATABASE_URL`/`SUPABASE_DB_URL`. Las claves HTTP no reemplazan esa cadena SQL.

## Pendiente de proveedor externo

El backend genera y almacena de forma segura los tokens para verificar correo y recuperar contraseña. Antes de producción hay que conectar un proveedor transaccional (por ejemplo, Resend) para enviar los enlaces; los tokens solo aparecen en la respuesta cuando `APP_ENV=development`.

## Rutas principales

| Área | Métodos y rutas |
|---|---|
| Salud | `GET /api/v1/health` |
| Acceso | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Recuperación | `POST /auth/forgot-password`, `/auth/reset-password` |
| Cuenta | `GET /me`, `PATCH /me/profile`, `POST /me/change-password` |
| Contenido | `GET/POST /posts`, likes y comentarios |
| Explorar | `GET /destinations`, `GET /destinations/:id` |
| Multimedia | `POST /media?kind=profile|post|visit|identity`, `GET /media/:key` |
| Certificación | `POST /verification`, `GET /verification/status` |
| Pasaporte | `POST /visits/validate`, `GET /passport` |

Las rutas privadas requieren `Authorization: Bearer <accessToken>`.
