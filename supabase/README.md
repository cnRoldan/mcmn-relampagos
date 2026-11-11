# Servidor independiente de MCM

Proyecto: `mkbvplehrbjrufhkcqun`, organización elegida por el propietario. No aplicar estas migraciones al proyecto ConvoSquad.

Los capitanes acceden por identificador de EA y contraseña. El correo privado se utiliza para confirmar y recuperar la cuenta; la función `ea-auth` resuelve el identificador exclusivamente en servidor. Los clientes nunca pueden leer los correos de otras cuentas ni otorgarse un rol.

Administrador solicitado: `MCMN Relámpagos`. Crear primero la cuenta y confirmar su correo. Conceder el rol solo después de comprobar que pertenece al propietario; no se concede automáticamente por elegir ese nombre.

Las inscripciones se serializan bloqueando la fila de la noche, se numeran en servidor y no se renumeran al retirar un club. El sorteo afecta al reparto entre torneos, no a la lista de llegada.

## Configuración de correo

En Authentication → URL Configuration:
- Site URL: `https://mcm-torneos-relampago.netlify.app`
- Redirect URLs: `https://mcm-torneos-relampago.netlify.app/**`

Mantener la confirmación de correo activada. El usuario confirma el enlace y vuelve a la app para entrar con su ID de EA. No desactivar confirmaciones como atajo. Revisar límites del servicio de correo de Supabase antes de abrir altas a toda la comunidad; el SMTP de desarrollo tiene límites propios.

La integración disponible no permite editar esta configuración de Auth; debe comprobarse en el panel del proyecto MCM. Para cuentas nativas se puede volver manualmente a la app después de confirmar el correo en el navegador.

## Revisión de permisos

Las RPCs usan `SECURITY DEFINER` de forma intencional, fijan `search_path` vacío y comprueban `auth.uid()`, propietario o rol administrativo antes de escribir. Se revoca el permiso público y se concede solo la lista necesaria. El aviso genérico [SECURITY DEFINER ejecutable por usuarios autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) corresponde a estas operaciones autorizadas y probadas. `auth_attempts` tiene RLS sin política de cliente para que ningún capitán pueda leer ni alterar el limitador ([denegación por defecto](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

## Validación

Nueve pruebas pasan: siete de dominio y dos suites de PostgreSQL sobre RLS y operaciones reales del esquema. También se ha comprobado que el servidor publicado rechaza accesos incorrectos y bloquea el correo de autenticación y los contactos para peticiones anónimas. La interfaz de capitán se ha probado con respuestas de API simuladas, incluida inscripción con número 2 y cierre de sesión.

La revisión automática rechazó crear usuarios QA directamente en Auth y elevar uno a administrador. No se crearon esos usuarios ni se intentó eludir el bloqueo. Por tanto, falta verificar un inicio de sesión válido y una inscripción con cuentas reales después de configurar el correo y registrar al propietario.
