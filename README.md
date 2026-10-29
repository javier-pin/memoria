# MEMORIA 0.4 — recepción compartida

PWA estática sin dependencias de producción. Notas, adjuntos originales, Personal/Trabajo, carpetas anidadas, etiquetas, bandeja, vistas y tema. Datos locales en IndexedDB. No contiene archivos personales ni credenciales.

## Nuevo en 0.4

Web Share Target POST multipart para texto, enlaces y archivos. El service worker guarda el contenido localmente antes de redirigir al editor. Se recibe por defecto en la bandeja de Personal con la marca «por revisar»; puede elegirse Trabajo en el formulario. Cerrar la ficha conserva lo recibido. No se consulta automáticamente la web compartida ni se envían archivos a GitHub. Enlaces http/https con apertura voluntaria; vídeos y audios locales tienen controles de reproducción según soporte del navegador.

La app debe estar instalada y actualizada para aparecer como destino Android. El registro del sistema puede tardar en actualizarse; falta verificar el menú Compartir físicamente en el móvil del usuario. No desinstalar ni borrar datos del sitio para forzar la actualización sin disponer de copia verificada.

Recibir un enlace de Maps no extrae todavía dirección/coordenadas: se conserva el enlace y su texto. Mapa, fichas de ubicaciones, favoritos y filtros avanzados siguen pendientes. Esta versión cubre la base de captura de la fase 0.4.

## Protección incorporada

- Papelera con conservación mínima de 15 días. Después se permite limpieza manual con confirmación; no hay borrado automático. Copias incluyen la papelera.
- Copias JSON v2 con SHA-256 por archivo y conjunto, verificadas antes de la descarga y antes de importar. «Verificar copia» comprueba el archivo seleccionado sin importarlo. Detecta alteraciones accidentales; no cifra ni autentica al autor.
- Restauración aditiva en una transacción sin sustituir datos existentes. Repetir la misma copia se rechaza. Exportaciones independientes de los mismos datos pueden crear duplicados al importarlas ambas: no hay deduplicación global.
- Compatibilidad con copias v1, sin huellas de integridad.
- Revisión por nota para rechazar ediciones obsoletas de otras pestañas. Migración de base v1 a v2 sin vaciar almacenes.
- Panel con tamaño de originales, cuota estimada y fechas de preparación/verificación/restauración. Preparar una descarga no confirma que se haya conservado.
- Título opcional y clasificación plegada para guardar más rápido.

## Límites actuales

Sin Google, Drive, sincronización, cifrado, PIN, tareas, OCR ni IA. Los espacios son separación organizativa. Las copias contienen información legible y deben guardarse de forma privada.

Los datos pertenecen al navegador y al origen web. Borrar datos del sitio o perder el dispositivo puede hacerlos desaparecer. Solicitar almacenamiento persistente depende del navegador y no reemplaza copias independientes. No hay copias automáticas ni garantía de ejecución diaria en segundo plano.

Límites provisionales: 150 MB de originales por nota y por exportación; importación JSON hasta 250 MB. Se usa base64 y memoria para preparar copias. No es apto para colecciones grandes de vídeos; se planifica separar binarios y metadatos y exportar por partes. Nunca se borran datos para cumplir los límites.

Adjuntos eliminados al editar una nota no tienen historial propio: hacer copia antes de editar contenido importante. Papelera protege recuerdos completos. Sin deshacer/rehacer ni historial de notas por ahora.

## Pruebas

Ejecutar `node serve.cjs` y abrir http://127.0.0.1:4173/tests.html. Se crean y eliminan solo bases ficticias `memoria-test-<UUID>`. Se prueba migración, exportar/restaurar originales y relaciones, corrupción, transacciones fallidas, duplicados y conflictos. No toca la base `memoria` del usuario. Cerrar pestañas antiguas si la actualización de base queda bloqueada.

tests-capture.html: seis pruebas de recepción, originales y URLs en bases aisladas. tests-share-form.html es un formulario de ejemplo ficticio que sí crea una nota de prueba en la base local normal: precargar, parar servidor y enviar permite verificar el receptor real offline. No es una prueba de presencia en el selector nativo Android.

Prueba sin servidor: abrir app y esperar preparación; detener servidor y recargar. Probar también físicamente en Android con modo avión.

## Publicación

https://javier-pin.github.io/memoria/ — GitHub Pages desde main. Publicar solo aplicación, documentación técnica y pruebas sintéticas. Nunca copias, notas, credenciales o documentos personales.

Primera actualización desde 0.2.1: cerrar todas las pestañas/ventanas de MEMORIA y volver a abrir con conexión; si muestra versión antigua, repetir después de permitir descarga de actualización. Desde 0.3 habrá aviso de actualización sin interrumpir notas o copias en curso.
