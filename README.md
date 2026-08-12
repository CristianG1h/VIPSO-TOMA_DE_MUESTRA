# VIPSO — Control de Muestras y Vacunación

Proyecto web interno de VIP Salud Ocupacional.

## Archivos
- `index.html`: control de muestras, vacunación, despacho, resultados e históricos.
- `lab.html`: portal del laboratorio para recepción y carga de resultados.

## Versión 0.1.0 — auditoría inicial
- Se mejoró el diagnóstico de errores de envío para distinguir falta de internet, error HTTP, respuesta HTML/permisos de Apps Script, JSON inválido y rechazo del backend.
- Se corrigió la fecha predeterminada de vacunación para usar la fecha local del equipo y no UTC.
- Se dejó la estructura lista para control de versiones con Git.

## Pendiente crítico antes de publicar como versión estable
- Mover la autenticación/PIN fuera del JavaScript del navegador.
- Revisar el Google Apps Script (`Code.gs`) para confirmar el origen exacto del error de POST y agregar idempotencia para evitar remisiones duplicadas en reintentos.
- Sanitizar datos dinámicos antes de insertarlos con `innerHTML`.
- Definir repositorio GitHub PRIVADO por tratar datos operativos/sensibles.
