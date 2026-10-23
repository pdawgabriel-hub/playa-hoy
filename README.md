# playa·hoy

> **¿A qué playa voy hoy, y a qué hora?** Recomendador de playas de la Región de Murcia según el viento, el oleaje, la orientación de cada playa y el plan que tengas.

**Proyecto en desarrollo.**

---

## En qué consiste

La previsión del tiempo te dice qué viento y qué oleaje habrá, pero no **cómo se va a notar en cada playa**. La misma previsión afecta de forma muy distinta a una playa según hacia dónde mira y qué la protege:

- Con **levante** fuerte, La Manga y Cabo de Palos se llenan de ola y viento, mientras que el Mar Menor y las calas que miran al suroeste se quedan tranquilas.
- Con **poniente**, ocurre más o menos lo contrario.

playa·hoy combina la previsión mar adentro con datos propios de cada playa (su orientación, si está abrigada por cabos o bahías y si está en la laguna del Mar Menor) para estimar **lo que de verdad llega a la orilla**. Con eso le pone a cada playa una **nota de 0 a 100** según tu plan y te explica **por qué** en lenguaje claro.

Cubre **todas las playas de la Región de Murcia**: Águilas, Lorca, Mazarrón, Cartagena, Los Alcázares, San Javier y San Pedro del Pinatar. Se pueden consultar por municipio o por zona (Mar Menor, La Manga, Calblanque y Cabo de Palos, Bahía de Mazarrón, Calas de Águilas…).

## Qué problemas cotidianos resuelve

| Situación                                                       | Cómo ayuda playa·hoy                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| "Hace viento, ¿merece la pena ir a la playa?"                   | Te dice qué playas quedan resguardadas de ese viento en concreto.                                         |
| "Voy con niños pequeños y no quiero olas"                       | El plan familiar prioriza el agua tranquila, el poco viento y el agua templada.                           |
| "Quiero hacer snorkel, ¿estará el agua clara?"                  | Estima la turbidez a partir del oleaje de las horas anteriores, porque el agua tarda en aclararse.        |
| "¿A qué hora voy para que no me pille la brisa?"                | Calcula la mejor franja de tres horas seguidas de cada playa.                                             |
| "¿Habrá olas para surfear y dónde?"                             | El perfil de surf funciona al revés: busca ola útil y premia el viento de tierra, que la deja más limpia. |
| "No sé si ondeará bandera roja"                                 | Muestra una bandera probable según la ola en la orilla (orientativa, no oficial).                         |
| "Me sirve una playa por la mañana y otra por la tarde"          | Propone un plan de mañana y tarde cuando cambia la mejor opción.                                          |
| "Busco una playa con socorrista, accesible o que admita perros" | Filtros por servicios y búsqueda por cercanía.                                                            |
| "¿En qué mes suele estar mejor esta playa?"                     | Estadísticas históricas de días buenos por playa, mes y plan.                                             |

## Funcionalidades

### Recomendación diaria

- **Hoy:** la mejor opción y el ranking de playas para el plan, el día y la hora elegidos.
- **Cuatro planes:** familia con niños, snorkel, tomar el sol y surf.
- **Nota de 0 a 100 con sus razones** ("viento de tierra flojo", "ola de 0,3 m en la orilla"…).
- **Mejor franja de tres horas**, **bandera probable** y **plan de mañana y tarde**.
- **Puesta de sol sobre el mar:** qué playas la ven.
- **Parte diario por zona**, generado automáticamente.
- Nombres locales de los vientos: tramontana, gregal, levante, jaloque, mediodía, lebeche, poniente y mistral.

### Exploración

- **Ficha de playa** con la gráfica de la nota y el viento por horas, y una rosa con la orientación, el viento y el oleaje.
- **Páginas por municipio y por zona.**
- **Mapa** con las playas coloreadas por nota y la dirección del viento sobre el mar.
- **Semana:** la mejor playa de cada día y un mapa de calor de playas por días.
- **Comparador** de hasta tres playas.
- **Filtros** por perros, accesibilidad, socorrista o calas sin servicios, y **búsqueda por cercanía**.
- **Cómo funciona:** explicación del modelo con un simulador interactivo.

