/* Recepción local: este código nunca envía contenido a un servidor. */
'use strict';
const MemoriaCapture = (() => {
  const LIMIT = 150 * 1048576;
  function links(text) {
    const result = new Set();
    for (const match of String(text).matchAll(/https?:\/\/[^\s<>"']+/gi)) {
      try {
        const candidate = match[0].replace(/[.,;!?)\]}]+$/, '');
        const url = new URL(candidate);
        if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) result.add(url.href);
      } catch { /* Texto libre: conservarlo aunque no sea un enlace válido. */ }
      if (result.size >= 100) break;
    }
    return [...result];
  }

  async function fromForm(form) {
    const get = key => typeof form.get(key) === 'string' ? form.get(key) : '';
    const title = get('title');
    const body = [get('text'), get('url')].filter(Boolean).filter((s, i, a) => a.indexOf(s) === i).join('\n');
    if (title.length + body.length > 1048576) throw new Error('El texto supera el límite de recepción de 1 MB.');
    const files = [];
    for (const value of form.getAll('files')) {
      if (typeof value === 'string' || (!value.name && value.size === 0)) continue;
      if (!(value instanceof Blob)) throw new Error('Adjunto no válido.');
      files.push({ name: value.name || 'archivo', type: value.type || 'application/octet-stream', size: value.size, blob: value });
    }
    if (files.reduce((sum, f) => sum + f.size, 0) > LIMIT) throw new Error('El contenido supera el límite provisional de 150 MB por recuerdo. Comparte menos archivos cada vez.');
    if (!title.trim() && !body.trim() && !files.length) throw new Error('No se recibió texto ni archivos.');
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(), space: 'personal',
      title: title.trim().slice(0, 250) || body.trim().split('\n')[0].slice(0, 100) || files[0].name,
      // Algunas apps ponen todo el contenido en title. Conservarlo también en el cuerpo.
      body: title.length > 250 || (!body && title) ? [title, body].filter(Boolean).join('\n') : body,
      files, tags: [], folders: [], importance: 'normal', created: now, updated: now,
      deletedAt: null, pendingReview: true, source: 'android-share',
    };
  }

  async function receive(request, scope, dbName = 'memoria') {
    let db;
    try {
      if (request.method !== 'POST') throw new Error('Esta dirección recibe contenido desde el menú Compartir.');
      const note = await fromForm(await request.formData());
      db = await MemoriaStore.open(dbName);
      await MemoriaStore.saveNote(db, note);
      const destination = new URL('./', scope);
      destination.searchParams.set('received', note.id);
      return Response.redirect(destination.href, 303);
    } catch (error) {
      // Mensajes fijos, no incluir texto compartido ni detalles del archivo.
      return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEMORIA — contenido no guardado</title><h1>No se ha guardado el contenido</h1><p>Vuelve a la aplicación de origen e inténtalo otra vez. Comprueba el espacio libre y comparte menos archivos (máximo provisional 150 MB).</p><p>Abre MEMORIA con conexión una vez si acabas de actualizarla. No borres sus datos.</p></html>', { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    } finally { db?.close(); }
  }
  return { links, fromForm, receive };
})();
