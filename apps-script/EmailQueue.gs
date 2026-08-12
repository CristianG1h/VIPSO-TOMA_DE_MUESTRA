/**
 * VIPSO - Cola segura de correos para Google Apps Script.
 * Versión 0.2.0
 *
 * OBJETIVO
 * - Consultar la cuota restante de MailApp.
 * - Si no hay cuota (o MailApp falla), NO perder la operación principal.
 * - Guardar el correo como PENDIENTE en una hoja.
 * - Reintentar automáticamente mediante un trigger.
 *
 * INTEGRACIÓN NECESARIA EN Code.gs
 * 1) Sustituir MailApp.sendEmail(...) por enviarCorreoSeguro_(mensaje, contexto).
 * 2) En doGet, si accion === "cuotaEmail", devolver obtenerEstadoCorreos_().
 * 3) Instalar una sola vez el trigger con instalarTriggerCorreosPendientes_().
 *
 * IMPORTANTE: este módulo no reemplaza el Code.gs actual. Se agrega al MISMO proyecto.
 */

const VIP_EMAIL_QUEUE_SHEET = 'CORREOS_PENDIENTES';
const VIP_EMAIL_QUEUE_FOLDER = 'VIPSO_CORREOS_PENDIENTES_ADJUNTOS';
const VIP_EMAIL_QUEUE_HEADERS = [
  'ID','FECHA_CREACION','ESTADO','INTENTOS','ULTIMO_INTENTO','ULTIMO_ERROR',
  'TIPO','REFERENCIA','TO','CC','BCC','SUBJECT','BODY','HTML_BODY',
  'NAME','REPLY_TO','NO_REPLY','ATTACHMENT_FILE_IDS'
];

function obtenerEstadoCorreos_() {
  var restante = 0;
  try { restante = MailApp.getRemainingDailyQuota(); } catch (e) {}
  return {
    ok: true,
    restante: Number(restante || 0),
    pendientes: contarCorreosPendientes_()
  };
}

function enviarCorreoSeguro_(mensaje, contexto) {
  mensaje = mensaje || {};
  contexto = contexto || {};
  var requeridos = contarDestinatarios_(mensaje);
  var restante = 0;

  try { restante = MailApp.getRemainingDailyQuota(); }
  catch (e) { return encolarCorreo_(mensaje, contexto, 'No se pudo consultar cuota: ' + String(e)); }

  if (requeridos > restante) {
    return encolarCorreo_(mensaje, contexto, 'CUOTA_EMAIL_INSUFICIENTE');
  }

  try {
    MailApp.sendEmail(mensaje);
    return {
      enviado: true,
      pendiente: false,
      emailPendiente: false,
      cuotaRestante: Math.max(0, restante - requeridos)
    };
  } catch (e) {
    return encolarCorreo_(mensaje, contexto, String(e));
  }
}

function encolarCorreo_(mensaje, contexto, motivo) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = obtenerHojaCola_();
    var id = Utilities.getUuid();
    var fileIds = guardarAdjuntos_(mensaje.attachments || [], id);
    var row = [
      id,
      new Date(),
      'PENDIENTE',
      0,
      '',
      motivo || '',
      contexto.tipo || '',
      contexto.referencia || contexto.consecutivo || '',
      mensaje.to || '',
      mensaje.cc || '',
      mensaje.bcc || '',
      mensaje.subject || '',
      mensaje.body || '',
      mensaje.htmlBody || '',
      mensaje.name || '',
      mensaje.replyTo || '',
      mensaje.noReply === true ? 'SI' : 'NO',
      fileIds.join(',')
    ];
    sh.appendRow(row);
    return {
      enviado: false,
      pendiente: true,
      emailPendiente: true,
      colaId: id,
      motivo: motivo || '',
      cuotaRestante: obtenerCuotaSilenciosa_()
    };
  } finally {
    lock.releaseLock();
  }
}

