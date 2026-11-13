# MCMN · Mi cancha, mis normas

App independiente de ConvoSquad, con React Native, Expo y TypeScript para iOS, Android y tablet. La vista web del mismo código se publica en https://mcm-torneos-relampago.netlify.app para revisar cambios juntos.

## Modelo y navegación

Menú lateral: Inicio, Torneos, Mi Club, Palmarés y Ajustes. Torneos abre una lista de competiciones. Cada ficha reúne Información, Inscritos y Competición. «Noches de juego» desaparece de la interfaz; el nombre de tabla `nights` se conserva solo como detalle interno de compatibilidad.

Inicio muestra el torneo en curso; si no lo hay, el primero en preparación por fecha. La selección de otro torneo en el listado no altera Inicio. Se muestran los equipos que siguen dentro, por orden de llegada. «Finalizar torneo» en Competición lo retira de Inicio sin borrar su historial ni asignar resultados.

Un administrador crea el torneo con nombre, fecha, hora de inicio de Madrid y normas. Los capitanes pueden apuntarse mientras siga abierto, incluso si la hora prevista ha pasado: no se cierra por reloj ni se elige un formato automáticamente. El administrador puede ampliar la hora visible y confirmar el formato a partir de esa hora efectiva.

Cada nuevo torneo admite una única Copa o Liga. Los clubes que quedan fuera conservan su inscripción y número de llegada; nunca se reparten automáticamente entre otros torneos. Los repartos antiguos siguen siendo legibles.

| Formato actual | Equipos | Rondas | Máximo por club |
| --- | --- | --- | --- |
| Copa | 4 | Grupo único y final | 4 partidos |
| Copa | 8 | Dos grupos, semifinales cruzadas y final | 5 partidos |
| Liga | 4 | Todos contra todos, sin final | 3 partidos |
| Liga | 6 | Todos contra todos, sin final | 5 partidos |

Si el número de participantes no encaja en las configuraciones disponibles, el administrador revisa los inscritos o concede margen. No se excluye a nadie automáticamente. La generación de los enfrentamientos exige incluir exactamente a quienes siguen dentro y mantiene el máximo de cinco partidos.

## Inscripción por enlace

Desde la ficha, «Compartir torneo» genera `https://mcm-torneos-relampago.netlify.app/torneo/<uuid>`. La ficha pública muestra nombre, horario efectivo, normas, estado y cantidad de inscritos; no expone contactos, cuentas de capitanes ni avisos privados.

El capitán entra o crea su cuenta, vuelve al mismo torneo, crea o vincula su club si es necesario, acepta las normas y confirma. El servidor toma la identidad y el club de la sesión, asigna un número de llegada y trata las repeticiones como la misma inscripción. No hay jugadores, plantillas ni registro de miembros; basta una cuenta de capitán representante.

Los enlaces web mantienen el destino al recargar o autenticarse. El esquema nativo `relampagos://torneo/<uuid>` se reconoce en código; los enlaces universales del sistema y las compilaciones móviles requieren configurar posteriormente los identificadores y la distribución de la app.

## Clasificación y resultados

Cuando el torneo está en curso, Inicio muestra la tabla de Liga o las tablas de grupos y playoffs de Copa. En Competición se consultan las jornadas y los administradores guardan o corrigen marcadores. Las columnas son PJ, Pts, GF, GC y DG; una victoria suma 3 puntos, un empate 1 y una derrota 0. Un partido pendiente no cuenta como 0–0.

El orden deportivo es puntos, diferencia de goles y goles a favor. Los empates exactos se indican con «=»; el orden visual de los empatados no decide una clasificación. En Copa, tras completar los grupos, el administrador confirma los dos primeros de cada uno; el servidor solo permite decidir entre clubes empatados en esos tres criterios. Copa de ocho genera 1.º A–2.º B y 1.º B–2.º A; Copa de cuatro genera la final de su grupo único.

