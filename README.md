# MEMORIA 0.2.1 — reconstrucción

PWA estática sin dependencias ni servicios externos. No contiene datos reales.

Implementado: espacios Personal/Trabajo, carpetas anidadas, notas, adjuntos originales en IndexedDB, etiquetas, importancia, búsqueda de metadatos, bandeja, vistas y tema. Exportación JSON completa (adjuntos en base64) y restauración aditiva validada en una transacción. Una nota puede pertenecer a varias carpetas sin duplicar adjuntos.

Pendiente: Google, Drive, sincronización y conflictos, cifrado y PIN, papelera, tareas, OCR, compartir desde Android, mover carpetas y deshacer/rehacer. No se promete seguridad para información sensible. La separación de espacios es organizativa.

Los datos pertenecen al navegador y al origen web; cambiar de URL o borrar datos del navegador puede hacerlos inaccesibles. No hay copias automáticas. Exportar regularmente. El almacenamiento puede ser desalojado por el navegador. Límite de 150 MB de adjuntos por nota y 250 MB de copia al restaurar; la exportación usa memoria y no es adecuada para bibliotecas grandes.

GitHub Pages: publicar exclusivamente index.html, style.css, app.js, manifest.webmanifest, sw.js e icons/. Usar HTTPS y abrir una vez con conexión. Las rutas relativas permiten alojar en /memoria/. Instalar desde Chrome Android o Chrome/Edge Windows. iOS y otros navegadores pueden tener diferencias.

Prueba manual: crear una carpeta y nota con imagen, recargar, exportar; restaurar y comprobar contenido del adjunto. Esperar la preparación sin conexión, cerrar y reabrir sin red, consultar y editar la nota y recargar. Verificar también desde el teléfono; el navegador de escritorio no sustituye una prueba física Android.

La ejecución periódica en segundo plano de una PWA no está garantizada; una copia diaria y sincronización requieren diseñar recuperación, verificación e interacción con OAuth, no solo configurar un intervalo.