### Estadísticas

- Porcentaje de **días buenos** por playa, mes y plan.
- **Frecuencia de vientos** por zona y mes, y **refugios** según el viento dominante.
- Comparativa **Mar Menor frente al Mediterráneo** por época.
- **Temperatura del agua** por mes y su tendencia a lo largo de los años.
- Hora media de **entrada de la brisa**.
- **Fiabilidad de la previsión:** cuánto se equivoca y cómo empeora con los días de antelación.

### Para desarrolladores

- **API pública** con documentación interactiva (OpenAPI).
- **PWA instalable** que muestra la última previsión sin conexión.

Las preferencias (plan y comparador) se guardan en el navegador. No hace falta crear una cuenta.

## Stack tecnológico

Todo el proyecto está escrito en **TypeScript**, organizado como monorepo con **pnpm workspaces**.

| Capa                     | Tecnologías                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web**                  | [Astro](https://astro.build/) con renderizado bajo demanda, islas de [React](https://react.dev/) y [Tailwind CSS](https://tailwindcss.com/)                    |
| **Mapa**                 | [MapLibre GL](https://maplibre.org/) con teselas de [OpenFreeMap](https://openfreemap.org/)                                                                    |
| **Gráficas**             | SVG propio, con su tabla accesible equivalente                                                                                                                 |
| **API**                  | [Hono](https://hono.dev/) + [Zod](https://zod.dev/) + `@hono/zod-openapi`, documentada con [Scalar](https://scalar.com/)                                       |
| **Base de datos**        | PostgreSQL + [PostGIS](https://postgis.net/) en [Neon](https://neon.tech/), con [Drizzle ORM](https://orm.drizzle.team/)                                       |
| **Lógica de dominio**    | Paquete `core` con funciones puras, sin I/O, compartido por la web, la API y los jobs                                                                          |
| **Estadística**          | SQL (vistas materializadas) y [simple-statistics](https://simple-statistics.github.io/)                                                                        |
| **Ingesta de datos**     | Scripts de TypeScript programados con GitHub Actions                                                                                                           |
| **Límite de peticiones** | [Upstash Redis](https://upstash.com/)                                                                                                                          |
| **Tests**                | [Vitest](https://vitest.dev/), [MSW](https://mswjs.io/) para simular APIs externas, PostgreSQL real en Docker y [Playwright](https://playwright.dev/) para E2E |
| **Calidad**              | TypeScript estricto, oxlint y Prettier                                                                                                                         |
| **CI/CD y despliegue**   | GitHub Actions, [Vercel](https://vercel.com/), Lighthouse CI y Dependabot                                                                                      |
| **Desarrollo local**     | Docker Compose con PostgreSQL + PostGIS                                                                                                                        |

### Estructura del monorepo

```
apps/
  web/        Web pública (Astro + islas de React)
  api/        API pública (Hono + OpenAPI)
packages/
  core/       Motor de puntuación y lógica de dominio (funciones puras)
  db/         Esquema, migraciones y consultas (Drizzle + PostGIS)
  shared/     Esquemas Zod y tipos compartidos
jobs/         Ingesta de datos, cálculo de notas y estadísticas
```

## Fuentes de datos

- **[Open-Meteo](https://open-meteo.com/)** (Marine, Forecast e Historical): oleaje, viento, temperatura del agua y del aire, y nubosidad por horas.
- **[AEMET OpenData](https://opendata.aemet.es/)**: predicción específica de playas.
- **Censo de aguas de baño (MITECO)** y **Guía de playas**, vía [datos.gob.es](https://datos.gob.es/): listado de playas, calidad del agua y servicios.
- **[OpenStreetMap](https://www.openstreetmap.org/copyright)**: línea de costa para calcular la orientación de cada playa (© colaboradores de OpenStreetMap, ODbL).
- **Puertos del Estado y AEMET**: boyas y estaciones para medir la fiabilidad de la previsión.

> La nota y la bandera son **estimaciones orientativas**. Consulta siempre la bandera oficial y las indicaciones del socorrista.

## Autor

**Gabriel**: proyecto personal de portfolio, 2º de Desarrollo de Aplicaciones Web (DAW).
