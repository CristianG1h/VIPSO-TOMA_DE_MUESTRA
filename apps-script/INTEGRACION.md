# Integración del control de cuota y correos pendientes

Este módulo está preparado para agregarse al Google Apps Script existente **sin reemplazar el `Code.gs` actual**.

## 1. Cuenta Gmail dedicada

Recomendado: crear una cuenta de Google exclusiva para este sistema. El Apps Script debe ser **desplegado por esa cuenta** y ejecutarse como el usuario que despliega. Comparta con esa cuenta el Sheet, carpetas y plantillas de Drive que utiliza el proyecto.

Después del nuevo despliegue, cambie `SCRIPT_URL` en `index.html` y `lab.html` por la nueva URL `/exec`.

## 2. Agregar `EmailQueue.gs`

Copie `EmailQueue.gs` al mismo proyecto de Apps Script.

## 3. Sustituir los envíos directos

Donde el `Code.gs` tenga algo como:

```javascript
MailApp.sendEmail(opciones);
```

cambiarlo por:

```javascript
var estadoCorreo = enviarCorreoSeguro_(opciones, {
  tipo: 'muestra',
  consecutivo: consecutivo
});
```

La respuesta al navegador debe incluir, como mínimo:

```javascript
return json_({
  ok: true,
  consecutivo: consecutivo,
  emailPendiente: estadoCorreo.pendiente === true,
  cuotaEmail: estadoCorreo.cuotaRestante
});
```

**No haga este reemplazo a ciegas** en todas las funciones hasta revisar el `Code.gs`, porque cada correo puede llevar adjuntos, destinatarios o lógica distinta.

## 4. Acción provisional para mostrar el contador

Dentro de `doGet(e)`, junto a las otras acciones:

```javascript
if (accion === 'cuotaEmail') {
  return json_(obtenerEstadoCorreos_());
}
```

El frontend puede consultar esta acción para mostrar la cuota restante y los correos pendientes. Google indica que `MailApp.getRemainingDailyQuota()` devuelve el número de destinatarios que aún puede usar el script en el día; el valor es válido para la ejecución actual y puede variar entre ejecuciones.

## 5. Reintento automático

Ejecute **una sola vez** desde el editor de Apps Script:

```javascript
instalarTriggerCorreosPendientes_();
```

Esto crea un trigger horario. Cuando vuelve a existir cuota, `procesarCorreosPendientes_()` intenta despachar la cola.

## 6. Hoja creada automáticamente

El módulo crea una hoja llamada `CORREOS_PENDIENTES` con estado, intentos, último error, destinatarios y referencia. Los adjuntos se guardan temporalmente en Drive para que puedan enviarse después.

## Pendiente para integración definitiva

Para integrar todo sin romper el flujo actual se necesita el `Code.gs` vigente, especialmente `doGet(e)`, `doPost(e)` y cada uso de `MailApp.sendEmail`/`GmailApp.sendEmail`.