Las eliminatorias empatadas requieren una tanda de penaltis con ganador. Sus goles y resultados no se suman a la tabla de grupos. La final se genera con los ganadores de semifinales. Para corregir un resultado que ya determina un cruce, el administrador debe reiniciar los playoffs con confirmación: se borran solo los cruces y marcadores de eliminatorias y se conservan los grupos. Las versiones de los partidos evitan sobrescribir cambios de otro administrador sin actualizar. Finalizar el torneo bloquea nuevos resultados y conserva sus tablas.

## Cuentas, permisos y moderación

Proyecto Supabase independiente `mkbvplehrbjrufhkcqun`, en la organización elegida por el propietario. No se han copiado cuentas ni datos de ConvoSquad.

- Alta y acceso por ID de EA y contraseña de MCMN de al menos ocho caracteres. No se solicita correo. La identidad interna de Supabase usa un dominio `.invalid` sin correspondencia real.
- Cada alta es capitán. El rol administrativo se concede desde el servidor tras identificar al propietario; nunca se toma de metadatos editables por el usuario.
- Cada capitán representa un club. Si se añadió manualmente, el administrador puede vincularlo a su cuenta. Cada club necesita al menos un teléfono con prefijo internacional (máximo tres). Además del propietario y administradores, pueden leerlo los capitanes de clubes no excluidos que compartan un torneo no finalizado. Inicio e Inscritos permiten abrir un chat de WhatsApp con un mensaje preparado; nunca se envía automáticamente.
- Las inscripciones se serializan por torneo, con hora y número asignados en servidor. Un capitán no puede inscribir otro club ni volver a entrar por su cuenta tras quedar excluido.
- El administrador puede excluir o readmitir un club antes de confirmar la competición. El motivo queda en un aviso privado visible para el capitán y administradores. La readmisión conserva el número original.
- Los baneos de cuentas se gestionan desde Ajustes. Bloquean nuevas acciones y lecturas privadas incluso con un token anterior; los torneos abiertos dejan su club fuera. No cambian partidos confirmados. Quitar un baneo no readmite automáticamente los clubes y no se permite banear administradores desde esta pantalla.
- La interfaz consulta cambios al entrar, al volver al primer plano, cada 20 segundos y con Actualizar. Los avisos de exclusión se muestran en el torneo y Mi Club. **Push pendiente**, como pidió el usuario; no se envían correos ni mensajes externos.
- Sesiones nativas en Expo SecureStore; web en almacenamiento local. Cerrar sesión retira el acceso de ese dispositivo y devuelve a la ficha pública si se entró por enlace.

## Nombre y escudo del club

Al crear o editar el club en Mi Club se puede seleccionar un escudo opcional PNG o JPG, de hasta 2 MB y 4096 × 4096 píxeles. El selector lee el archivo original sin recortar ni usar la conversión a JPEG de ImagePicker; conserva los bytes y el canal alfa del PNG. La vista previa usa `contain` y no añade fondo a la imagen. Se puede reemplazar o quitar el escudo, editar el nombre y los teléfonos en el mismo formulario. Se mantienen el ID del club, sus inscripciones y sus resultados.

`club-profile` verifica la sesión y valida firma, formato y tamaño de la imagen en servidor. Supabase Storage guarda los escudos en un bucket privado, sin escritura directa del cliente; los miembros activos obtienen enlaces firmados de 120 segundos solo para escudos actuales. Se generan nombres aleatorios sin utilizar el nombre de archivo original. Cada edición comprueba una versión para evitar sobrescribir cambios simultáneos; una operación del club bloquea temporalmente una eliminación de cuenta hasta terminar.

Al reemplazar o quitar la imagen se intentan retirar los archivos anteriores; las operaciones posteriores vuelven a limpiar los archivos sobrantes si falla Storage. El borrado de club pasa por la función Edge, que borra las imágenes mediante Storage API antes de eliminar o desvincular el club. El borrado de cuenta bloquea nuevas subidas antes de purgar su carpeta y eliminar Auth. Un fallo de limpieza impide anunciar una eliminación completa.

