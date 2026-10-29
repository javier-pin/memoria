# Formato abierto de copia MEMORIA

Versión 2: JSON UTF-8. Cabecera: format="MEMORIA", version=2, id UUID de la copia, exported fecha ISO, folders, notes, checksum.

folders: array de {id,name,space,parent}. space es personal o trabajo. parent es null o ID de otra carpeta del mismo espacio; sin ciclos.

notes: array de {id,space,title,body,tags,importance,folders,files,created,updated,deletedAt?}. tags y folders son arrays; importance es normal o alta; fechas ISO; deletedAt null/ausente para activos. Papelera incluida.

files: array de {name,type,size,data,sha256}. Nombre original, MIME y bytes originales como URL data base64; el MIME del envoltorio no sustituye type. sha256 es huella hexadecimal minúscula de bytes decodificados.

checksum: SHA-256 hexadecimal minúscula de TextEncoder( JSON.stringify({id,exported,folders,notes}) ). Orden de las cuatro propiedades superiores exactamente como se indica. Orden de propiedades interiores es el del JSON recibido; conservarlo si se reescribe la copia. Cambiar espacios entre tokens no afecta; reordenar propiedades exige recalcular huella. Detección de corrupción, no firma ni cifrado.

Importación verifica conjunto y binarios antes de escribir. Genera nuevos IDs de carpetas y notas preservando relaciones y registra import:<id> para rechazar reimportaciones. No sobrescribe datos existentes. Sin deduplicación de copias distintas solapadas.

Versión 1: mismos datos básicos, sin id de copia ni huellas obligatorias. Se admite con aviso. No se convierte retroactivamente en copia autenticada.

Para migrar fuera de MEMORIA: decodificar cada data a un archivo (usar rutas propias para evitar colisiones o nombres inseguros) y conservar notas, metadatos y relaciones JSON. La aplicación no interpreta nombres de adjunto como rutas del sistema.
