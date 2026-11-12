export const privacyVersion = "2026-11-12";
// Responsible person confirmed by the owner; contact matches ConvoSquad's published notice.
export const dataController: { name: string | null; email: string | null } = {
  name: "Claudio Roldán Ramos",
  email: "convosquad.soporte@gmail.com",
};
export const privacyDraft = !dataController.name || !dataController.email;
export const privacySections = [
  {
    title: "Responsable y contacto",
    text:
      dataController.name && dataController.email
        ? `Responsable: ${dataController.name}. Contacto de privacidad: ${dataController.email}.`
        : "MCM · Torneos Relámpago está en desarrollo. La identidad legal del responsable y el correo de privacidad están pendientes de completar por la organización. Este aviso describe el funcionamiento actual y seguirá como borrador hasta completar esos datos.",
  },
  {
    title: "Datos que tratamos",
    text: "Guardamos el ID de EA elegido como identificador de acceso, una cuenta interna de autenticación y la contraseña protegida por Supabase Auth; la app no almacena contraseñas en texto plano. No verificamos que seas titular de la cuenta de EA. Guardamos el nombre del club, su escudo opcional, hasta tres teléfonos con prefijo internacional, inscripciones, aceptación de normas, partidos, resultados y decisiones de moderación. No pedimos nombres reales, documentos, direcciones, ubicación ni cuentas de los jugadores del equipo. El archivo del escudo se conserva sin recodificar; puede incluir metadatos incorporados al original. Evita añadir datos personales innecesarios a la imagen.",
  },
  {
    title: "Para qué se usan",
    text: "Los datos permiten iniciar sesión, representar un club, inscribirse por orden de llegada, organizar torneos, calcular clasificaciones, coordinar partidos por WhatsApp y gestionar exclusiones o baneos. También se usan los datos técnicos necesarios para proteger el acceso y limitar intentos. No incorporamos publicidad, venta de datos ni analítica publicitaria.",
  },
  {
    title: "Quién puede verlos",
    text: "Los miembros con acceso activo pueden consultar clubes, sus escudos, inscripciones y resultados de la comunidad. Los escudos se guardan en almacenamiento privado y se muestran mediante enlaces temporales. Los teléfonos los ven el capitán propietario, los administradores y los capitanes de clubes no excluidos que compartan un torneo no finalizado. Los motivos de exclusión solo son visibles para el capitán afectado y los administradores. El motivo del baneo se muestra a la cuenta afectada y los administradores. Un enlace público muestra nombre, fecha, horario, normas, estado y cantidad de inscritos; no teléfonos ni perfiles.",
  },
  {
    title: "WhatsApp",
    text: "Al tocar el botón de WhatsApp se abre un enlace wa.me con el teléfono del destinatario y un mensaje preparado que incluye el nombre de tu club y del torneo. La app no envía el mensaje por ti. A partir de ese momento se aplica la política de WhatsApp. La eliminación en MCM no borra mensajes, contactos o copias que otras personas hayan guardado fuera de la app.",
  },
  {
    title: "Proveedores y ubicación",
    text: "Supabase presta la autenticación, base de datos y almacenamiento de escudos; este proyecto utiliza la región eu-west-1 (Irlanda). Netlify aloja la versión web y sus archivos públicos. Estos proveedores pueden procesar datos técnicos, como direcciones IP y registros de acceso, según sus servicios. La distribución web y las operaciones de los proveedores pueden implicar tratamiento fuera de tu país; su documentación recoge las condiciones y salvaguardas aplicables. MCM no utiliza la base de datos de ConvoSquad.",
  },
  {
    title: "Base del tratamiento",
    text: "El tratamiento necesario para ofrecer la cuenta y participar en torneos se vincula a la prestación del servicio solicitado. La seguridad y prevención de abusos responden al interés legítimo de mantener la comunidad; las obligaciones legales, cuando procedan, se atenderán por su base correspondiente. La comunicación por WhatsApp es una acción voluntaria del capitán. El historial deportivo se conserva con datos mínimos para mantener la integridad de los torneos, sin el nombre original del club, su teléfono ni el vínculo con el capitán cuando se solicita la eliminación.",
  },
  {
    title: "Conservación y eliminación del club",
    text: "Los datos de cuenta y club se mantienen mientras los utilices. En Mi Club puedes eliminar el club: se borran sus teléfonos e imágenes guardadas, se retiran sus inscripciones en torneos no iniciados y se elimina su vínculo con el capitán. Si tiene historial deportivo se conserva un registro con un nombre genérico y un identificador técnico para no romper partidos, tablas y resultados. Si no tiene historial, se elimina el registro del club. La cuenta sigue disponible para crear otro club.",
  },
  {
    title: "Eliminación de perfil y cuenta",
    text: "En Ajustes puedes eliminar tu perfil y tu cuenta de acceso, confirmando la operación y tu contraseña actual. También se elimina o desvincula el club según el criterio anterior. Se eliminan el ID de EA del perfil, los datos de autenticación y sus vínculos de autoría con registros deportivos. Se revocan las sesiones y se bloquea el acceso de tokens anteriores. No se elimina tu cuenta de EA ni los datos de ConvoSquad. Si un fallo impide terminar, la cuenta queda bloqueada y la pantalla permite reintentar la eliminación; no se anuncia una eliminación completa hasta que termine.",
  },
  {
    title: "Registros técnicos, copias y dispositivo",
    text: "La eliminación actúa sobre los datos activos de MCM y su autenticación. Los registros técnicos y copias de seguridad de los proveedores siguen sus ciclos de conservación y no se garantiza su desaparición inmediata. El limitador de acceso descarta ventanas de más de 24 horas al procesar nuevos intentos. Los escudos reemplazados se intentan retirar tras guardar y, si hay un fallo técnico, se vuelven a limpiar al guardar o eliminar el club o la cuenta. Los enlaces de visualización y las cachés pueden conservar temporalmente una copia. En web se conserva la sesión en el almacenamiento del navegador; en las apps nativas se utiliza el almacén seguro del dispositivo. Al cerrar sesión o completar la eliminación se retira la sesión local de ese dispositivo.",
  },
  {
    title: "Tus derechos",
    text: "Puedes consultar tus datos en la app, corregir los teléfonos de tu club y solicitar la supresión mediante las opciones indicadas. Para acceso, rectificación de otros datos, portabilidad, oposición o limitación, escribe a convosquad.soporte@gmail.com, indicando el ID de EA de la cuenta y tu solicitud; nunca envíes tu contraseña. El responsable responderá, como regla general, en un mes conforme a los plazos aplicables del RGPD. Si resulta aplicable el RGPD, puedes reclamar ante tu autoridad de control; en España, ante la AEPD. No se toman decisiones automatizadas sobre exclusiones o baneos: corresponden a los administradores.",
  },
  {
    title: "Cambios del aviso",
    text: `Versión ${privacyVersion}. Si cambian los datos recogidos, sus destinatarios o las funciones de la app, se actualizará este texto. No se usa este aviso como consentimiento genérico para otros fines.`,
  },
];
export const privacyLinks = [
  {
    title: "Contacto de privacidad · convosquad.soporte@gmail.com",
    url: "mailto:convosquad.soporte@gmail.com?subject=Privacidad%20MCM",
  },
  { title: "Privacidad de Supabase", url: "https://supabase.com/privacy" },
  { title: "Privacidad de Netlify", url: "https://www.netlify.com/privacy/" },
  {
    title: "Privacidad de WhatsApp",
    url: "https://www.whatsapp.com/legal/privacy-policy",
  },
  {
    title: "Agencia Española de Protección de Datos",
    url: "https://www.aepd.es/",
  },
];