## Privacidad y eliminación

La política se consulta antes de iniciar sesión y en Ajustes; también está publicada en `/privacidad.html`. Responsable confirmado: Claudio Roldán Ramos. Contacto autorizado por el propietario, tomado del aviso público de ConvoSquad: `convosquad.soporte@gmail.com`. El contenido único está en `src/content/privacy.ts`; `build:web` genera su versión HTML pública sin JavaScript ni seguimiento.

Mi Club permite eliminar el club escribiendo su nombre exacto. Se borran teléfonos y avisos propios, se retiran inscripciones de torneos abiertos y nunca se renumeran los demás inscritos. Si tiene historial, se conserva un club genérico sin nombre original ni propietario para mantener partidos y clasificaciones; si no, se borra el registro. La cuenta permanece activa.

Ajustes permite eliminar perfil y cuenta escribiendo ELIMINAR y la contraseña actual. `account-delete` verifica el JWT con Auth y vuelve a comprobar la contraseña en servidor; no acepta una identidad objetivo del cliente. Una preparación de servicio borra los datos del club y bloquea la cuenta antes de revocar sesiones y eliminar el usuario de Auth. Las relaciones de autoría pasan a NULL, y el perfil se elimina por cascada. Si falla Auth, la cuenta queda sin acceso privado y permite reintentar. La misma opción está disponible para cuentas suspendidas; su autenticación no concede acceso a torneos ni teléfonos.

No se borran cuentas reales como prueba. Los casos de supresión, permisos, tokens antiguos y recuperación tras fallo se validan en PostgreSQL aislado, con servicios simulados y recorridos web interceptados. No se garantiza eliminación inmediata de los registros técnicos o copias de los proveedores ni de contactos o mensajes guardados fuera de MCMN.

## Desarrollo y validación

```sh
npm ci
cp .env.example .env
# Completar solo la URL y la clave publicable del proyecto MCMN.
npx expo start
npm run typecheck
npm test
npx expo export --platform all --max-workers 2
npm run build:web
```

Sin variables de servidor se conserva el prototipo local, aislado de las cuentas reales. Los ejemplos locales no se migran automáticamente.

Las pruebas aplican las migraciones reales a PostgreSQL aislado con PGlite y comprueban permisos, normas, privacidad, numeración, margen, cierre, exclusiones y baneos. Los recorridos visuales de capitán y administrador se revisan con API simulada y no crean cuentas QA ni conceden privilegios en producción. Esa cobertura no equivale a validar un acceso real con contraseña del usuario ni un dispositivo físico.

## Publicación

Netlify exporta la vista web desde `npm run build:web`, salida `dist`. `public/_redirects` y `netlify.toml` permiten abrir directamente los enlaces de torneo. Las claves `EXPO_PUBLIC_SUPABASE_*` son publicables; nunca poner credenciales de servicio en el cliente. `.env`, `.netlify/` y el estado temporal de Supabase están excluidos de Git.

```sh
npm run build:web
npx --yes netlify-cli deploy --prod --dir dist --no-build
```

`eas.json` prepara perfiles de APK, simulador iOS y producción. Falta vincular un proyecto EAS, concretar identificadores y configurar firma antes de producir instalables.

## Alcance pendiente

Reglas avanzadas de desempate, campeones y Palmarés, recuperación de cuentas, varios capitanes por club, notificaciones push y nuevas combinaciones de grupos. Las normas se fijan al crear el torneo; editar reglas tras abrir inscripciones requerirá versionar su aceptación.


## EA y ELO MCMN (primera versión)

