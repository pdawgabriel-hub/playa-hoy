# Fuentes de datos

Resultado de la fase 0: qué da cada fuente, cómo se accede, en qué condiciones se puede usar y qué riesgos o huecos tiene. Todo se comprobó con peticiones reales el 22 de octubre de 2026. Los scripts de prueba y las notas de trabajo se conservan en el historial de git (carpeta `spike/`, eliminada al empezar la fase 2).

## Resumen

| Fuente                                                     | Uso en playa·hoy                                      | Acceso                         | Licencia                             | Riesgo principal                                 |
| ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------ | ------------------------------------ | ------------------------------------------------ |
| [Open-Meteo Marine](#open-meteo-marine)                    | Oleaje y temperatura del agua (previsión e histórico) | API sin clave                  | CC BY 4.0, uso no comercial          | Malla de ~9 km; no ve el Mar Menor               |
| [Open-Meteo Forecast](#open-meteo-forecast)                | Viento, aire y nubes (previsión)                      | API sin clave                  | CC BY 4.0, uso no comercial          | El resultado cambia mucho según la celda elegida |
| [Open-Meteo históricos](#open-meteo-históricos)            | Estadísticas y fiabilidad                             | API sin clave                  | CC BY 4.0, uso no comercial          | Oleaje solo desde 2021 y agua desde 2023         |
| [AEMET predicción de playas](#aemet-predicción-de-playas)  | Temperatura del agua del Mar Menor                    | API con clave                  | Citar a AEMET                        | Solo 30 playas, datos por categorías             |
| [AEMET observación](#aemet-observación)                    | Viento medido en la costa                             | API con clave                  | Citar a AEMET                        | Solo guarda 24 horas                             |
| [Censo de aguas de baño](#censo-de-zonas-de-aguas-de-baño) | Catálogo base de playas                               | Descarga manual anual          | Citar al Ministerio                  | Captcha; faltan playas no vigiladas              |
| [Boya de Cabo de Palos](#boya-de-cabo-de-palos)            | Oleaje y agua medidos                                 | Copernicus Marine (con cuenta) | Por confirmar                        | Sin probar; a 33 km de la costa                  |
| [OpenStreetMap](#openstreetmap)                            | Línea de costa y servicios                            | Overpass API                   | ODbL                                 | Sin probar en esta fase                          |
| [Calidad del agua (EEA)](#calidad-del-agua-eea)            | Calificación oficial por temporada                    | API sin clave                  | Reutilización citando a la EEA       | Publica con un año de retraso                    |
| [ITREM](#itrem-turismo-de-la-región-de-murcia)             | Accesible, suelo, ocupación, nudista                  | Fichero JSON sin clave         | Sin licencia declarada (Ley 37/2007) | Datos de 2018; coordenadas en dos sistemas       |
| [Guía de playas](#guía-de-playas)                          | (Servicios)                                           | **No disponible**              | -                                    | Descartada                                       |

## Open-Meteo Marine

- **Endpoint:** `https://marine-api.open-meteo.com/v1/marine`
- **Variables útiles (por hora):** `wave_height`, `wave_direction`, `wave_period`, `wind_wave_height`, `wind_wave_direction`, `swell_wave_height`, `swell_wave_direction`, `swell_wave_period`, `sea_surface_temperature`.
- **Horizonte:** unos **10 días**. Si se piden más, el resto llega como `null`. Usar `forecast_days=10`.
- **Resolución:** malla de 1/12° (~9 km). La celda asignada puede quedar a más de 12 km de la playa (Águilas, Los Alcázares).
- **Varias playas comparten celda** (por ejemplo, La Manga y Cabo de Palos). En la ingesta conviene agrupar las playas por celda para hacer menos llamadas.
- Admite varias coordenadas en una sola petición (`latitude=a,b,c&longitude=x,y,z`).

**Huecos**

- **No cubre el Mar Menor.** Las playas de la laguna caen en celdas del Mediterráneo, así que su oleaje se estima con el viento local (diseño de `laguna`).
- Tampoco da la temperatura del agua del Mar Menor. Ver [AEMET predicción de playas](#aemet-predicción-de-playas).

## Open-Meteo Forecast

- **Endpoint:** `https://api.open-meteo.com/v1/forecast`
- **Variables útiles (por hora):** `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `temperature_2m`, `cloud_cover`. Con `wind_speed_unit=kmh` el viento llega en km/h.
- **Horizonte:** 16 días sin huecos.
- **Elección de celda:** por defecto se usa la celda de tierra más cercana. Con `cell_selection=sea` se usa la de mar, y en la costa la diferencia es grande. En Cabo de Palos, a la misma hora: 5,1 km/h y 19 °C en tierra, frente a 12,2 km/h y 22 °C en el mar.
  - **Decisión (fase 4), medida contra las estaciones de AEMET:** el viento se pide a la celda de mar y la temperatura y las nubes a la de tierra. Comparando lo previsto para las últimas 24 h con lo medido en 4 estaciones costeras (Salinas de Cabo de Palos, San Javier, Águilas y Cartagena), la temperatura acierta más con la celda de tierra en las 4 (error de 0,5-1,2 °C frente a 1,1-1,9 °C) y el viento con la de mar en 3 de 4 (1,8-3,8 km/h frente a 2,3-4,3 km/h; en Cartagena, empate). Es una muestra de un solo día, unas 12 horas por estación; la fase 12 medirá la fiabilidad en serio. El cliente (`jobs/src/open-meteo/forecast.ts`) hace dos peticiones por grupo de puntos y las combina hora a hora.
  - **Aviso: La Manga no tiene celdas de tierra.** Es tan estrecha que la celda de tierra más cercana cae en tierra firme, a unos 9 km.

## Open-Meteo históricos

| Datos                          | Endpoint y modelo                                     | Desde           | Resolución | Retraso     |
| ------------------------------ | ----------------------------------------------------- | --------------- | ---------- | ----------- |
| Viento, aire y nubes           | `archive-api.open-meteo.com/v1/archive` (por defecto) | 1940            | ~9 km      | Unos 3 días |
| Lo mismo                       | `archive`, `models=era5`                              | 1940            | ~25 km     | Unos 5 días |
| Oleaje                         | `marine` (por defecto)                                | octubre de 2021 | ~9 km      | Al día      |
| Temperatura del agua           | `marine` (por defecto)                                | enero de 2023   | ~9 km      | Al día      |
| Oleaje                         | `marine`, `models=era5_ocean`                         | ~1950           | ~50 km     | Unos 5 días |
| Previsiones archivadas         | `historical-forecast-api.open-meteo.com`              | 2017-2018       | ~2 km      | -           |
| **Previsiones por antelación** | `previous-runs-api.open-meteo.com`                    | 2024            | ~2 km      | -           |

- Un rango de fechas largo (`start_date`/`end_date`) cabe en una sola petición, así que rellenar el histórico cuesta pocas llamadas.
- El reanálisis meteorológico no da temperatura del agua, y `era5_ocean` tampoco.
- `previous-runs` devuelve variables `_previous_day1` … `_previous_day7`: lo que se predijo para esa hora con 1 a 7 días de antelación. La API marina también las admite (`wave_height_previous_day1`).

**Consecuencias**

- Estadísticas de viento: más de 80 años de datos.
- Días buenos por playa y mes: necesitan el oleaje a ~9 km, que empieza en octubre de 2021. Son 5 veranos, suficiente para porcentajes por mes, avisando de que la muestra es corta. `era5_ocean` no distingue playas.
- Tendencia de la temperatura del agua: solo 4 años, no basta. Ver [decisiones pendientes](#decisiones-pendientes).
- Fiabilidad de la previsión: `previous-runs` permite medir el error desde 2024 sin esperar a acumular previsiones propias.

### Condiciones de uso de Open-Meteo

- API gratuita solo para **uso no comercial**: webs personales o sin ánimo de lucro, sin suscripciones ni publicidad. Un portfolio sin anuncios encaja.
- Límites: menos de 10.000 llamadas al día, 5.000 por hora, 600 por minuto y 300.000 al mes.
- Datos con licencia **CC BY 4.0**: hay que citar a Open-Meteo como fuente.

## AEMET predicción de playas

- **Endpoint:** `GET https://opendata.aemet.es/opendata/api/prediccion/especifica/playa/{id}`, con la clave en la cabecera `api_key`.
- **Dos pasos:** la respuesta trae una URL temporal (`datos`) que hay que descargar con una segunda petición. Son 2 llamadas por playa.
- **Codificación:** ISO-8859-15.
- **Listado de playas:** CSV público en `https://www.aemet.es/documentos/es/eltiempo/prediccion/playas/Playas_codigos.csv`, con código, nombre, municipio y coordenadas en grados, minutos y segundos.
- **Cobertura en Murcia: 30 playas** (Águilas 6, Cartagena 7, Lorca 1, Mazarrón 5, San Javier 4, San Pedro del Pinatar 3, Los Alcázares 3 y La Unión 1).
- **Contenido:** 3 días, con un valor de mañana (`f1`) y otro de tarde (`f2`). Estado del cielo, viento y oleaje **solo como categoría** (flojo, moderado, débil…) y **sin dirección**. Además: temperatura máxima, sensación térmica, índice UV máximo y temperatura del agua (en grados enteros). Algunas claves vienen duplicadas con distinta capitalización (`tAgua`/`tagua`).
- **Límite de peticiones:** a partir de unas 40 llamadas por minuto responde `429`. Hay que espaciar las peticiones y reintentar.
- **Licencia:** uso y reproducción autorizados citando a AEMET como autora.
- **Clave:** gratuita, se pide en opendata.aemet.es. Variable `AEMET_API_KEY`.

**Uso en playa·hoy:** no sirve para calcular la nota, porque no da dirección ni cifras. Sí sirve para la **temperatura del agua del Mar Menor**, que distingue de la del Mediterráneo (20 °C frente a 23-25 °C el 22 de octubre de 2026). El valor fue idéntico en todas las playas de la laguna y en los 3 días, así que hay que vigilar si es un dato real o climatológico.

## AEMET observación

- **Endpoint:** `GET /observacion/convencional/todas`, con la misma clave y el mismo sistema de dos pasos.
- Devuelve los datos horarios de las **últimas 24 horas** de todas las estaciones de España en una sola llamada.
- **Variables:** `vv` (viento medio, m/s), `dv` (dirección, grados), `vmax` (racha), `ta` (temperatura), `hr` (humedad), `prec` (lluvia) y, en algunas estaciones, `inso` (horas de sol).

| Estación                        | Código | Altitud | Zona                     |
| ------------------------------- | ------ | ------- | ------------------------ |
| Águilas                         | 7002Y  | 32 m    | Calas de Águilas         |
| Mazarrón/Las Torres             | 7007Y  | 66 m    | Bahía de Mazarrón        |
| Cartagena (puerto)              | 7012X  | 2 m     | Costa de Cartagena       |
| Cartagena/Salinas Cabo de Palos | 7019X  | 2,5 m   | La Manga y Cabo de Palos |
| Murcia/San Javier               | 7031X  | 4 m     | Mar Menor                |

- **Solo guarda 24 horas.** Para tener histórico hay que descargarlas al menos una vez al día. Los valores climatológicos de años anteriores son diarios, no horarios.
- No miden oleaje ni temperatura del agua.

## Censo de zonas de aguas de baño

- **Origen:** Ministerio de Sanidad (sistema Náyade), publicado por MITECO. Edición 2025, actualizada el 30/11/2025.
- **Descarga:** página de descargas de MITECO (`miteco.gob.es/es/cartografia-y-sig/ide/descargas/agua/censo-aguas-bano.html`). El enlace de datos.gob.es está roto.
- **La descarga tiene un captcha (ALTCHA):** no se puede automatizar. Se publica una vez al año, así que el fichero se descarga a mano y el import trabaja con la copia local.
- **Formato:** shapefile de puntos, WGS84 y UTF-8. También hay GML y KMZ.
- **Licencia:** uso libre citando al Ministerio como autor.

**Campos útiles**

- `localId`: código europeo de la zona, estable entre años. Formato `ES620M` + código INE del municipio (3 dígitos) + número. `ES620` es Murcia.
- `nameText` (nombre, en mayúsculas) y `nameTxtInt` (el mismo nombre sin tildes, porque alguna tilde llega rota en `nameText`).
- Coordenadas, `spZoneType` (costera, de transición, de río…), `wEvolution` y `predecesId` (cambios de código respecto al año anterior) y `link` (ficha en Náyade).

**Murcia: 85 zonas**, todas costeras: Cartagena 32, San Javier 15, Águilas 13, Mazarrón 10, Los Alcázares 6, San Pedro del Pinatar 6, Lorca 2 y La Unión 1. (En la fase 0 se contaron 83 porque se filtró primero por un recuadro de coordenadas y dos zonas tienen la longitud mal; ver abajo).

**Limitaciones**

- Cada zona es un **punto de muestreo**, no exactamente una playa. Los Nietos y Los Urrutias tienen dos (separados 1,4 km y 800 m). **Decisión (fase 3):** cada una es una sola playa con el punto y el código del PM1; los PM2 se descartan. Resultado: 83 playas.
- **Aviso: dos coordenadas erróneas en el censo 2025.** El Tabal (`ES620M0351644`) y El Pedruchillo (`ES620M0351651`), en San Javier, tienen la longitud en -4,6, en la provincia de Córdoba; la latitud es correcta. Se corrigen con las coordenadas de AEMET y de OpenStreetMap en `jobs/datos/correcciones-censo.json`, que guarda también las tildes que el censo no trae y los nombres corregidos, cada uno con su motivo. El import rechaza cualquier zona fuera de la costa de Murcia, así que un error parecido en otro censo se detecta.
- **No incluye la calidad del agua.** Solo enlaza a la ficha de Náyade. La calidad sale de la [EEA](#calidad-del-agua-eea).
- **Solo recoge zonas vigiladas oficialmente.** Faltan calas y playas conocidas, como Calblanque.
- Cruzarlo con AEMET por la zona más cercana da errores (en Águilas salen cruzadas La Colonia y Poniente). Hace falta emparejar por nombre y distancia, con una tabla revisada a mano.
- **Discrepancia sin resolver: La Colonia y Poniente (Águilas).** AEMET e ITREM ponen La Colonia al oeste y Poniente al este; el censo y OpenStreetMap, al revés. Se mantiene el censo (fuente oficial, y OSM se revisa sobre ortofoto). Las correspondencias con ITREM se hacen por nombre, así que no les afecta.

## Calidad del agua (EEA)

Añadida al diseñar la tabla `calidad_agua` (fase 2), el 23 de octubre de 2026.

- **Origen:** Agencia Europea de Medio Ambiente. España le comunica cada año la calificación de cada zona de baño por la Directiva 2006/7/CE.
- **Acceso:** API SQL pública y sin clave, `https://discodata.eea.europa.eu/sql?query=…`. Tabla `[WISE_BWD].[latest].[assessment_BathingWaterStatus]`.
- **Cruce:** `bathingWaterIdentifier` es el mismo código que el `localId` del censo (`ES620M0031597`), que se guarda en `playas.codigo_censo`.
- **Campos útiles:** `season` (temporada) y `quality`, con los valores `1 - Excellent`, `2 - Good`, `3 - Sufficient`, `4 - Poor`, `0 - Not classified` (pocas muestras) y `0 - Missing data`.
- **Cobertura en Murcia:** 84 zonas en 2024 (82 excelentes y 2 buenas). Datos desde 1990.
- **Escalas:** en España, la clasificación actual se aplica desde la temporada 2011. Entre 1990 y 2010 se usaba otra escala, con un valor `3 - Good or Sufficient` que junta dos clases y no encaja en la actual. La tabla solo admite temporadas desde 2011.
- **Retraso:** la última temporada publicada en octubre de 2026 es la de 2024.

## ITREM (Turismo de la Región de Murcia)

Añadida en la fase 3 al buscar los servicios de cada playa, el 23 de octubre de 2026.

- **Origen:** Instituto de Turismo de la Región de Murcia, conjunto "Playas" del portal de datos abiertos de la CARM (el de murciaturistica.es).
- **Acceso:** fichero JSON sin clave, `https://nexo.carm.es/nexo/archivos/recursos/opendata/json/Playas.json` (empieza con una marca BOM). `pnpm --filter @playa-hoy/jobs extraer:itrem` lo descarga y guarda los campos útiles en `jobs/datos/itrem-playas.json`.
- **Licencia:** el catálogo no la declara. Se aplican las condiciones generales de reutilización de la Ley 37/2007: citar la fuente y la fecha, y no desnaturalizar los datos. **No se usan las fotos**, que pueden tener derechos propios.
- **Actualización:** la ficha del catálogo es de abril de 2018. Lo que cambia poco (accesibilidad, suelo, ocupación) es útil; la **bandera azul no se usa**, porque se renueva cada año.
- **Contenido:** 194 playas, incluidas muchas calas que no están en el censo. Campos usados: `Accesible` y `Nudista` (Sí/No, en todas), `Tipo Suelo` (25 descripciones libres que `clasificarSuelo()` reduce a 6 categorías) y `Ocupación` (baja, media o alta). Trae también Mar Menor o Mediterráneo, paseo marítimo, zona de fondeo y descripción del acceso.
- **No trae** socorrista, perros, aseos ni duchas.
- **Aviso: coordenadas en dos sistemas dentro del mismo fichero.** La mayoría están en UTM huso 30 con el datum antiguo **ED50** (EPSG:23030), no en ETRS89: interpretarlas como ETRS89 las desplaza unos 237 m. Las de Mazarrón y Lorca están en grados y con los campos cruzados (la latitud en "Longitud").
- **"La Manga" figura como municipio**, aunque se reparte entre Cartagena y San Javier.
- **Cruce con el censo:** tabla revisada a mano, `jobs/datos/correspondencias-itrem.json`. Se propuso automáticamente cuando el nombre coincidía y la distancia era menor de 1 km, y se revisaron uno a uno los casos dudosos. **75 de las 83 playas** tienen correspondencia; las 8 restantes están en la tabla con el motivo (por ejemplo, Percheles: mismo nombre pero 2,6 km de diferencia).

## Boya de Cabo de Palos

- Boya de aguas profundas de Puertos del Estado (red REDEXT, código WMO 6100417), en 37,65 N 0,31 O, **unos 33 km mar adentro**. Mide oleaje, viento y temperatura del agua desde 2018.
- Es la única plataforma de medida fija en la zona. No hay boyas costeras ni mareógrafos de Puertos del Estado en Murcia.
- **Acceso:** el servidor THREDDS de Puertos del Estado no publica boyas, y EMODnet Physics la lista sin dar acceso a los datos por su API. La vía oficial es **Copernicus Marine In Situ**, que requiere una cuenta gratuita. **No probado.**
- Sirve para contrastar el oleaje mar adentro, no el que llega a cada playa.

## OpenStreetMap

- Uso previsto: línea de costa para calcular la orientación (fase 3) y socorrista, perros, aseos y duchas, que ITREM no trae.
- **Pocos servicios mapeados** (octubre de 2026): de 249 playas (`natural=beach`) en Murcia, 20 tienen `supervised`, 2 `dog`, 1 `wheelchair` y ninguna `toilets` ni `shower`. A menos de 150 m de alguna playa hay 22 aseos, 8 duchas y 8 puestos de socorrista.
- **Resultado del import** (`pnpm --filter @playa-hoy/jobs importar:osm`, 23 de octubre de 2026): 36 de las 83 playas reciben algún dato. Socorrista en 17 (15 sí, 2 no), aseos en 22, duchas en 12 y perros en ninguna. Se cruza en PostGIS: un polígono de OSM corresponde a una playa si está a menos de 100 m de su punto, y un servicio cuenta si está a menos de 150 m del polígono. La etiqueta de la playa manda; si no hay, basta un servicio cercano para el sí. La ausencia nunca se interpreta como un no.
- **Línea de costa** (`pnpm --filter @playa-hoy/jobs importar:costa`): `natural=coastline` en el recuadro 37,30-37,95 N, 1,85-0,60 O (incluye un poco de Almería y de Alicante). 263 tramos y 15.550 puntos en octubre de 2026, que se guardan en la tabla `costa`. **Incluye la orilla del Mar Menor.** En OSM la costa se dibuja con la tierra a la izquierda y el mar a la derecha, y eso dice hacia dónde mira cada playa. Las 83 playas tienen la costa a menos de 50 m.
- **Polígono del Mar Menor:** relación `2902374` (`natural=bay`), 135,6 km². Se usa para marcar las playas de laguna: las de la orilla están a 15 m o menos del polígono y las demás a 155 m o más, así que el umbral es 50 m. Cruzado con el campo "Mar" de ITREM, coincide en 74 de 75 playas; la excepción (Puerto Bello) está en `jobs/datos/excepciones-costa.json`.
- **Orientación, abrigo y laguna** (`pnpm --filter @playa-hoy/jobs calcular:geografia`): la orientación sale de la costa (`calcularOrientacion` en `packages/core`). El abrigo mide el alcance hacia el mar: 37 rayos de 50 km en el abanico `mira` ± 90°, cada uno cuenta como abierto en proporción a lo que recorre hasta 30 km, y los frontales pesan más (`calcularAbrigo`). Resultado en octubre de 2026: 33 playas de laguna; abrigo medio de 0,12 en la Costa de Lorca a 0,77 en el Mar Menor.
- **Aviso: los rayos solo chocan con la costa descargada.** Pasado el recuadro (por ejemplo, hacia el oeste de Águilas) se considera mar abierto, lo que puede exagerar un poco la exposición en los extremos. Por los huecos de las golas de La Manga también pasan algunos rayos desde el Mar Menor: por eso la laguna no se decide con el alcance, sino con el polígono.
- **Revisión de las orientaciones dudosas** (fase 3): 13 playas con confianza menor de 0,7 o con una orientación sospechosa. Cada una se contrastó con una segunda medida tomada desde el polígono de la playa en OSM y con la forma de la costa. **Ninguna resultó errónea**: las de confianza baja son calas o puntas donde la orilla gira, y Los Narejos, que parecía mal (200° entre vecinas que miran al este), está junto a Punta Calera, donde la costa gira de verdad. La revisión queda en `revisadas` de `jobs/datos/excepciones-costa.json`; las correcciones futuras irán en `orientaciones`, con su motivo y su fuente, y el abrigo se calcula con la orientación corregida.
- Acceso por Overpass API. Exige un `User-Agent` identificado (sin él responde `406`). El servidor principal da `502` a menudo: hace falta reintentar y usar servidores espejo (`overpass.private.coffee` respondió cuando el principal fallaba). Nominatim sirve para buscar una playa concreta.
- **Licencia:** ODbL. Hay que atribuirla ("© colaboradores de OpenStreetMap").

## Guía de playas

**No está disponible como dato abierto.** La app de playas del Ministerio está retirada y su página no ofrece ficheros. Los servicios salen de [ITREM](#itrem-turismo-de-la-región-de-murcia) y OpenStreetMap.

## Certificados de las webs del Gobierno

Las webs de MITECO y del Ministerio de Agricultura usan certificados de la FNMT, cuyas raíces no vienen en el almacén de Ubuntu ni en el de Node. Además, alguna no envía el certificado intermedio. Sin solución, `curl` y `fetch` fallan con un error de certificado.

Hacen falta estos tres certificados, que se descargan de la [sede de la FNMT](https://www.sede.fnmt.gob.es/descargas/certificados-raiz-de-la-fnmt). Antes de usarlos hay que comprobar su huella SHA-1 (`openssl x509 -in fichero -noout -fingerprint -sha1`) contra esta tabla, que coincide con la publicada:

| Certificado                              | SHA-1                                                         | Caduca |
| ---------------------------------------- | ------------------------------------------------------------- | ------ |
| AC RAIZ FNMT-RCM SERVIDORES SEGUROS G2R  | `19:87:94:8D:AB:7D:62:00:9E:2D:6B:BE:D8:83:DC:3A:F5:67:99:E8` | 2040   |
| AC RAIZ FNMT-RCM                         | `EC:50:35:07:B2:15:C4:95:62:19:E2:A8:9A:5B:42:99:2C:4C:2C:20` | 2030   |
| AC Componentes Informáticos (intermedio) | `C7:72:B4:8D:23:85:E5:02:E8:47:37:DB:E7:87:B6:43:11:91:12:47` | 2028   |

Uso, con los tres en un solo fichero PEM: `curl --cacert fnmt-ca.pem` o, en Node, `NODE_EXTRA_CA_CERTS=fnmt-ca.pem`. Nunca se desactiva la verificación. Ahora mismo ninguna ingesta automática los necesita, porque el censo se descarga a mano; si alguna llega a necesitarlos, el fichero irá en `jobs/`.

## Cambios respecto al RoadMap

1. **Falta un municipio: La Unión** (Portmán). Tiene una zona de baño en el censo y una playa en AEMET.
2. **El Mar Menor no siempre está "más templado".** Al ser poco profundo, en verano está más caliente que el Mediterráneo y en otoño o invierno más frío (20 °C frente a 23-25 °C a finales de octubre). La lógica del perfil familiar no debe premiar la laguna por el agua en todas las épocas.
3. **La guía de playas no existe como fuente.** Los servicios salen de ITREM (accesible, suelo, ocupación, nudista) y OpenStreetMap (socorrista, perros, aseos, duchas).
4. **La calidad del agua sale de la EEA**, porque el censo no la trae. Se cruza por el código del censo.
5. **El catálogo de playas necesita dos fuentes:** el censo para las zonas oficiales y OpenStreetMap para calas y playas no vigiladas.
6. **Las observaciones de AEMET deben descargarse desde la fase 4**, no en la 12, porque solo se guardan 24 horas.
7. **La fiabilidad de la previsión no requiere esperar meses**, porque Open-Meteo guarda las previsiones por antelación desde 2024.

## Decisiones pendientes

| Decisión                             | Opciones                                                                                                                                                                                                                          | Cuándo  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Tendencia de la temperatura del agua | (a) Solo media por mes, sin tendencia. (b) Añadir Copernicus Marine (desde 1982, con cuenta gratuita).                                                                                                                            | Fase 11 |
| Fiabilidad del oleaje y del agua     | Usar la boya de Cabo de Palos a través de Copernicus Marine, o limitar la fase 12 al viento.                                                                                                                                      | Fase 12 |
| Retención de la tabla `previsiones`  | Guardar todas las emisiones ocupa unos 1,3 GB al año (Neon gratis: 0,5 GB). Opción propuesta: emisiones completas durante unas semanas y después una al día; para medir el error a más antelación, `previous-runs` de Open-Meteo. | Fase 4  |
