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

## Alcance de la versión 0.1

- Noches independientes, creación y selección.
- Clubes sin jugadores ni plantillas, contactos opcionales ficticios (máximo tres) y control de duplicados por noche.
- Reparto explícito en torneos de 4, 6 u 8, por sorteo, orden o selección manual. Revisión antes de confirmar; todos los clubes deben aparecer una vez.
- Enfrentamientos de liga, cruces y máximo de cinco partidos por equipo.
- Persistencia local mediante AsyncStorage; las escrituras se serializan y se comprueban antes de actualizar la interfaz. Los errores de lectura no sobrescriben datos automáticamente.

Esta versión no tiene servidor, autenticación ni sincronización entre dispositivos. No introducir teléfonos reales. El panel del organizador representa el flujo inicial; no constituye un control de permisos. Antes de habilitar la inscripción de capitanes hay que implementar identidad y autorización en servidor.

Pendiente: admisión y vínculo de capitanes/clubes, roles, privacidad de contactos, cupos/bajas/reservas, puntos/desempates, confirmación de resultados y horarios por partido. No se asumen las decisiones pendientes del documento de traspaso.

El prototipo de Sites permanece en `/workspace/sites/relampagos` como referencia del flujo. Esta app es un proyecto independiente en `/workspace/relampagos`.