Mi Club permite comprobar un enlace público o ID de EA y solicitar su vinculación. Un administrador valida que representa al club de MCMN. El pool `common-gen5` reúne PS5, Xbox Series y PC; se conserva junto al ID y la edición `fc27`, porque el ID por sí solo no identifica un club entre plataformas y ediciones. Un club EA solo puede vincularse a un club MCMN en esa edición/pool. Cambiar el vínculo exige no tener importaciones activas; eliminar el club retira el vínculo personal y candidatos, conservando el resultado deportivo mínimo.

En cada cruce programado, «Buscar resultado en EA» consulta desde el servidor los últimos diez `friendlyMatch` del club local. Filtra por ambos clubes, fecha posterior al inicio efectivo del torneo y a la validación de ambos vínculos, goles recíprocos y ausencia de abandono. Guarda solo esos candidatos saneados, sin jugadores ni el resto del historial EA. No consulta EA en cada refresco de pantalla ni importa en segundo plano. No hay paginación conocida: conviene revisar poco después del partido. Se pueden recuperar candidatos ya guardados en búsquedas anteriores mientras siga vigente su contexto.

El administrador selecciona el candidato, revisa su fecha y confirma que corresponde a la jornada MCMN. Coincidir por clubes y fecha es una ayuda, no una prueba automática. Una fuente EA no puede puntuar en dos encuentros MCMN. Un capitán no puede importar ni validar su propio vínculo. Versiones de partido y vínculo impiden importar búsquedas que quedaron obsoletas. Los empates de eliminatoria requieren introducir la tanda manualmente; abandonos y ausencia de datos se resuelven mediante el registro administrativo. Para cambiar un marcador importado primero se deja pendiente, con las mismas restricciones de playoffs de los resultados manuales.

La base es **1000 ELO**, **K=32** y expectativa `1/(1+10^((rival-propio)/400))`. Victoria=1, empate=0,5, derrota=0; en eliminatorias decide la tanda. Se computan todos los resultados oficiales confirmados en MCMN, tanto importados como introducidos por administración. Ningún partido externo suma. Los goles se registran en estadísticas; rojas solo cuando EA las aporta (ausencia no significa cero). Las amarillas no tienen un campo validado. **No se han definido ni activado bonificaciones por goles, tarjetas o títulos.**

El registro de ELO guarda antes/después, variación y versión `elo-v1-k32` para ambos clubes. Corregir, dejar pendiente o reiniciar eliminatorias reconstruye la secuencia cronológica de resultados; no duplica puntos. Se ordena por fecha EA o primera confirmación manual y UUID como desempate. Mi Club muestra total y un historial paginado de 50 partidos con torneo, jornada, rival y origen. La reconstrucción íntegra es adecuada para este volumen inicial; al crecer se deberá pasar a reconstrucción incremental desde el resultado modificado.

`ea-clubs` valida el token con Auth en todas las acciones privadas. La consulta de metadatos públicos es accesible sin cuenta, con caché de diez minutos y límite de consultas externas. Solo el servicio escribe vínculos/candidatos; las RPC internas no están concedidas al cliente y vuelven a comprobar actor, rol y estado. El ELO y las tablas deportivas tienen RLS para miembros activos. El origen es un endpoint público no oficial de EA: puede cambiar o bloquear consultas. Los errores se muestran sin inventar resultados ni intentar eludir bloqueos.


## Desarrollo con Codex

Repositorio público (visibilidad autorizada por el propietario): https://github.com/cnRoldan/mcmn-relampagos. Las reglas para nuevas tareas están en `AGENTS.md` y el estado pendiente de publicación en `docs/CONTINUIDAD.md`. Configurar el entorno con Node.js 24 y `bash scripts/codex-setup.sh`. GitHub Actions comprueba TypeScript y las pruebas en cada push a main y pull request. El flujo de comprobaciones no despliega cambios a producción.

El instalador de Codex crea `.env` desde `.env.example` si no existe. El ejemplo incluye únicamente la conexión pública del cliente al proyecto MCMN; nunca una clave de servicio. El entorno guardado de Codex sigue pendiente de creación desde su interfaz.
