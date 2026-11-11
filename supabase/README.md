# Servidor independiente de MCM

Proyecto: `mkbvplehrbjrufhkcqun`, organización elegida por el propietario. No aplicar estas migraciones al proyecto ConvoSquad.

Los capitanes acceden por identificador de EA y contraseña. La función `ea-auth` resuelve el identificador exclusivamente en servidor. Los clientes nunca pueden leer los correos de otras cuentas ni otorgarse un rol.

Administrador solicitado: `MCMN Relámpagos`. Crear primero la cuenta. Conceder el rol solo después de comprobar que pertenece al propietario; no se concede automáticamente por elegir ese nombre.

Las inscripciones se serializan bloqueando la fila de la noche, se numeran en servidor y no se renumeran al retirar un club. El sorteo afecta al reparto entre torneos, no a la lista de llegada.

## Acceso por identificador

El alta pide únicamente ID de EA y contraseña propia de MCM. `ea-auth` genera un identificador interno `ea-<sha256>@accounts.mcm.invalid` y crea la cuenta mediante Supabase Auth con rol de capitán. Esa dirección no representa un correo real ni se usa para enviar mensajes; tampoco verifica titularidad de la cuenta de EA. El rol administrativo nunca se toma de metadatos suministrados por el cliente.

No se necesita SMTP ni cambiar URL Configuration para este flujo. La recuperación de cuentas queda pendiente; no se anuncia un envío de correo que no existe. Las contraseñas las almacena y verifica Supabase Auth.

## Revisión de permisos

Las RPCs usan `SECURITY DEFINER` de forma intencional, fijan `search_path` vacío y comprueban `auth.uid()`, propietario o rol administrativo antes de escribir. Se revoca el permiso público y se concede solo la lista necesaria. El aviso genérico [SECURITY DEFINER ejecutable por usuarios autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) corresponde a estas operaciones autorizadas y probadas. `auth_attempts` tiene RLS sin política de cliente para que ningún capitán pueda leer ni alterar el limitador ([denegación por defecto](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

## Validación

Nueve pruebas pasan: siete de dominio y dos suites de PostgreSQL sobre RLS y operaciones reales del esquema. También se ha comprobado que el servidor publicado rechaza accesos incorrectos y bloquea el correo de autenticación y los contactos para peticiones anónimas. La interfaz de capitán se ha probado con respuestas de API simuladas, incluida inscripción con número 2 y cierre de sesión.

La revisión automática rechazó crear usuarios QA directamente en Auth y elevar uno a administrador. No se crearon esos usuarios ni se intentó eludir el bloqueo. Por tanto, falta verificar un inicio de sesión válido y una inscripción con cuentas reales después de registrar al propietario.