function procesarCorreosPendientes_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var sh = obtenerHojaCola_();
    var last = sh.getLastRow();
    if (last < 2) return;

    var data = sh.getRange(2, 1, last - 1, VIP_EMAIL_QUEUE_HEADERS.length).getValues();
    var restante = obtenerCuotaSilenciosa_();
    if (restante <= 0) return;

    for (var i = 0; i < data.length && restante > 0; i++) {
      var row = data[i];
      var estado = String(row[2] || '').toUpperCase();
      if (estado !== 'PENDIENTE') continue;

      var mensaje = reconstruirMensaje_(row);
      var necesarios = contarDestinatarios_(mensaje);
      if (necesarios <= 0) {
        marcarFilaCola_(sh, i + 2, 'ERROR', Number(row[3] || 0) + 1, 'Sin destinatario válido');
        continue;
      }
      if (necesarios > restante) break;

      try {
        MailApp.sendEmail(mensaje);
        restante -= necesarios;
        marcarFilaCola_(sh, i + 2, 'ENVIADO', Number(row[3] || 0) + 1, '');
      } catch (e) {
        marcarFilaCola_(sh, i + 2, 'PENDIENTE', Number(row[3] || 0) + 1, String(e));
        if (/demasiadas veces|too many times|quota|l[ií]mite/i.test(String(e))) break;
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function instalarTriggerCorreosPendientes_() {
  var fn = 'procesarCorreosPendientes_';
  var yaExiste = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === fn;
  });
  if (!yaExiste) {
    ScriptApp.newTrigger(fn).timeBased().everyHours(1).create();
  }
  return 'OK';
}

function contarCorreosPendientes_() {
  var sh = obtenerHojaCola_();
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var estados = sh.getRange(2, 3, last - 1, 1).getValues();
  return estados.reduce(function(acc, r) {
    return acc + (String(r[0] || '').toUpperCase() === 'PENDIENTE' ? 1 : 0);
  }, 0);
}

function obtenerHojaCola_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('El proyecto debe estar vinculado a una hoja de cálculo o adaptar obtenerHojaCola_() para abrirla por ID.');
  var sh = ss.getSheetByName(VIP_EMAIL_QUEUE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(VIP_EMAIL_QUEUE_SHEET);
    sh.getRange(1, 1, 1, VIP_EMAIL_QUEUE_HEADERS.length).setValues([VIP_EMAIL_QUEUE_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function guardarAdjuntos_(attachments, colaId) {
  if (!attachments || !attachments.length) return [];
  var folder = obtenerCarpetaAdjuntos_();
  var ids = [];
  attachments.forEach(function(blob, idx) {
    if (!blob) return;
    try {
      var nombre = blob.getName ? blob.getName() : '';
      if (!nombre) nombre = colaId + '-adjunto-' + (idx + 1);
      var f = folder.createFile(blob.copyBlob().setName(nombre));
      ids.push(f.getId());
    } catch (e) {
      console.error('No se pudo persistir adjunto para cola', e);
    }
  });
  return ids;
}

function obtenerCarpetaAdjuntos_() {
  var it = DriveApp.getFoldersByName(VIP_EMAIL_QUEUE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(VIP_EMAIL_QUEUE_FOLDER);
}

function reconstruirMensaje_(row) {
  var m = {
    to: String(row[8] || ''),
    subject: String(row[11] || ''),
    body: String(row[12] || '')
  };
  if (row[9]) m.cc = String(row[9]);
  if (row[10]) m.bcc = String(row[10]);
  if (row[13]) m.htmlBody = String(row[13]);
  if (row[14]) m.name = String(row[14]);
  if (row[15]) m.replyTo = String(row[15]);
  if (String(row[16] || '').toUpperCase() === 'SI') m.noReply = true;

  var ids = String(row[17] || '').split(',').map(function(x){ return x.trim(); }).filter(String);
  if (ids.length) {
    m.attachments = ids.map(function(id) { return DriveApp.getFileById(id).getBlob(); });
  }
  return m;
}

function marcarFilaCola_(sh, rowNum, estado, intentos, error) {
  sh.getRange(rowNum, 3).setValue(estado);
  sh.getRange(rowNum, 4).setValue(intentos);
  sh.getRange(rowNum, 5).setValue(new Date());
  sh.getRange(rowNum, 6).setValue(error || '');
}

function contarDestinatarios_(mensaje) {
  var total = 0;
  ['to','cc','bcc'].forEach(function(k) {
    var v = String((mensaje && mensaje[k]) || '').trim();
    if (!v) return;
    total += v.split(/[;,]/).map(function(x){ return x.trim(); }).filter(String).length;
  });
  return total;
}

function obtenerCuotaSilenciosa_() {
  try { return Number(MailApp.getRemainingDailyQuota() || 0); }
  catch (e) { return 0; }
}
