# Conclusiones del spike (fase 0)

Notas de trabajo. Al cerrar la fase se pasan en limpio a `docs/fuentes.md`.

## 1. Open-Meteo Marine y Forecast (2026-10-22)

Script: `spike/open-meteo.ts`. Seis playas de prueba en una sola petición por API (admite varias coordenadas separadas por comas).

### Marine API
- Todas las variables pedidas existen: altura, dirección y periodo de ola total, de mar de viento y de mar de fondo, y temperatura del agua.
- **Horizonte real: unos 10 días.** Aunque se pidan 16, desde el día 11 todo es `null`. Hay que pedir `forecast_days=10`.
- **Malla de 1/12° (~9 km).** Cerca de la costa la celda queda lejos: Águilas a 12,9 km, Los Alcázares a 13,4 km.
- **Varias playas comparten celda** (La Manga y Cabo de Palos). Esto apoya la idea de agrupar playas en puntos de consulta (fase 4).
- **No cubre el Mar Menor.** Las dos playas de la laguna caen en celdas del Mediterráneo. Esto confirma el diseño de `laguna`: oleaje estimado a partir del viento local.
- **Aviso: Temperatura del agua del Mar Menor:** tampoco la da. Habrá que buscar otra fuente o documentarla como estimación.

### Forecast API
- Viento, rachas, temperatura del aire y nubes: sin huecos durante **16 días**.
- Unidades: km/h (con `wind_speed_unit=kmh`), grados, °C y %.
- **La celda importa mucho.** Por defecto elige celda de tierra. Con `cell_selection=sea` cambia bastante en la costa (Cabo de Palos, 00:00 UTC: 5,1 km/h en tierra frente a 12,2 km/h en mar; 19 °C frente a 22 °C).
  - Propuesta: viento con la celda de mar (es el que llega a la playa) y decidir en la fase 4 qué celda usar para la temperatura del aire.

### Pendiente de confirmar en la documentación
- Condiciones de uso: gratis para uso no comercial con límite diario de llamadas. Licencia de los datos CC BY 4.0, con atribución obligatoria.

## 2. AEMET OpenData, predicción de playas (2026-10-22)

Script: `spike/aemet.ts` (se ejecuta con `node --env-file=.env`).

### Cómo funciona
- **Listado de playas:** CSV público con código, nombre, municipio y coordenadas en grados, minutos y segundos (`Playas_codigos.csv`, en ISO-8859-15).
- **Predicción:** `GET /prediccion/especifica/playa/{id}` con la clave en la cabecera `api_key`. Devuelve una URL temporal (`datos`) y hay que hacer una **segunda petición** para descargar el contenido. Es decir, 2 llamadas por playa.
- **Codificación:** ISO-8859-15. Hay que decodificarla bien o se rompen las tildes.
- **Aviso: Límite de peticiones:** tras unas 40 llamadas en menos de un minuto responde `429`. Hacen falta pausas y reintentos.
- **Licencia:** uso y reproducción autorizados citando a AEMET como autora.

### Cobertura
- **Solo 30 playas en Murcia**: Águilas 6, Cartagena 7, Lorca 1, Mazarrón 5, San Javier 4, San Pedro del Pinatar 3, Los Alcázares 3 y La Unión 1. El censo tendrá muchas más.
- **Nuevo: La Unión** (playa del Lastre, Portmán) es municipio costero y faltaba en la lista del RoadMap.

### Contenido: poco útil para la nota
- **Solo 3 días** (hoy, mañana y pasado), con dos valores por día (mañana y tarde: `f1`/`f2`).
- **Viento y oleaje solo como categoría** (flojo/moderado, débil…). **No hay dirección ni valores numéricos**, así que no sirven para el cálculo de orientación.
- Cielo por categoría, temperatura máxima, sensación térmica, **índice UV máximo** y **temperatura del agua** (entera, en °C).
- Las claves vienen duplicadas con distinta capitalización (`tMaxima`/`tmaxima`, `tAgua`/`tagua`).

