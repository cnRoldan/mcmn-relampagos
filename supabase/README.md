# Servidor independiente de MCM

Proyecto: `mkbvplehrbjrufhkcqun`, organización elegida por el propietario. No aplicar estas migraciones al proyecto ConvoSquad.

Los capitanes acceden por identificador de EA y contraseña. La función `ea-auth` resuelve el identificador exclusivamente en servidor. Los clientes nunca pueden leer los correos de otras cuentas ni otorgarse un rol.

Administrador solicitado: `MCMN Relámpagos`. Crear primero la cuenta. Conceder el rol solo después de comprobar que pertenece al propietario; no se concede automáticamente por elegir ese nombre.

Las inscripciones se serializan bloqueando la fila del torneo, se numeran en servidor y no se renumeran al excluir un club. El sorteo afecta a los grupos y al calendario, sin cambiar la lista de llegada.

## Acceso por identificador

El alta pide únicamente ID de EA y contraseña propia de MCM. `ea-auth` genera un identificador interno `ea-<sha256>@accounts.mcm.invalid` y crea la cuenta mediante Supabase Auth con rol de capitán. Esa dirección no representa un correo real ni se usa para enviar mensajes; tampoco verifica titularidad de la cuenta de EA. El rol administrativo nunca se toma de metadatos suministrados por el cliente.

No se necesita SMTP ni cambiar URL Configuration para este flujo. La recuperación de cuentas queda pendiente; no se anuncia un envío de correo que no existe. Las contraseñas las almacena y verifica Supabase Auth.

## Revisión de permisos

