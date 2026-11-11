# MCM · Torneos Relámpago

App independiente de ConvoSquad, creada con React Native, Expo y TypeScript para iOS, Android y tablets. La vista web del mismo código se publica en https://mcm-torneos-relampago.netlify.app para revisar cambios juntos.

## Navegación y diseño

Menú lateral: Inicio, Torneos, Mi Club, Palmarés y Ajustes. Torneos agrupa Noches, Inscritos y Relámpagos. El menú es fijo a partir de 900 puntos de ancho; en móvil admite botón y gesto lateral.

Paleta vinotinto centralizada en `src/theme.ts`. Logo original MCM, sin recortes ni recoloración, en el acceso, Inicio y menú. El icono cuadrado sigue siendo provisional.

## Cuentas y servidor

Proyecto Supabase independiente: `mkbvplehrbjrufhkcqun`, en la organización elegida por el propietario. No se han copiado cuentas, contraseñas, clubes ni datos de ConvoSquad.

- Acceso con ID de EA y contraseña. Al crear cuenta se pide correo para confirmación y futura recuperación; no se publica.
- Las contraseñas las gestiona Supabase Auth. `ea-auth` resuelve el ID de EA a correo exclusivamente en servidor y limita los intentos por identificador.
- Cada cuenta nueva es capitán. El rol de administrador se concede desde el servidor tras identificar al propietario; no basta con escribir un nombre o modificar metadatos.
- Un capitán crea un club, gestiona hasta tres contactos opcionales y lo inscribe en las noches abiertas.
- Si el club fue añadido manualmente, un administrador vincula su capitán por ID de EA.
- RLS y RPCs comprobados en servidor limitan las acciones: solo administradores crean noches, añaden o retiran inscripciones y confirman repartos. Los capitanes solo inscriben su propio club.
- Los contactos solo se leen por su capitán y los administradores.
- Las inscripciones se numeran en servidor con bloqueo transaccional por noche. La lista respeta ese número; retirar un club no renumera los restantes. El sorteo predeterminado afecta al reparto entre torneos, no al orden de llegada.
- El cliente consulta los datos al entrar, al volver al primer plano, cada 20 segundos y al pulsar Actualizar. Las escrituras no se confirman sin respuesta del servidor.
- Sesiones nativas en Expo SecureStore (con fragmentación para respetar límites de tamaño); en web, almacenamiento local. Cerrar sesión elimina el acceso en este dispositivo.

## Desarrollo

```sh
npm ci
cp .env.example .env
# Completar únicamente la URL y la clave publicable del proyecto MCM.
npx expo start
```

Sin esas variables se conserva el prototipo local, aislado del servidor; no simula un login. Los datos de prueba locales no se migran automáticamente.

```sh
npm run typecheck
npm test
npx expo export --platform all --max-workers 2
npm run build:web
```

`tests/database.test.mjs` aplica el SQL real a PostgreSQL aislado con PGlite y prueba RLS, roles, privacidad, duplicados, numeración, cierre y rollback. Los flujos visuales se revisan con API simulada; esto no equivale a comprobar un acceso válido real ni a probar dispositivos físicos. Ver `supabase/README.md` para despliegue y configuración de Auth.

## Publicación

Netlify aloja la exportación web; no genera APK ni versiones iOS. `netlify.toml` configura `npm run build:web`, salida `dist`, fallback SPA y caché para los bundles. `public/_redirects` permite también despliegues manuales.

```sh
npm run build:web
npx --yes netlify-cli deploy --prod --dir dist --no-build
```

Las dos variables `EXPO_PUBLIC_SUPABASE_*` son públicas y están configuradas en Netlify. Nunca introducir credenciales de servicio en variables `EXPO_PUBLIC_*`, código cliente ni Git. `.netlify/` y `.env` se excluyen del repositorio.

`eas.json` prepara perfiles de APK de pruebas, simulador iOS y producción. Falta vincular un proyecto EAS propio, decidir los identificadores y configurar firma antes de producir instalables.

## Próximo alcance

Marcadores, puntos/desempates, sanciones, cupos/reservas, bajas posteriores al cierre, horarios de cada partido y recuperación de contraseña desde la app. Palmarés permanece vacío hasta registrar campeones confirmados. Los formatos de 4, 6 y 8 mantienen el límite de cinco partidos por club.
