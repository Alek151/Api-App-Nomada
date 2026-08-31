# Estructura de rutas

El Worker expone sus rutas por dominio en `src/index.ts`, pero la API ya está documentada por dominios en Swagger y el mapa OpenAPI está separado en `src/openapi.ts`.

Agrupación funcional:

- `Auth`: registro, login, refresh, logout, recuperación.
- `Account`: perfil, contraseña, sesión.
- `Media`: buckets R2 públicos y privados.
- `Destinations`: catálogo de lugares.
- `Posts`: feed, likes y comentarios.
- `Verification`: certificación de identidad.
- `Passport`: visitas y sellos.