Las RPCs usan `SECURITY DEFINER` de forma intencional, fijan `search_path` vacío y comprueban `auth.uid()`, propietario o rol administrativo antes de escribir. Se revoca el permiso público y se concede solo la lista necesaria. El aviso genérico [SECURITY DEFINER ejecutable por usuarios autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) corresponde a estas operaciones autorizadas y probadas. `auth_attempts` tiene RLS sin política de cliente para que ningún capitán pueda leer ni alterar el limitador ([denegación por defecto](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

## Validación

Treinta y dos pruebas pasan, incluidas diez suites de PostgreSQL sobre RLS, formatos, normas, margen, exclusiones y baneos. También se ha comprobado que el servidor publicado rechaza accesos incorrectos y bloquea el correo de autenticación y los contactos para peticiones anónimas. La interfaz de capitán se ha probado con respuestas de API simuladas, incluida inscripción con número 2 y cierre de sesión.

La revisión automática rechazó crear usuarios QA directamente en Auth y elevar uno a administrador. No se crearon esos usuarios ni se intentó eludir el bloqueo. Por tanto, falta verificar un inicio de sesión válido y una inscripción con cuentas reales después de registrar al propietario.


## Copa y Liga

La migración `copa_liga_formats` añade la validación de Copa (4/8) y Liga (4/6), normaliza el formato en los nuevos repartos y conserva la compatibilidad con clientes anteriores. La función interna de validación no se expone a clientes. `confirm_plan` mantiene el control de administrador y el bloqueo transaccional compartido con las inscripciones. Se han ejecutado consultas sobre el servidor para las cuatro combinaciones válidas, el rechazo de Liga de ocho y los permisos de ejecución.

## Torneos compartibles y moderación

La migración `shareable_tournaments` conserva los nombres internos de tablas y añade reglas y margen de inicio, exclusión de inscripciones, avisos privados y baneos de cuentas. Las altas públicas de torneo solo se leen a través de `get_public_tournament(uuid)`: es una proyección de metadatos deliberadamente pública, sin contactos, identidades ni avisos. El aviso [función SECURITY DEFINER accesible a anónimos](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable) es intencional exclusivamente para esta lectura acotada por UUID.

`list_tournaments()` usa SECURITY INVOKER y respeta RLS. Los clientes ya no pueden ejecutar los antiguos endpoints de creación sin normas, inscripción sin aceptación o retirada destructiva. `join_tournament` toma el club de la identidad actual, comprueba la aceptación de normas y conserva la numeración de llegada con el mismo bloqueo de torneo utilizado para cierres y exclusiones. No hay datos de jugadores ni plantillas.

El administrador configura una única competición con todos los clubes no excluidos. El servidor impide confirmarla antes de la hora efectiva (hora original de Madrid más margen) y mantiene el límite de cinco partidos por club. La inscripción no se cierra automáticamente por hora.

Los motivos de exclusión se guardan en `registration_notices`, con RLS para propietario del club y administradores. Las push no se envían todavía. Los baneos impiden las lecturas y escrituras privadas de la cuenta con sesiones ya emitidas. El acceso por contraseña también comprueba el baneo antes de devolver una sesión. Un baneo excluye las inscripciones de torneos abiertos; quitarlo no readmite clubes automáticamente ni cambia partidos ya confirmados.

No se crean cuentas QA privilegiadas en el servidor: la denegación previa de revisión automática se respeta. Las pruebas de cuentas y roles se ejecutan de forma aislada; los recorridos visuales usan API simulada.

La auditoría también indica que la protección de contraseñas filtradas de Supabase está desactivada ([configuración](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); esta entrega no cambia esa configuración.

## Inicio y WhatsApp

`home_and_whatsapp` añade `ended_at` y la RPC administrativa `finish_tournament`, con búsqueda vacía y concesiones limitadas. No marca campeones ni resultados. `list_tournaments_with_status` usa SECURITY INVOKER y conserva el endpoint anterior para clientes existentes; la ficha pública sigue sin exponer teléfonos.

La política `contact_read` permite a capitanes activos acceder a los contactos de otros clubes no excluidos cuando ambos están inscritos en el mismo torneo no finalizado. Fuera de ese caso, solo propietario y administradores. Se comprueba sobre la sesión y registros actuales, no sobre metadatos del cliente. Un índice por club/torneo respalda la consulta.

`check_contacts` exige de uno a tres teléfonos válidos con prefijo internacional explícito. Un trigger comprueba este requisito en cada nueva inscripción, también para clubes existentes sin teléfono. Los registros anteriores se conservan. WhatsApp usa HTTPS `wa.me` y un mensaje preparado; abrir el chat requiere tocar el botón y no envía el mensaje.

## Partidos y clasificación

`competition_results` añade `competition_matches` con RLS para miembros activos y sin escrituras directas de cliente. Un trigger del cierre de inscripciones genera el calendario en la misma transacción de `confirm_plan`. Las competiciones confirmadas anteriores reciben un calendario sin resultados, sin cambiar cuentas ni roles.

`competition_standings` usa SECURITY INVOKER y calcula PJ/G/E/P/GF/GC/DG/Pts desde partidos completados de grupos o Liga. La interfaz calcula la misma tabla desde los partidos; las pruebas verifican ambos cálculos y la exclusión de penaltis/playoffs. Los marcadores pendientes son NULL, no ceros.

Las RPCs `save_match_result`, `start_playoffs` y `reset_playoffs` son SECURITY DEFINER intencionadas, comprueban el rol administrativo activo, fijan `search_path` vacío, tienen ejecución anónima revocada y bloquean la fila del torneo, igual que cierre y finalización. Se comprueban versiones al guardar. El servidor valida las clasificaciones deportivas, resultados completos, penaltis y dependencia de los cruces. Los helpers internos y triggers no se exponen a los clientes. El aviso genérico del asesor sobre funciones administrativas ejecutables por autenticados corresponde a esta autorización comprobada en servidor.

Los torneos finalizados se consultan pero sus marcadores no se editan. Reiniciar playoffs requiere una confirmación explícita en la interfaz administrativa; conserva todos los resultados de grupos. Se han probado calendarios para las cuatro combinaciones admitidas, toda la Copa de ocho, Copa de cuatro, tablas, empates, permisos, baneos y versiones en PostgreSQL aislado. Las pruebas visuales usan API simulada y no crean usuarios privilegiados en producción.

## Eliminación y datos personales

`privacy_and_deletion` añade `deletion_pending` al perfil y `deleted_at` al club. La marca pendiente desactiva permisos incluso con JWT anteriores. Las funciones con bloqueo directo de perfil comprueban también ese estado. Los clubes borrados no se pueden vincular ni inscribir de nuevo como registros históricos.

`delete_my_club` identifica al dueño con `auth.uid()` y exige el nombre exacto. El helper de borrado solo es invocable por servidor: bloquea perfil, torneos en orden y club; borra teléfonos/avisos, retira inscripciones abiertas y desvincula la autoría de las conservadas. Los clubes históricos se renombran y no conservan propietario; se mantienen identificadores técnicos y resultados. Las FK de autoría pasan a NULL al eliminar un perfil, evitando cascadas sobre partidos.

`prepare_account_deletion(uuid)` es exclusiva de servicio. La función Edge `account-delete` obtiene el usuario de un JWT verificado, exige la contraseña actual de ese mismo usuario, limita intentos, prepara el borrado, revoca todas las sesiones y ejecuta `admin.deleteUser(id,false)`. No acepta IDs o correos objetivo del cuerpo. `verify_jwt=false` en la puerta de Edge se debe a esta autenticación explícita; la autorización siempre se verifica dentro. Un error después de preparar devuelve 503 con estado pendiente, nunca éxito, y admite reintento. No hay almacenamiento de archivos de usuario que impida actualmente el borrado de Auth.

Se permite a las cuentas suspendidas iniciar sesión para acceder a la política y la supresión; los helpers de permisos y RLS siguen denegando sus datos privados y operaciones deportivas. El cliente elimina la sesión local al completar la supresión. Las pruebas HTTP verifican credenciales, suplantación por cuerpo, límites y fallos parciales. Las pruebas PostgreSQL comprueban el borrado de datos activos y los históricos conservados, sin eliminar usuarios reales del servidor.
