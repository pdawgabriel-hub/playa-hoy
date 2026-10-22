# Fuentes de datos

Resultado de la fase 0: qué da cada fuente, cómo se accede, en qué condiciones se puede usar y qué riesgos o huecos tiene. Todo se comprobó con peticiones reales el 22 de octubre de 2026. Los scripts de prueba y las notas de trabajo están en `spike/`.

## Resumen

| Fuente                                                     | Uso en playa·hoy                                      | Acceso                         | Licencia                    | Riesgo principal                                 |
| ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------ | --------------------------- | ------------------------------------------------ |
| [Open-Meteo Marine](#open-meteo-marine)                    | Oleaje y temperatura del agua (previsión e histórico) | API sin clave                  | CC BY 4.0, uso no comercial | Malla de ~9 km; no ve el Mar Menor               |
| [Open-Meteo Forecast](#open-meteo-forecast)                | Viento, aire y nubes (previsión)                      | API sin clave                  | CC BY 4.0, uso no comercial | El resultado cambia mucho según la celda elegida |
| [Open-Meteo históricos](#open-meteo-históricos)            | Estadísticas y fiabilidad                             | API sin clave                  | CC BY 4.0, uso no comercial | Oleaje solo desde 2021 y agua desde 2023         |
| [AEMET predicción de playas](#aemet-predicción-de-playas)  | Temperatura del agua del Mar Menor                    | API con clave                  | Citar a AEMET               | Solo 30 playas, datos por categorías             |
| [AEMET observación](#aemet-observación)                    | Viento medido en la costa                             | API con clave                  | Citar a AEMET               | Solo guarda 24 horas                             |
| [Censo de aguas de baño](#censo-de-zonas-de-aguas-de-baño) | Catálogo base de playas                               | Descarga manual anual          | Citar al Ministerio         | Captcha; faltan playas no vigiladas              |
| [Boya de Cabo de Palos](#boya-de-cabo-de-palos)            | Oleaje y agua medidos                                 | Copernicus Marine (con cuenta) | Por confirmar               | Sin probar; a 33 km de la costa                  |
| [OpenStreetMap](#openstreetmap)                            | Línea de costa y servicios                            | Overpass API                   | ODbL                        | Sin probar en esta fase                          |
| [Guía de playas](#guía-de-playas)                          | (Servicios)                                           | **No disponible**              | -                           | Descartada                                       |

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
  - **Propuesta:** viento con `cell_selection=sea`, que es el que llega a la playa. Qué celda usar para la temperatura del aire se decide en la fase 4.

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

**Murcia: 83 zonas**, todas costeras: Cartagena 32, Águilas 13, San Javier 13, Mazarrón 10, Los Alcázares 6, San Pedro del Pinatar 6, Lorca 2 y La Unión 1.

**Limitaciones**

- Cada zona es un **punto de muestreo**, no exactamente una playa. Los Nietos y Los Urrutias tienen dos.
- **No incluye la calidad del agua.** Solo enlaza a la ficha de Náyade.
- **Solo recoge zonas vigiladas oficialmente.** Faltan calas y playas conocidas, como Calblanque.
- Cruzarlo con AEMET por la zona más cercana da errores (en Águilas salen cruzadas La Colonia y Poniente). Hace falta emparejar por nombre y distancia, con una tabla revisada a mano.

## Boya de Cabo de Palos

- Boya de aguas profundas de Puertos del Estado (red REDEXT, código WMO 6100417), en 37,65 N 0,31 O, **unos 33 km mar adentro**. Mide oleaje, viento y temperatura del agua desde 2018.
- Es la única plataforma de medida fija en la zona. No hay boyas costeras ni mareógrafos de Puertos del Estado en Murcia.
- **Acceso:** el servidor THREDDS de Puertos del Estado no publica boyas, y EMODnet Physics la lista sin dar acceso a los datos por su API. La vía oficial es **Copernicus Marine In Situ**, que requiere una cuenta gratuita. **No probado.**
- Sirve para contrastar el oleaje mar adentro, no el que llega a cada playa.

## OpenStreetMap

- Uso previsto: línea de costa para calcular la orientación (fase 3) y, como sustituto de la guía de playas, servicios etiquetados en `natural=beach` (`supervised`, `dog`, `wheelchair`, `nudism`…).
- Acceso por Overpass API. Exige un `User-Agent` identificado (sin él responde `406`). Durante la prueba estaba saturado (`502`), así que el contenido queda por revisar en la fase 3.
- **Licencia:** ODbL. Hay que atribuirla ("© colaboradores de OpenStreetMap").

## Guía de playas

**No está disponible como dato abierto.** La app de playas del Ministerio está retirada y su página no ofrece ficheros. Los servicios de cada playa saldrán de OpenStreetMap.

## Certificados de las webs del Gobierno

Las webs de MITECO y del Ministerio de Agricultura usan certificados de la FNMT, cuyas raíces no vienen en el almacén de Ubuntu ni en el de Node. Además, alguna no envía el certificado intermedio. Sin solución, `curl` y `fetch` fallan con un error de certificado.

`spike/fnmt-ca.pem` reúne tres certificados descargados de la sede de la FNMT, con la huella SHA-1 comprobada contra la que publica:

| Certificado                              | SHA-1                                                         | Caduca |
| ---------------------------------------- | ------------------------------------------------------------- | ------ |
| AC RAIZ FNMT-RCM SERVIDORES SEGUROS G2R  | `19:87:94:8D:AB:7D:62:00:9E:2D:6B:BE:D8:83:DC:3A:F5:67:99:E8` | 2040   |
| AC RAIZ FNMT-RCM                         | `EC:50:35:07:B2:15:C4:95:62:19:E2:A8:9A:5B:42:99:2C:4C:2C:20` | 2030   |
| AC Componentes Informáticos (intermedio) | `C7:72:B4:8D:23:85:E5:02:E8:47:37:DB:E7:87:B6:43:11:91:12:47` | 2028   |

Uso: `curl --cacert fnmt-ca.pem` o, en Node, `NODE_EXTRA_CA_CERTS=fnmt-ca.pem`. Nunca se desactiva la verificación. Cuando exista el monorepo, el fichero se moverá a una ubicación definitiva.

## Cambios respecto al RoadMap

1. **Falta un municipio: La Unión** (Portmán). Tiene una zona de baño en el censo y una playa en AEMET.
2. **El Mar Menor no siempre está "más templado".** Al ser poco profundo, en verano está más caliente que el Mediterráneo y en otoño o invierno más frío (20 °C frente a 23-25 °C a finales de octubre). La lógica del perfil familiar no debe premiar la laguna por el agua en todas las épocas.
3. **La guía de playas no existe como fuente.** Los servicios salen de OpenStreetMap.
4. **La calidad del agua necesita otra fuente**, porque el censo no la trae: Náyade o los informes de la EEA.
5. **El catálogo de playas necesita dos fuentes:** el censo para las zonas oficiales y OpenStreetMap para calas y playas no vigiladas.
6. **Las observaciones de AEMET deben descargarse desde la fase 4**, no en la 12, porque solo se guardan 24 horas.
7. **La fiabilidad de la previsión no requiere esperar meses**, porque Open-Meteo guarda las previsiones por antelación desde 2024.

## Decisiones pendientes

| Decisión                                         | Opciones                                                                                               | Cuándo  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------- |
| Tendencia de la temperatura del agua             | (a) Solo media por mes, sin tendencia. (b) Añadir Copernicus Marine (desde 1982, con cuenta gratuita). | Fase 11 |
| Fiabilidad del oleaje y del agua                 | Usar la boya de Cabo de Palos a través de Copernicus Marine, o limitar la fase 12 al viento.           | Fase 12 |
| Celda de Open-Meteo para la temperatura del aire | Tierra o mar                                                                                           | Fase 4  |
| Playas con varios puntos de muestreo             | Una playa o varias                                                                                     | Fase 3  |
