# MCM · Torneos Relámpago

Trabaja y responde en español. Esta es una app móvil multiplataforma React Native + Expo + TypeScript, con vista web en Netlify. Lee README.md y docs/CONTINUIDAD.md antes de proponer cambios importantes.

## Reglas del producto

- Menú lateral: Inicio, Torneos, Mi Club, Palmarés, Ajustes. Paleta vinotinto y marca MCM.
- Cada torneo relámpago tiene horario y normas. Un administrador decide Copa o Liga, participantes y margen de inicio. Se conserva el orden original de inscripción.
- Solo se registran capitanes, con ID de EA y contraseña propia de MCM de mínimo ocho caracteres. No son credenciales de EA. No se registran jugadores.
- El capitán representa un club, con nombre, escudo opcional PNG transparente/JPG y teléfono para contacto por WhatsApp.
- Solo los resultados oficiales de nuestros torneos cuentan para estadísticas y ELO. Un resultado de EA coincidente es un candidato y requiere revisión administrativa. No importar el historial general ni inventar bonificaciones.

## Desarrollo

- Node.js 24; instalación: `bash scripts/codex-setup.sh` (o `npm ci`).
- Verificaciones: `npm run typecheck`, `npm test`, `npm run build:web`.
- Las variables públicas del cliente están en `.env.example`; `.env` está ignorado. Sin ellas se activa el prototipo local: eso no valida la conexión al servidor real.
- Nunca guardar contraseñas, tokens de servicio, archivos de credenciales ni `.env` en Git. Las claves de servicio de Supabase nunca van al cliente.
- Usar pruebas PGlite aisladas para SQL y API simulada para recorridos de roles. No crear usuarios QA privilegiados ni modificar cuentas reales para probar.
- Las migraciones aplicadas no se editan: crear una nueva. Verificar el estado remoto antes de aplicar una pendiente. El propietario ya autorizó SQL necesario para desarrollar MCM, sin pedir otra confirmación conversacional; respetar los controles de la plataforma.
- Mantener MCM separado de ConvoSquad. No modificar su repositorio ni su base de datos.
- No publicar resultados de pruebas simuladas como si se hubieran verificado con cuentas reales. Distinguir cambios en Git, migraciones aplicadas y versiones desplegadas.
- Al terminar, registrar cambios relevantes y lo pendiente en docs/CONTINUIDAD.md cuando afecten a tareas futuras.
