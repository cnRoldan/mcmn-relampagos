# Continuidad del desarrollo de MCM

Actualizado el 13 de noviembre de 2026.

## Proyecto y servicios

- Repositorio privado previsto: https://github.com/cnRoldan/mcm-relampagos (pendiente de creación; GitHub devolvió 403 por falta de permiso de la integración).
- Aplicación web: https://mcm-torneos-relampago.netlify.app
- Netlify site ID: `1bd64a0f-cb74-4b51-b415-a82b6a31778a`.
- Proyecto Supabase propio de MCM: `mkbvplehrbjrufhkcqun`, eu-west-1. Está en la organización ConvoSquad, pero su base de datos es independiente.
- El acceso por ID de EA crea una identidad interna en Supabase Auth; nunca usa la contraseña real de EA.
- Responsable de privacidad: Claudio Roldán Ramos. Contacto autorizado: convosquad.soporte@gmail.com.

## Estado al guardar el proyecto en GitHub

La versión web publicada incluye cuentas de capitanes, torneos, contacto WhatsApp, resultados manuales, tablas y playoffs, eliminación de cuentas/clubes, política de datos y edición de nombre/escudo. El último commit previo a los cambios de EA era `9d6f413`.

Los cambios de vinculación EA y ELO están incorporados al código y pasan 44 pruebas, TypeScript y exportación web. **Todavía no se han publicado en Netlify ni se ha confirmado la aplicación de su migración remota.** Las solicitudes anteriores de migración caducaron en la confirmación técnica del conector; no se deben asumir aplicadas.

Antes de publicar esta versión:

1. Comprobar las migraciones remotas y, si falta, aplicar `supabase/migrations/20261112234854_ea_mcm_results.sql` al proyecto MCM.
2. Desplegar `supabase/functions/ea-clubs/index.ts` junto con `_shared/ea.ts`. La función valida por sí misma Auth en las acciones privadas; `lookup` solo consulta metadatos públicos con caché y límite. Su configuración de gateway debe permitir esa validación interna.
3. Probar la consulta real de Wabi Sabi desde la función desplegada. Una consulta desde el entorno de desarrollo no demuestra acceso desde Supabase.
4. Revisar el recorrido web de vinculación, validación administrativa e importación con API simulada; no crear cuentas QA privilegiadas en producción.
5. Exportar y publicar la web. No publicar primero el cliente sin el backend correspondiente.

## Investigación de EA

Club de ejemplo facilitado por el propietario: Wabi Sabi, ID `16306`, pool `common-gen5`, compartido por PS5, Xbox Series y PC.

Endpoint público observado: `https://proclubs.ea.com/api/fc/`.

- `clubs/info?platform=common-gen5&clubIds=16306`
- `clubs/matches?platform=common-gen5&clubIds=16306&matchType=friendlyMatch&maxResultCount=10`

No es una API con garantías oficiales. No eludir bloqueos; conservar la carga manual cuando EA falle. Los flags de resultado de amistosos pueden ser cero incluso cuando hay ganador: validar goles recíprocos. No conservar datos individuales de jugadores. Los abandonos se resuelven manualmente. No se ha validado una fuente fiable de amarillas ni de tandas de penaltis.

Solo se guardan candidatos entre los dos clubes de un cruce MCM, posteriores al inicio efectivo y a la validación de sus vínculos. La coincidencia no acredita por sí sola que sea el partido concertado: el administrador confirma la jornada. No vincular Wabi Sabi a una cuenta real automáticamente.

Primera regla de ELO: base 1000, K=32, victoria/empate/derrota y fuerza del rival; la tanda decide las eliminatorias. Se computan únicamente resultados oficiales MCM confirmados, incluidos los manuales. Se reconstruye el historial al corregir o retirar resultados. **No se han acordado ni activado bonificaciones por goles, tarjetas o títulos.**

## Entorno de Codex y móvil

El entorno debe usar este repositorio y la rama `main`, Node.js 24 e instalación `bash scripts/codex-setup.sh`. Las variables EXPO_PUBLIC del proyecto MCM deben configurarse en el entorno para probar la conexión real. No copiar tokens personales ni de servicio al repositorio ni a instrucciones.

GitHub conserva el código y su historial. Netlify sirve una exportación web; Supabase guarda la información compartida. Son estados distintos y publicar en uno no actualiza automáticamente los demás.

El estado real de creación del entorno se comunica en la conversación de configuración. Este archivo no demuestra que ya exista un entorno guardado en Codex.
