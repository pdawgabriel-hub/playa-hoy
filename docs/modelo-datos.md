# Modelo de datos

Esquema de PostgreSQL con PostGIS. Se define en TypeScript con Drizzle (`packages/db/src/esquema/`) y se aplica con las migraciones de `packages/db/migraciones/` (`pnpm db:migrate`).

## Diagrama entidad-relación

Las tablas forman dos grupos independientes, más la costa, que se usa para calcular la orientación y el abrigo de las playas. En la fase 4 cada playa quedará enlazada con su punto de consulta y los dos diagramas se unirán.

### Catálogo de playas y notas

```mermaid
erDiagram
    municipios ||--o{ playas : "contiene"
    zonas |o--o{ playas : "agrupa"
    playas ||--o| playa_servicios : "tiene"
    playas ||--o{ calidad_agua : "calificada por temporada"
    playas ||--o{ notas : "puntuada"

    municipios {
        text id PK "código INE (30003)"
        text nombre
        text slug UK
    }

    zonas {
        int id PK
        text nombre
        text slug UK
        text descripcion
    }

    playas {
        int id PK
        text nombre
        text slug UK
        text municipio_id FK
        int zona_id FK "nulo hasta definir zonas"
        geometry ubicacion "Point, SRID 4326"
        real mira "grados, 0 = norte"
        real abrigo "0 a 1"
        bool laguna "Mar Menor"
        text codigo_censo UK "ES620M..."
        text codigo_aemet UK
        text osm_id UK
    }

    playa_servicios {
        int playa_id PK, FK
        bool socorrista "nulo = no se sabe"
        bool perros
        bool accesible
        bool aseos
        bool duchas
        bool nudista
        text suelo "arena_fina ... roca"
        text ocupacion "baja | media | alta"
        text_array fuentes "itrem, osm, manual"
        timestamptz actualizado_en
    }

    calidad_agua {
        int playa_id PK, FK
        int temporada PK "desde 2011"
        text calificacion "excelente ... sin_clasificar"
    }

    notas {
        int playa_id PK, FK
        text perfil PK "familia | snorkel | sol | surf"
        timestamptz hora PK
        smallint nota "0 a 100"
        text_array razones
        timestamptz emitida_en
    }
```

### Previsiones, observaciones y costa

```mermaid
erDiagram
    puntos_consulta ||--o{ previsiones : "recibe"
    estaciones ||--o{ observaciones : "mide"

    puntos_consulta {
        int id PK
        geometry ubicacion UK "Point, SRID 4326"
    }

    previsiones {
        int punto_id PK, FK
        timestamptz emitida_en PK
        timestamptz hora PK
        real viento_velocidad "km/h"
        real viento_direccion "grados"
        real viento_racha "km/h"
        real temperatura_aire "°C"
        real nubosidad "%"
        real ola_altura "m"
        real ola_direccion "grados"
        real ola_periodo "s"
        real temperatura_agua "°C"
    }

    estaciones {
        text id PK "código oficial (7019X)"
        text nombre
        geometry ubicacion "Point, SRID 4326"
        real altitud "m"
        text fuente "aemet | puertos_estado"
    }

    observaciones {
        text estacion_id PK, FK
        timestamptz hora PK
        real viento_velocidad "km/h"
        real viento_direccion "grados"
        real viento_racha "km/h"
        real temperatura_aire "°C"
        real ola_altura "m"
        real ola_direccion "grados"
        real ola_periodo "s"
        real temperatura_agua "°C"
    }

    costa {
        text id PK "tramo de OSM (way/123)"
        geometry linea "LineString, SRID 4326; mar a la derecha"
        timestamptz descargada_en
    }
```

## Tablas

| Tabla             | Qué guarda                                                                                | Origen de los datos                                                                 | Fase |
| ----------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- |
| `municipios`      | División administrativa                                                                   | INE                                                                                 | 3    |
| `zonas`           | División que entiende la gente (Mar Menor, La Manga…), con una descripción para su página | `jobs/datos/zonas.json`, definidas a mano                                           | 3    |
| `playas`          | Catálogo: ubicación, orientación, abrigo, laguna                                          | Censo de aguas de baño; orientación, abrigo y laguna calculados con la costa de OSM | 3    |
| `playa_servicios` | Accesible, suelo, ocupación, nudista, socorrista, perros, aseos, duchas                   | ITREM y OpenStreetMap                                                               | 3    |
| `calidad_agua`    | Calificación oficial por temporada                                                        | Agencia Europea de Medio Ambiente                                                   | 3    |
| `puntos_consulta` | Coordenadas que se piden a las APIs de previsión                                          | Agrupando playas cercanas                                                           | 4    |
| `previsiones`     | Previsión por horas de cada punto, con **todas** las emisiones                            | Open-Meteo                                                                          | 4    |
| `notas`           | Nota vigente de cada playa por plan y hora, con sus razones                               | Motor de puntuación (`packages/core`)                                               | 5    |
| `estaciones`      | Estaciones y boyas que miden                                                              | AEMET y Puertos del Estado                                                          | 4    |
| `observaciones`   | Datos medidos por hora, comparables columna a columna con la previsión                    | AEMET y Puertos del Estado                                                          | 4    |
| `costa`           | Línea de costa por tramos, con el mar a la derecha del sentido de la línea                | OpenStreetMap                                                                       | 3    |