### Lo valioso: temperatura del agua del Mar Menor
- AEMET **sí distingue la laguna**: Los Urrutias, Colón, Mistral, Villananitos, Punta Calera, El Espejo y Manzanares dan **20 °C**, frente a 23-25 °C en el Mediterráneo.
- **Aviso: Corrige una suposición del RoadMap:** el Mar Menor no siempre está "más templado". Al ser poco profundo, en verano está más caliente y en otoño o invierno más frío que el Mediterráneo.
- Sospechoso: el valor es idéntico (20) en todas las playas de la laguna y en los 3 días. Puede ser un valor climatológico o de baja resolución. Hay que vigilarlo varios días.

### Uso propuesto
- **No sirve como fuente principal**: la nota necesita direcciones y valores numéricos, que solo da Open-Meteo.
- **Sí sirve como complemento:** temperatura del agua del Mar Menor y, quizá, contraste o "segunda opinión" en la ficha de las 30 playas que cubre.

## 3. Censo de aguas de baño y guía de playas (2026-10-22, en curso)

### Certificados de las webs del Gobierno (afecta a MITECO y MAPA)
- Usan certificados de la FNMT, cuyas raíces **no vienen** en el almacén de Ubuntu ni en el de Node. Sin ellas, `curl` y `fetch` fallan con error de certificado.
- Además, `wms.mapama.gob.es` no envía el certificado intermedio.
- Solución, sin desactivar la verificación: `spike/fnmt-ca.pem` reúne tres certificados descargados de la sede oficial (sede.fnmt.gob.es/descargas/certificados-raiz-de-la-fnmt) con su huella SHA-1 comprobada:
  - AC RAIZ FNMT-RCM SERVIDORES SEGUROS G2R: `19:87:94:8D:AB:7D:62:00:9E:2D:6B:BE:D8:83:DC:3A:F5:67:99:E8`
  - AC RAIZ FNMT-RCM: `EC:50:35:07:B2:15:C4:95:62:19:E2:A8:9A:5B:42:99:2C:4C:2C:20` (caduca en 2030)
  - AC Componentes Informáticos (intermedio): `C7:72:B4:8D:23:85:E5:02:E8:47:37:DB:E7:87:B6:43:11:91:12:47` (caduca en 2028)
- Uso: `curl --cacert spike/fnmt-ca.pem` o, en Node, `NODE_EXTRA_CA_CERTS=spike/fnmt-ca.pem`.

### Censo de zonas de aguas de baño
- Fuente oficial: Ministerio de Sanidad (sistema Náyade), publicado por MITECO. Edición 2025, actualizada el 30/11/2025. Es una capa de puntos.
- **El enlace de datos.gob.es está roto** (404). El bueno está en la página de descargas de MITECO: miteco.gob.es/es/cartografia-y-sig/ide/descargas/agua/censo-aguas-bano.html.
- Formatos: shapefile (.zip), GML, KMZ y una ficha PDF que describe los campos (`gis.miteco.gob.es/descargas/info/CensoAguasBano2025.pdf`).
- **Aviso: la descarga tiene un captcha antibots (ALTCHA).** No se puede automatizar. Como la publicación es anual, se descarga a mano una vez al año y el import trabaja con el fichero local.
- El servicio WMS solo da imágenes del mapa. No hay WFS.
- Licencia: uso libre y gratuito citando al Ministerio como autor.
- Pendiente: ver los campos y cuántas zonas hay en Murcia, cuando se descargue el fichero.

### Guía de playas
- **No se encuentra como dato abierto descargable.** La app de playas del Ministerio está retirada (según datos.gob.es) y la página de la guía no ofrece ficheros.
- Alternativa a probar en la fase 3: etiquetas de OpenStreetMap (`natural=beach` con `supervised`, `dog`, `wheelchair`, `nudism`…). Overpass exige un User-Agent identificado (sin él devuelve 406) y estaba saturado (502) al probarlo.
