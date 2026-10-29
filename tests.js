'use strict';
(async () => {
  const S = MemoriaStore, out = document.getElementById('results');
  const results = [], handles = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  const test = async (label, fn) => { await fn(); results.push('OK · ' + label); out.textContent = results.join('\n'); };
  const reject = async (fn, label) => { let failed = false; try { await fn(); } catch { failed = true; } check(failed, label); };
  const prefix = 'memoria-test-' + crypto.randomUUID();
  const names = [prefix + '-migration', prefix + '-restored', prefix + '-legacy'];
  const bytes = new Uint8Array([0, 255, 17, 23, 0, 128]);
  const date = '2026-10-29T10:00:00.000Z';
  const f1 = { id: 'parent', name: 'Viajes', space: 'personal', parent: null };
  const f2 = { id: 'child', name: 'Calas', space: 'personal', parent: 'parent' };
  const original = { id: 'note', space: 'personal', title: '<script>texto literal</script>', body: 'Cala con ñ y emoji 🌊', tags: ['playa', 'pendiente'], importance: 'alta', folders: ['parent', 'child'], created: date, updated: date, files: [{ name: 'original.bin', type: 'application/octet-stream', size: bytes.length, blob: new Blob([bytes]) }] };
  try {
    // Reproduce una base real v1 antes de instalar la nueva versión.
    await new Promise((resolve, reject) => {
      const r = indexedDB.open(names[0], 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('notes', { keyPath: 'id' }); r.result.createObjectStore('folders', { keyPath: 'id' }); };
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const db = r.result, tx = db.transaction(['notes', 'folders'], 'readwrite');
        tx.objectStore('notes').put(original); tx.objectStore('folders').put(f1); tx.objectStore('folders').put(f2);
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
    const db = await S.open(names[0]); handles.push(db);
    const dest = await S.open(names[1]); handles.push(dest);
    const legacyDest = await S.open(names[2]); handles.push(legacyDest);
    await test('Migración v1 → v2 conserva notas, carpetas y originales', async () => {
      const x = await S.snapshot(db); check(x.notes.length === 1 && x.folders.length === 2, 'Conteos tras migración');
      check(await S.sha(await x.notes[0].files[0].blob.arrayBuffer()) === await S.sha(bytes), 'Original tras migración');
    });
    await test('Papelera y recuperación conservan el archivo original', async () => {
      await S.trash(db, original); let x = (await S.snapshot(db)).notes[0]; check(!!x.deletedAt, 'Borrado lógico');
      await S.trash(db, x, true); x = (await S.snapshot(db)).notes[0]; check(!x.deletedAt, 'Recuperado');
      check(await S.sha(await x.files[0].blob.arrayBuffer()) === await S.sha(bytes), 'Original recuperado');
    });
    await test('Edición simultánea se rechaza sin sobrescribir', async () => {
      const n = (await S.snapshot(db)).notes[0];
      await S.saveNote(db, { ...n, body: 'Primera edición', updated: new Date().toISOString() }, n.revision);
      await reject(() => S.saveNote(db, { ...n, body: 'Edición obsoleta' }, n.revision), 'No rechazó conflicto');
      check((await S.snapshot(db)).notes[0].body === 'Primera edición', 'Se perdió la edición válida');
    });
    // Incluye un recuerdo en papelera en la copia, no solo los activos.
    const deleted = { ...original, id: 'deleted', folders: [], deletedAt: date, revision: undefined };
    await S.saveNote(db, deleted);
    const backup = await S.backup(db);
    await test('Exportar → JSON → restaurar en base vacía con originales y relaciones', async () => {
      const encoded = JSON.parse(JSON.stringify(backup));
      await S.restore(dest, encoded); const x = await S.snapshot(dest);
      check(x.notes.length === 2 && x.folders.length === 2, 'Conteos restaurados');
      const n = x.notes.find(n => !n.deletedAt); check(n.body === 'Primera edición', 'Texto perdido');
      check(n.tags.join(',') === 'playa,pendiente' && n.importance === 'alta' && n.created === date, 'Metadatos perdidos');
      check(n.folders.length === 2 && n.folders.every(id => x.folders.some(f => f.id === id)), 'Relaciones perdidas');
      check(x.folders.find(f => f.name === 'Calas').parent === x.folders.find(f => f.name === 'Viajes').id, 'Subcarpeta perdida');
      check(x.notes.some(n => n.deletedAt === date), 'Papelera perdida');
      check(await S.sha(await n.files[0].blob.arrayBuffer()) === await S.sha(bytes), 'Binario distinto');
      check(n.files[0].name === 'original.bin', 'Nombre original perdido');
    });
    await test('Copia alterada se rechaza y no cambia datos existentes', async () => {
      const bad = JSON.parse(JSON.stringify(backup)); bad.notes[0].body += 'alterado';
      await reject(() => S.restore(dest, bad), 'Aceptó copia alterada');
      check((await S.snapshot(dest)).notes.length === 2, 'Modificación parcial');
    });
    await test('Archivo alterado se rechaza incluso recalculando checksum del conjunto', async () => {
      const bad = JSON.parse(JSON.stringify(backup)); bad.notes[0].files[0].data = 'data:application/octet-stream;base64,AAAAAAAB';
      const payload = { id: bad.id, exported: bad.exported, folders: bad.folders, notes: bad.notes };
      bad.checksum = await S.sha(new TextEncoder().encode(JSON.stringify(payload)));
      await reject(() => S.restore(dest, bad), 'Aceptó binario alterado');
    });
    await test('Restaurar dos veces la misma copia no crea duplicados', async () => {
      await reject(() => S.restore(dest, backup), 'Aceptó importación duplicada');
      check((await S.snapshot(dest)).notes.length === 2, 'Duplicados');
    });
    await test('Fallo dentro de transacción revierte todas las escrituras', async () => {
      await reject(() => S.transaction(dest, ['notes'], tx => { tx.objectStore('notes').add({ id: 'rollback' }); throw Error('fallo simulado'); }), 'No rechazó fallo');
      check(!(await S.snapshot(dest)).notes.some(n => n.id === 'rollback'), 'Escritura parcial');
    });
    await test('Copia antigua v1 sigue siendo recuperable', async () => {
      const v1 = JSON.parse(JSON.stringify(backup)); v1.version = 1;
      await S.restore(legacyDest, v1); check((await S.snapshot(legacyDest)).notes.length === 2, 'Legacy no recuperada');
    });
    await test('Referencias cruzadas y ciclos se rechazan antes de escribir', async () => {
      const bad = JSON.parse(JSON.stringify(backup)); bad.version = 1; bad.folders[0].parent = 'child';
      await reject(() => S.restore(dest, bad), 'Aceptó ciclo');
      bad.folders[0].parent = null; bad.folders[0].space = 'trabajo';
      await reject(() => S.restore(dest, bad), 'Aceptó relación cruzada');
    });
    await test('La papelera impide purgar antes de 15 días y protege recuperaciones de otra pestaña', async () => {
      const n = (await S.snapshot(db)).notes.find(n => n.id === 'note');
      await S.trash(db, n); const trashed = (await S.snapshot(db)).notes.find(n => n.id === 'note');
      await reject(() => S.purge(db, trashed), 'Permitió purga prematura');
      const expired = (await S.snapshot(db)).notes.find(n => n.id === 'deleted');
      await S.trash(db, expired, true);
      await reject(() => S.purge(db, expired), 'Eliminó un recuerdo recuperado en otra pestaña');
      check((await S.snapshot(db)).notes.some(n => n.id === 'deleted' && !n.deletedAt), 'Se perdió el recuperado');
    });
    await test('No se elimina una carpeta con recuerdos ni subcarpetas', async () => {
      await reject(() => S.deleteEmptyFolder(db, 'parent'), 'Eliminó padre');
      await reject(() => S.deleteEmptyFolder(db, 'child'), 'Eliminó carpeta ocupada');
      check((await S.snapshot(db)).folders.length === 2, 'Se perdieron carpetas');
    });
    results.push('\n12/12 pruebas superadas.'); document.title = 'MEMORIA — 12/12 pruebas OK';
  } catch (e) { results.push('FALLO · ' + e.stack); document.title = 'MEMORIA — FALLO'; }
  finally {
    handles.forEach(db => db.close());
    // Solo bases ficticias creadas en esta ejecución.
    await Promise.all(names.map(name => new Promise(resolve => { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = resolve; })));
    out.textContent = results.join('\n');
  }
})();
