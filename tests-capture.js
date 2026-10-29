'use strict';
(async () => {
  const names = [], out = document.getElementById('results'), results = [];
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const test = async (label, action) => { await action(); results.push('OK · ' + label); out.textContent = results.join('\n'); };
  const make = values => { const f = new FormData(); for (const [key, value] of Object.entries(values)) f.append(key, value); return f; };
  try {
    await test('URL en texto Android conservada sin depender del campo url', async () => {
      const form = make({ title: 'Cala para visitar', text: 'Cerca de Denia https://maps.app.goo.gl/ejemplo' });
      const n = await MemoriaCapture.fromForm(form);
      check(n.title === 'Cala para visitar' && n.body.includes('https://maps.app.goo.gl/ejemplo'), 'Contenido perdido');
      check(n.pendingReview && n.folders.length === 0 && n.space === 'personal', 'No está en bandeja');
    });
    await test('URL en title y esquemas peligrosos no se convierten en enlaces activos', async () => {
      const links = MemoriaCapture.links('javascript:alert(1) https://example.com/lugar. https://example.com/lugar. https://user:pass@example.com/');
      check(links.length === 1 && links[0] === 'https://example.com/lugar', 'Enlace peligroso o duplicado');
    });
    await test('Fotografía y archivo binario conservan bytes y nombre original', async () => {
      const f = make({ text: 'Dos archivos' });
      f.append('files', new File([new Uint8Array([0,255,128])], 'foto.png', { type: 'image/png' }));
      f.append('files', new File([new Uint8Array([17,0,19])], 'manual.pdf', { type: 'application/pdf' }));
      const n = await MemoriaCapture.fromForm(f);
      check(n.files.length === 2 && n.files[1].name === 'manual.pdf', 'Archivos perdidos');
      check(new Uint8Array(await n.files[0].blob.arrayBuffer())[1] === 255, 'Binario alterado');
    });
    await test('Recepción POST → transacción → redirección solo después de guardar', async () => {
      const name = 'memoria-test-share-' + crypto.randomUUID(); names.push(name);
      const f = make({ text: 'Compartido ficticio https://example.com' });
      f.append('files', new File(['original'], 'prueba.txt', { type: 'text/plain' }));
      const response = await MemoriaCapture.receive(new Request('https://example.com/memoria/share-target', { method:'POST', body:f }), 'https://example.com/memoria/', name);
      check(response.status === 303, 'No redirigió');
      const location = new URL(response.headers.get('Location'));
      const db = await MemoriaStore.open(name);
      try {
        const state = await MemoriaStore.snapshot(db), n = state.notes[0];
        check(n.id === location.searchParams.get('received') && n.pendingReview, 'Redirigió sin dato durable');
        check(await n.files[0].blob.text() === 'original', 'Original perdido');
        check(!location.href.includes('Compartido'), 'Contenido en URL');
        const copy = await MemoriaStore.backup(db); check(copy.notes[0].pendingReview && copy.notes[0].files.length === 1, 'Recepción fuera de copia');
      } finally { db.close(); }
    });
    await test('Contenido vacío devuelve error sin crear un recuerdo', async () => {
      const name = 'memoria-test-share-' + crypto.randomUUID(); names.push(name);
      const response = await MemoriaCapture.receive(new Request('https://example.com/memoria/share-target', { method:'POST', body:new FormData() }), 'https://example.com/memoria/', name);
      check(response.status === 400, 'Falso éxito');
      const db = await MemoriaStore.open(name); try { check((await MemoriaStore.snapshot(db)).notes.length === 0, 'Guardó vacío'); } finally { db.close(); }
    });
    await test('Título largo se conserva completo en el cuerpo', async () => {
      const title = 'x'.repeat(600); const n = await MemoriaCapture.fromForm(make({ title, text:'comentario' }));
      check(n.title.length === 250 && n.body.includes(title) && n.body.includes('comentario'), 'Texto truncado');
    });
    results.push('\n6/6 pruebas superadas.'); document.title='MEMORIA — recepción 6/6 OK';
  } catch(e) { results.push('FALLO · ' + e.stack); document.title='MEMORIA — recepción FALLO'; }
  finally {
    await Promise.all(names.map(name => new Promise(resolve => { const r=indexedDB.deleteDatabase(name); r.onsuccess=r.onerror=r.onblocked=resolve; })));
    out.textContent=results.join('\n');
  }
})();
