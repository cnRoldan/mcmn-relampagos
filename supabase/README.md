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

Veinte pruebas pasan, incluidas seis suites de PostgreSQL sobre RLS, formatos, normas, margen, exclusiones y baneos. También se ha comprobado que el servidor publicado rechaza accesos incorrectos y bloquea el correo de autenticación y los contactos para peticiones anónimas. La interfaz de capitán se ha probado con respuestas de API simuladas, incluida inscripción con número 2 y cierre de sesión.

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
