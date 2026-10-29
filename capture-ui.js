'use strict';
function renderCaptureDetails() {
  for (const card of $('notes').querySelectorAll('[data-note-id]')) {
    const note = data.notes.find(n => n.id === card.dataset.noteId);
    if (!note) continue;
    if (note.pendingReview && !note.deletedAt) card.prepend(node('span', 'Compartido · por revisar', 'tag'));
    const links = MemoriaCapture.links(note.title + '\n' + note.body);
    for (const href of links) {
      const url = new URL(href), a = node('a', '↗ Abrir ' + url.hostname);
      a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      card.insertBefore(a, card.querySelector('footer'));
    }
    for (const [index, file] of note.files.entries()) {
      if (!/^(video|audio)\//.test(file.type)) continue;
      const source = [...card.querySelectorAll('a[download]')][index];
      if (!source) continue;
      const media = node(file.type.startsWith('video/') ? 'video' : 'audio');
      media.controls = true; media.preload = 'none'; media.src = source.href;
      card.insertBefore(media, source);
    }
  }
}
function renderEditorFolders(targetSpace, selected = []) {
  $('noteFolders').replaceChildren();
  for (const f of folderList(targetSpace)) {
    const label = node('label'), cb = node('input'); cb.type = 'checkbox'; cb.value = f.id; cb.checked = selected.includes(f.id);
    label.append(cb, document.createTextNode(' ' + path(f))); $('noteFolders').append(label);
  }
}
$('noteSpace').onchange = () => renderEditorFolders($('noteSpace').value);
async function receiveSharedNote() {
  const url = new URL(location.href), id = url.searchParams.get('received');
  if (!id) return;
  // Solo un ID aleatorio, nunca el contenido, aparece en la dirección.
  history.replaceState(null, '', location.pathname);
  const note = data.notes.find(n => n.id === id && !n.deletedAt);
  if (!note) { status('No se encontró el contenido recibido. Revisa la bandeja o vuelve a compartirlo.'); return; }
  space = note.space; folder = 'inbox'; render(); openEditor(note);
  $('shareInfo').hidden = false;
  status('Contenido recibido y protegido en la bandeja local. Puedes clasificarlo después.');
}
