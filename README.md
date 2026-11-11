# Relámpagos · app móvil

Proyecto independiente de ConvoSquad, creado con React Native, Expo y TypeScript. Nombre provisional. Objetivos: iOS, Android y tablets; menú lateral con gesto en móvil y fijo a partir de 900 puntos de ancho. La exportación web es una herramienta de revisión del mismo código móvil.

## Ejecutar

```sh
npm ci
npx expo start
```

Abrir con una versión compatible de Expo Go en iPhone/Android o en emulador. `npm run android` / `npm run ios` requieren emulador o simulador en el equipo anfitrión. Un teléfono no puede acceder directamente al localhost de este entorno remoto; se necesita una conexión Expo accesible o una compilación EAS.

```sh
npm run typecheck
npm test
npx expo export --platform all
```

`eas.json` prepara perfiles de APK de pruebas, simulador iOS y producción. Antes de compilar hay que vincular un proyecto EAS propio, decidir los identificadores de paquete/bundle y configurar la firma. No se han creado recursos de Apple/Google ni se han reutilizado credenciales de ConvoSquad.

## Navegación

Menú lateral: Inicio, Torneos, Mi Club, Palmarés y Ajustes. Torneos agrupa Noches, Inscritos y Relámpagos. Mi Club y Palmarés muestran estados iniciales hasta implementar vinculación de cuentas y campeones confirmados.

## Logo

Logo original MCM Torneos Relámpago, incorporado en el menú e Inicio mediante `BrandLogo`. Se conserva la imagen sin recortes ni modificaciones, con fondo negro y acento violeta. El icono cuadrado sigue siendo provisional.

## Identidad visual

Paleta vinotinto: borgoña profundo `#4A1025`, principal `#7A1F3D`, rosa suave `#F3BCCB` y marfil `#FAF6F4`. Colores semánticos centralizados en `src/theme.ts`; se aplican al menú, botones, tarjetas, formularios e iconos de la app.

## Alcance de la versión 0.1

- Noches independientes, creación y selección.
- Clubes sin jugadores ni plantillas, contactos opcionales ficticios (máximo tres) y control de duplicados por noche.
- Reparto explícito en torneos de 4, 6 u 8, por sorteo aleatorio (predeterminado confirmado por el usuario), orden o selección manual. Revisión antes de confirmar; todos los clubes deben aparecer una vez.
- Enfrentamientos de liga, cruces y máximo de cinco partidos por equipo.
- Persistencia local mediante AsyncStorage; las escrituras se serializan y se comprueban antes de actualizar la interfaz. Los errores de lectura no sobrescriben datos automáticamente.

Esta versión no tiene servidor, autenticación ni sincronización entre dispositivos. No introducir teléfonos reales. El panel del organizador representa el flujo inicial; no constituye un control de permisos. Antes de habilitar la inscripción de capitanes hay que implementar identidad y autorización en servidor.

Pendiente: admisión y vínculo de capitanes/clubes, roles, privacidad de contactos, cupos/bajas/reservas, puntos/desempates, confirmación de resultados y horarios por partido. No se asumen las decisiones pendientes del documento de traspaso.

El prototipo de Sites permanece en `/workspace/sites/relampagos` como referencia del flujo. Esta app es un proyecto independiente en `/workspace/relampagos`.

## Vista compartida en Netlify

La app móvil se exporta a web desde el mismo código para revisar diseño y flujos juntos. `netlify.toml` establece la compilación `npm run build:web`, salida `dist`, fallback SPA y caché para bundles con hash. Netlify aloja esta vista; no genera APK ni compilaciones iOS y no añade sincronización de datos.

```sh
npm ci
npm run build:web
npx netlify-cli login
npx netlify-cli deploy --prod --dir dist --no-build
```

El primer despliegue requiere iniciar sesión y crear o vincular un sitio en una cuenta Netlify. La vinculación local `.netlify/` está excluida de Git. No guardar tokens en el repositorio.
