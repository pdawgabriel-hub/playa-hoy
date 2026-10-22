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

## 3. Censo de aguas de baño y guía de playas (2026-10-22)

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

#### Contenido (script: `spike/censo.ts`, lector de shapefile sin dependencias)
- Shapefile de puntos en **WGS84 (grados)** y UTF-8. 2.304 zonas en toda España y 31 campos, casi todos de metadatos INSPIRE.
- Campos útiles: `localId` (código europeo de la zona, estable entre años), `nameText` (nombre), coordenadas, `spZoneType` (costera, de transición, de río…), `wEvolution` y `predecesId` (cambios de código respecto al año anterior) y `link` (ficha en Náyade).
- **Sin campo de municipio, pero el código lo lleva dentro:** `ES620M` + código INE del municipio (3 dígitos) + número. `ES620` es el código NUTS de Murcia.
- **83 zonas en Murcia, todas costeras:** Cartagena 32, Águilas 13, San Javier 13, Mazarrón 10, Los Alcázares 6, San Pedro del Pinatar 6, Lorca 2 y La Unión 1. AEMET solo cubre 30.
- Una zona es un **punto de muestreo** (sufijo `PM1`), no exactamente una playa. Los Nietos y Los Urrutias tienen dos puntos (`PM1` y `PM2`).
- Nombres en mayúsculas y con prefijo "PLAYA". Una tilde llega rota en `nameText` ("CARRI?N"). `nameTxtInt` es la versión sin tildes.
- **Aviso: no incluye la calidad del agua.** Solo enlaza a la ficha de Náyade. La calidad por temporada (tabla `calidad_agua`) tendrá que salir de otra fuente: Náyade o los informes de la EEA.
- **Aviso: hay playas conocidas que no están en el censo**, como Calblanque (la zona más cercana a la Calblanque de AEMET está a 2 km). El censo solo recoge las zonas vigiladas oficialmente, así que el catálogo necesitará otra fuente para calas y playas no censadas (OpenStreetMap).

#### Cruce con AEMET
- Emparejar por la zona más cercana **no basta**: 26 de las 30 quedan a menos de 500 m, pero hay errores. La Colonia y Poniente (Águilas) salen cruzadas, y El Espejo y Manzanares caen en el mismo punto.
- Hará falta emparejar por nombre y distancia, con una tabla de correspondencias revisada a mano.

### Guía de playas
- **No se encuentra como dato abierto descargable.** La app de playas del Ministerio está retirada (según datos.gob.es) y la página de la guía no ofrece ficheros.
- Alternativa a probar en la fase 3: etiquetas de OpenStreetMap (`natural=beach` con `supervised`, `dog`, `wheelchair`, `nudism`…). Overpass exige un User-Agent identificado (sin él devuelve 406) y estaba saturado (502) al probarlo.

## 4. Histórico de Open-Meteo (2026-10-22)

Script: `spike/open-meteo-historico.ts`. Punto de prueba: Cabo de Palos. Se pidió un día de cada época y se contaron los huecos.

### Qué hay y desde cuándo

| Datos | API y modelo | Desde | Malla | Retraso |
|---|---|---|---|---|
| Viento, temperatura del aire y nubes | `archive` (reanálisis, por defecto) | **1940** | ~9 km | Al día (con datos de hace 3 días) |
| Lo mismo | `archive`, `models=era5` | 1940 | 0,25° (~25 km) | Unos 5 días |
| **Oleaje** | `marine` por defecto | **octubre de 2021** | ~9 km (la misma que la previsión) | Al día |
| **Temperatura del agua** | `marine` por defecto | **enero de 2023** | ~9 km | Al día |
| Oleaje | `marine`, `models=era5_ocean` | ~1950 (1940 vacío, 1960 sí) | 0,5° (~50 km; la celda queda a 20 km de la costa) | Unos 5 días |
| Oleaje | `ecmwf_wam025` / `meteofrance_wave` | 2024 / 2022 | 0,25° / ~9 km | - |
| Previsiones antiguas (la mejor de cada momento) | `historical-forecast` | 2016 según la API, **con datos reales desde 2017-2018** | ~2 km | - |
| **Previsiones con antelación** (`_previous_day1` … `_previous_day7`) | `previous-runs` | **2024** (entre julio de 2023 y julio de 2024) | ~2 km | - |

- El reanálisis (`archive`) **no da temperatura del agua**. `era5_ocean` da oleaje pero tampoco temperatura del agua.
- La API marina también acepta variables `_previous_dayN` (por ejemplo, `wave_height_previous_day1`).

### Consecuencias para el proyecto
- **Estadísticas de viento (fase 11):** sin problema, más de 80 años de datos.
- **Días buenos por playa y mes:** necesitan el oleaje a la misma resolución que la previsión, que solo existe **desde octubre de 2021**. Son 5 veranos (2022-2026): suficiente para porcentajes por mes, con la advertencia de que es una muestra corta. `era5_ocean` llega más atrás, pero su malla de 50 km no distingue playas.
- **Aviso: tendencia de la temperatura del agua:** solo hay datos **desde 2023** (4 años), que no bastan para hablar de tendencia. Opciones: (a) mostrar solo la media por mes, sin tendencia; (b) buscar un reanálisis de temperatura del mar más largo, como Copernicus Marine (desde 1982, requiere cuenta gratuita). Pendiente de decidir.
- **Fiabilidad de la previsión (fase 12): buena noticia.** `previous-runs` da lo que se predijo con 1 a 7 días de antelación desde 2024, también para el oleaje. Se puede medir el error **sin esperar meses** a acumular nuestras propias emisiones. Faltan las observaciones reales (paso 5).
- Ingesta del histórico: una petición por punto puede cubrir un rango largo de fechas (`start_date`/`end_date`), así que rellenarlo cuesta pocas llamadas.
