'use strict';
let storageInfo = 'Consultando espacio disponible…';
let copyBusy = false;
function updateHealth() {
  const exported = data.settings.find(s => s.id === 'lastExport')?.value;
  const checked = data.settings.find(s => s.id === 'lastVerifiedFile')?.value;
  const restored = data.settings.find(s => s.id === 'lastRestore');
  const total = data.notes.reduce((sum, n) => sum + n.files.reduce((s, f) => s + f.size, 0), 0);
  const lines = [
    'Versión 0.4 · Solo en este navegador. Sin sincronización con otros dispositivos.',
    `${data.notes.filter(n => !n.deletedAt).length} recuerdos · ${data.notes.filter(n => n.deletedAt).length} en papelera · ${(total / 1048576).toFixed(1)} MB de originales`,
    storageInfo,
    exported ? 'Última copia preparada: ' + new Date(exported).toLocaleString('es-ES') + '. Comprueba el archivo descargado.' : 'Aún no has exportado una copia desde esta versión.',
    checked ? 'Archivo de copia verificado: ' + new Date(checked).toLocaleString('es-ES') : 'Todavía no has verificado un archivo de copia descargado.',
    restored ? 'Última restauración: ' + new Date(restored.value).toLocaleString('es-ES') : 'Sin restauraciones registradas aquí.',
    'La verificación detecta cambios accidentales; no cifra la copia ni acredita su autoría. Guárdala en un lugar privado.',
  ];
  $('healthText').replaceChildren(...lines.map(line => node('p', line)));
}
async function refreshStorage() {
  try {
    const e = await navigator.storage?.estimate();
    storageInfo = e ? `Uso estimado del sitio: ${(e.usage / 1048576).toFixed(1)} MB de ${(e.quota / 1048576).toFixed(0)} MB de cuota aproximada del navegador.` : 'Este navegador no informa de su cuota.';
  } catch { storageInfo = 'No se pudo consultar la cuota del navegador.'; }
  updateHealth();
}
$('health').onclick = () => { updateHealth(); $('healthDialog').showModal(); refreshStorage(); };
$('closeHealth').onclick = () => $('healthDialog').close();
$('persist').onclick = async () => {
  try {
    const granted = await navigator.storage?.persist?.();
    $('persistResult').textContent = granted ? 'El navegador ha concedido almacenamiento persistente. Sigue necesitando copias: borrar los datos del sitio los elimina.' : 'El navegador no ha concedido almacenamiento persistente. Exporta copias con regularidad.';
  } catch { $('persistResult').textContent = 'Este navegador no permite solicitarlo.'; }
};
async function withCopy(action) {
  if (copyBusy) return;
  copyBusy = true;
  $('export').disabled = true;
  try { await action(); } catch (e) { showError(e); }
  finally { copyBusy = false; $('export').disabled = false; }
}
$('export').onclick = () => withCopy(async () => {
  status('Preparando y comprobando copia completa…');
  // JSON/base64 sigue siendo provisional para colecciones pequeñas.
  const total = data.notes.reduce((sum, n) => sum + n.files.reduce((s, f) => s + f.size, 0), 0);
  if (total > 150 * 1048576) throw new Error('La copia supera la capacidad provisional de exportación (150 MB de originales). No se ha borrado ningún dato.');
  const backup = await MemoriaStore.backup(db);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = node('a'); a.href = url;
  a.download = 'MEMORIA-copia-' + backup.exported.replace(/[:.]/g, '-') + '.json';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  await MemoriaStore.setting(db, 'lastExport', backup.exported);
  await read();
  status('Copia preparada y comprobada. Conserva la descarga y usa «Verificar copia» para comprobar ese archivo.');
});
async function selectedBackup(input) {
  const file = input.files[0];
  if (!file) return null;
  if (file.size > 250 * 1048576) throw new Error('La copia supera el límite provisional de 250 MB.');
  return JSON.parse(await file.text());
}
$('verify').onchange = () => withCopy(async () => {
  try {
    const x = await selectedBackup($('verify')); if (!x) return;
    await MemoriaStore.decode(x);
    if (x.version === 1) { status('Copia antigua legible, sin huellas de integridad. Puede restaurarse, pero no verificar su contenido frente al original.'); return; }
    await MemoriaStore.setting(db, 'lastVerifiedFile', new Date().toISOString());
    await read();
    status(`Copia íntegra: ${x.notes.length} recuerdos, incluidos los de la papelera, con sus originales. No se ha importado nada.`);
  } finally { $('verify').value = ''; }
});
$('import').onchange = () => withCopy(async () => {
  try {
    const x = await selectedBackup($('import')); if (!x) return;
    await MemoriaStore.decode(x);
    const legacy = x.version === 1 ? '\nEs una copia antigua sin huellas de integridad.' : '';
    if (!confirm(`¿Añadir ${x.notes.length} recuerdos y ${x.folders.length} carpetas? No se sustituirán tus datos actuales.${legacy}`)) return;
    const result = await MemoriaStore.restore(db, x);
    await read(); render();
    status(`Restauración completada: ${result.notes} recuerdos y ${result.folders} carpetas. Datos anteriores conservados.`);
  } finally { $('import').value = ''; }
});
window.addEventListener('memoria-blocked', () => status('Cierra las otras pestañas de MEMORIA y vuelve a abrirla para completar la actualización.'));
window.addEventListener('focus', async () => {
  if (!db) return;
  try { await read(); if (!$('editor').open) render(); } catch (e) { status('Vuelve a abrir MEMORIA para actualizar la vista.'); }
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) return;
    const notify = () => {
      if (!reg.waiting) return;
      $('updateNotice').hidden = false;
      $('applyUpdate').onclick = () => {
        if ($('editor').open) { status('Guarda o cancela la nota antes de actualizar.'); return; }
        if (copyBusy) { status('Espera a que termine la copia antes de actualizar.'); return; }
        reg.waiting.postMessage('ACTIVATE_UPDATE');
      };
    };
    notify();
    reg.addEventListener('updatefound', () => {
      reg.installing?.addEventListener('statechange', notify);
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      // No interrumpir un formulario ni una copia en esta pestaña.
      if ($('editor').open || copyBusy) { $('updateNotice').hidden = false; $('applyUpdate').onclick = () => { if (!$('editor').open && !copyBusy) location.reload(); else status('Termina la edición o copia antes de actualizar.'); }; return; }
      reloading = true; location.reload();
    });
  }).catch(() => {});
}
