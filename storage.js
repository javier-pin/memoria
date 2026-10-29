/* MEMORIA: datos locales y formato de copia. Sin servicios externos. */
'use strict';
const MemoriaStore = (() => {
  const DAYS = 15 * 86400000;
  const req = r => new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const sha = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const digest = value => sha(new TextEncoder().encode(JSON.stringify(value)));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const text = value => typeof value === 'string';
  const validSpace = value => ['personal', 'trabajo'].includes(value);
  const toBase64 = bytes => {
    let result = '';
    for (let i = 0; i < bytes.length; i += 16384) result += String.fromCharCode(...bytes.subarray(i, i + 16384));
    return btoa(result);
  };

  async function open(name = 'memoria') {
    const r = indexedDB.open(name, 2);
    r.onupgradeneeded = () => {
      for (const store of ['notes', 'folders', 'settings']) {
        if (!r.result.objectStoreNames.contains(store)) r.result.createObjectStore(store, { keyPath: 'id' });
      }
    };
    r.onblocked = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('memoria-blocked')); };
    const db = await req(r);
    db.onversionchange = () => { db.close(); if (typeof window !== 'undefined') window.dispatchEvent(new Event('memoria-blocked')); };
    return db;
  }

  function transaction(db, stores, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      let failure;
      tx.oncomplete = resolve;
      tx.onabort = () => reject(failure || tx.error || new Error('No se ha guardado ningún cambio.'));
      tx.onerror = () => { failure ||= tx.error; };
      const abort = error => { failure = error; tx.abort(); };
      try { action(tx, abort); } catch (error) { abort(error); }
    });
  }

  async function snapshot(db) {
    const tx = db.transaction(['notes', 'folders', 'settings']);
    const [notes, folders, settings] = await Promise.all(['notes', 'folders', 'settings'].map(s => req(tx.objectStore(s).getAll())));
    return { notes, folders, settings };
  }

  // Comprueba la revisión dentro de la transacción para evitar sobrescribir otra pestaña.
  async function saveNote(db, note, expectedRevision = null) {
    const id = note.id;
    await transaction(db, ['notes'], (tx, abort) => {
      const store = tx.objectStore('notes');
      const r = store.get(id);
      r.onsuccess = () => {
        const old = r.result;
        if ((old ? old.revision || 0 : null) !== expectedRevision) {
          abort(new Error('Este recuerdo cambió en otra pestaña. Cierra el editor y vuelve a abrirlo; tu texto sigue aquí para copiarlo.'));
          return;
        }
        store.put({ ...note, revision: (old?.revision || 0) + 1 });
      };
    });
  }

  async function trash(db, note, restore = false) {
    await saveNote(db, {
      ...note,
      deletedAt: restore ? null : new Date().toISOString(),
      updated: new Date().toISOString(),
    }, note.revision || 0);
  }

  async function purge(db, note) {
    await transaction(db, ['notes'], (tx, abort) => {
      const store = tx.objectStore('notes'), r = store.get(note.id);
      r.onsuccess = () => {
        const current = r.result;
        if (!current?.deletedAt || current.revision !== note.revision || Date.now() < Date.parse(current.deletedAt) + DAYS) {
          abort(new Error('El recuerdo cambió o sigue protegido por la papelera. Actualiza la vista.')); return;
        }
        store.delete(note.id);
      };
    });
  }

  async function deleteEmptyFolder(db, id) {
    await transaction(db, ['notes', 'folders'], (tx, abort) => {
      const folders = tx.objectStore('folders'), notes = tx.objectStore('notes');
      const fr = folders.getAll(), nr = notes.getAll();
      let fs, ns;
      const check = () => {
        if (!fs || !ns) return;
        if (fs.some(f => f.parent === id) || ns.some(n => n.folders.includes(id))) {
          abort(new Error('La carpeta contiene subcarpetas o recuerdos, incluidos los de la papelera.')); return;
        }
        folders.delete(id);
      };
      fr.onsuccess = () => { fs = fr.result; check(); };
      nr.onsuccess = () => { ns = nr.result; check(); };
    });
  }

  function validate(x) {
    assert(x?.format === 'MEMORIA' && [1, 2].includes(x.version), 'Formato de copia no compatible.');
    assert(Array.isArray(x.folders) && Array.isArray(x.notes), 'Faltan carpetas o recuerdos.');
    if (x.version === 2) {
      assert(text(x.id) && date(x.exported) && /^[a-f0-9]{64}$/.test(x.checksum), 'Cabecera de copia no válida.');
    }
    const folders = new Map();
    for (const f of x.folders) {
      assert(f && text(f.id) && f.id && !folders.has(f.id) && text(f.name) && f.name.trim() && validSpace(f.space), 'Carpeta no válida o duplicada.');
      assert(f.parent === null || text(f.parent), 'Carpeta superior no válida.');
      folders.set(f.id, f);
    }
    for (const f of x.folders) {
      const seen = new Set();
      let current = f;
      while (current) {
        assert(!seen.has(current.id), 'Relación circular de carpetas.');
        seen.add(current.id);
        if (!current.parent) break;
        const parent = folders.get(current.parent);
        assert(parent && parent.space === f.space, 'Carpeta superior ausente o de otro espacio.');
        current = parent;
      }
    }
    const ids = new Set();
    for (const n of x.notes) {
      assert(n && text(n.id) && n.id && !ids.has(n.id) && validSpace(n.space) && text(n.title) && text(n.body), 'Recuerdo no válido o duplicado.');
      ids.add(n.id);
      assert(date(n.created) && date(n.updated) && (!n.deletedAt || date(n.deletedAt)), 'Fechas no válidas.');
      assert(['normal', 'alta'].includes(n.importance), 'Importancia no válida.');
      assert(Array.isArray(n.tags) && n.tags.every(text), 'Etiquetas no válidas.');
      assert(Array.isArray(n.folders) && n.folders.every(id => folders.get(id)?.space === n.space), 'Relación con carpeta no válida.');
      assert(Array.isArray(n.files), 'Lista de adjuntos no válida.');
      for (const f of n.files) {
        assert(f && text(f.name) && text(f.type) && Number.isSafeInteger(f.size) && f.size >= 0 && text(f.data), 'Adjunto no válido.');
        assert(/^data:[^,]*;base64,[A-Za-z0-9+/]*={0,2}$/.test(f.data), 'Codificación de adjunto no válida.');
        if (x.version === 2) assert(/^[a-f0-9]{64}$/.test(f.sha256), 'Falta la huella del adjunto.');
      }
    }
    return x;
  }

  const payload = x => ({ id: x.id, exported: x.exported, folders: x.folders, notes: x.notes });

  async function decode(input) {
    const x = validate(input);
    if (x.version === 2) assert(await digest(payload(x)) === x.checksum, 'La copia ha cambiado o está dañada. No se ha importado nada.');
    const notes = [];
    for (const n of x.notes) {
      const files = [];
      for (const f of n.files) {
        const raw = atob(f.data.slice(f.data.indexOf(',') + 1));
        const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
        assert(bytes.length === f.size, 'Tamaño incorrecto del archivo: ' + f.name);
        if (x.version === 2) assert(await sha(bytes) === f.sha256, 'Archivo dañado: ' + f.name);
        files.push({ name: f.name, type: f.type, size: f.size, blob: new Blob([bytes], { type: f.type }) });
      }
      notes.push({ ...n, files });
    }
    return { ...x, notes };
  }

  async function backup(db) {
    const state = await snapshot(db);
    const notes = [];
    for (const n of state.notes) {
      const files = [];
      for (const f of n.files) {
        const bytes = new Uint8Array(await f.blob.arrayBuffer());
        assert(bytes.length === f.size, 'El archivo local no coincide con su tamaño: ' + f.name);
        files.push({ name: f.name, type: f.type, size: f.size, data: 'data:application/octet-stream;base64,' + toBase64(bytes), sha256: await sha(bytes) });
      }
      notes.push({ ...n, revision: undefined, files });
    }
    const result = JSON.parse(JSON.stringify({ format: 'MEMORIA', version: 2, id: crypto.randomUUID(), exported: new Date().toISOString(), folders: state.folders, notes }));
    result.checksum = await digest(payload(result));
    // Verifica lo que realmente se serializará, antes de ofrecer la descarga.
    await decode(JSON.parse(JSON.stringify(result)));
    return result;
  }

  async function restore(db, input) {
    const parsed = await decode(input); // Toda la verificación ocurre antes de escribir.
    const folderMap = new Map(parsed.folders.map(f => [f.id, crypto.randomUUID()]));
    const folders = parsed.folders.map(f => ({ ...f, id: folderMap.get(f.id), parent: f.parent ? folderMap.get(f.parent) : null }));
    const notes = parsed.notes.map(n => ({ ...n, id: crypto.randomUUID(), revision: 1, folders: n.folders.map(id => folderMap.get(id)) }));
    const importId = parsed.version === 2 ? parsed.id : 'legacy-' + await digest(input);
    await transaction(db, ['folders', 'notes', 'settings'], (tx, abort) => {
      const settings = tx.objectStore('settings');
      const key = 'import:' + importId;
      const r = settings.get(key);
      r.onsuccess = () => {
        if (r.result) { abort(new Error('Esta copia ya se restauró aquí. No se han creado duplicados.')); return; }
        folders.forEach(f => tx.objectStore('folders').add(f));
        notes.forEach(n => tx.objectStore('notes').add(n));
        settings.put({ id: key, restored: new Date().toISOString() });
        settings.put({ id: 'lastRestore', value: new Date().toISOString(), verified: parsed.version === 2 });
      };
    });
    return { notes: notes.length, folders: folders.length, verified: parsed.version === 2 };
  }

  async function setting(db, id, value) {
    await transaction(db, ['settings'], tx => tx.objectStore('settings').put({ id, value }));
  }
  return { DAYS, open, transaction, snapshot, saveNote, trash, purge, deleteEmptyFolder, backup, decode, restore, validate, setting, sha };
})();
if (typeof module !== 'undefined') module.exports = MemoriaStore;
