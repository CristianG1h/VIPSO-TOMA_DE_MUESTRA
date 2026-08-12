# VIPSO — Control de Muestras y Vacunación

Proyecto web interno de VIP Salud Ocupacional.

## Archivos
- `index.html`: control de muestras, vacunación, despacho, resultados e históricos.
- `lab.html`: portal del laboratorio para recepción y carga de resultados.
- `apps-script/EmailQueue.gs`: módulo de control de cuota y cola de correos pendientes.
- `apps-script/INTEGRACION.md`: pasos para conectarlo al `Code.gs` actual.

## Versión 0.2.0 — cuota de correo y diagnóstico
- El frontend distingue errores reales del servidor de problemas de internet.
- Se corrigió la fecha predeterminada de vacunación para usar la fecha local del equipo.
- Se preparó soporte provisional para mostrar la cuota restante de correo mediante `?accion=cuotaEmail`.
- Se agregó `EmailQueue.gs` para guardar correos pendientes y reintentarlos automáticamente.
- Se recomienda ejecutar este sistema desde una cuenta Gmail/Workspace dedicada para aislar su cuota de los otros Apps Script de la organización.

## Estado de la integración de correo
El módulo de cola está listo, pero **todavía debe conectarse al `Code.gs` real** del Apps Script. No se incluyó ni reemplazó ese archivo porque aún no fue suministrado y contiene la lógica actual de Sheets, PDFs, notificaciones y remisiones.

## Cuenta recomendada
Se recomienda crear una cuenta Google exclusiva para este sistema. El Apps Script debe ser desplegado por esa cuenta y ejecutarse como el usuario que despliega. Comparta con esa cuenta el Google Sheet, carpetas y plantillas de Drive que utiliza el proyecto.

## Seguridad pendiente
- El PIN del frontend sigue siendo una barrera de interfaz, no autenticación robusta.
- No subir contraseñas de Gmail, claves de aplicación, JSON de cuentas de servicio ni tokens al repositorio.
- Se recomienda que el repositorio sea privado antes de guardar código backend o configuraciones sensibles.