El detalle de cada fuente está en [fuentes.md](fuentes.md).

## Decisiones de diseño

- **Previsiones por punto de consulta, no por playa.** Varias playas comparten la misma celda del modelo de Open-Meteo, así que guardar la previsión por playa la repetiría. En la fase 4 cada playa quedará enlazada con su punto de consulta (columna nueva en `playas`), y entonces se añadirá esa relación al diagrama.
- **Todas las emisiones.** La clave de `previsiones` incluye `emitida_en`, así que la misma hora aparece una vez por cada emisión que la predijo. Así se mide cómo cambia la previsión con la antelación. La política de retención está pendiente (ver [fuentes.md](fuentes.md#decisiones-pendientes)).
- **Solo la nota vigente.** `notas` no guarda una nota por emisión: cada ingesta sustituye las anteriores.
- **Nulo significa desconocido.** `mira`, `abrigo` y los servicios son nulos mientras no se conocen, nunca 0 ni `false` por defecto. Así los filtros no presentan como dato lo que no lo es.
- **No se inventan playas.** Toda playa necesita un código del censo o de OpenStreetMap (restricción `playas_origen`).
- **Mismas unidades en previsión y observación.** Viento en km/h, direcciones en grados de los que viene, alturas en metros, temperaturas en °C.
- **Todo en UTC.** Las fechas son `timestamptz`; se convierten a `Europe/Madrid` solo al mostrarlas.
- **Puntos con SRID 4326.** `packages/db/src/geo.ts` define un tipo propio porque la columna `geometry` de Drizzle 0.45 ignora el SRID.

## Restricciones

Las reglas importantes están en la propia base de datos, no solo en el código:

| Tabla                          | Regla                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `municipios`                   | El id es un código INE de 5 dígitos; slug en formato URL                                         |
| `zonas`, `playas`              | Slug único en formato URL                                                                        |
| `playas`                       | `mira` entre 0 y menos de 360; `abrigo` entre 0 y 1; código del censo u OSM obligatorio          |
| `playa_servicios`              | Fuentes entre `itrem`, `osm` y `manual`; suelo y ocupación de su lista de valores                |
| `calidad_agua`                 | Calificación de la escala actual; temporada desde 2011                                           |
| `notas`                        | Perfil conocido; nota entre 0 y 100                                                              |
| `previsiones`, `observaciones` | Direcciones entre 0 y 360; velocidades, alturas y periodos no negativos; nubosidad entre 0 y 100 |
| `estaciones`                   | Fuente `aemet` o `puertos_estado`                                                                |

Borrar una playa, un punto de consulta o una estación borra en cascada sus datos dependientes. Borrar un municipio o una zona con playas no está permitido.

## Índices

Además de los de las claves primarias y únicas:

| Índice                                    | Tipo   | Consulta que lo usa                        |
| ----------------------------------------- | ------ | ------------------------------------------ |
| `playas_ubicacion_idx`                    | GiST   | Playas dentro de un recuadro (mapa)        |
| `playas_ubicacion_geography_idx`          | GiST   | Playas más cercanas, en metros             |
| `playas_municipio_idx`, `playas_zona_idx` | B-tree | Páginas de municipio y de zona             |
| `puntos_consulta_ubicacion_idx`           | GiST   | Punto más cercano a cada playa             |
| `estaciones_ubicacion_idx`                | GiST   | Estación más cercana a cada zona           |
| `costa_linea_idx`                         | GiST   | Tramos de costa cercanos a cada playa      |
| `notas_ranking_idx`                       | B-tree | Ranking por plan y hora, ordenado por nota |
| `previsiones_hora_idx`                    | B-tree | Previsto frente a medido a una hora        |
| `previsiones_emitida_en_idx`              | B-tree | Última emisión y retención                 |

Para ordenar por cercanía y que se use el índice, la consulta tiene que ordenar con el operador `<->` (`ORDER BY ubicacion::geography <-> punto`), no con `ST_Distance`.
