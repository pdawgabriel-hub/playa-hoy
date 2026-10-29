# Motor de puntuación

Cómo convierte `packages/core` la previsión mar adentro en lo que pasa en cada playa. Son funciones puras: reciben los datos de la playa y de la hora, y no consultan nada. Las notas por plan se construyen encima de estas piezas.

Todos los rumbos están en grados: 0 es norte, 90 este, 180 sur y 270 oeste. La orientación de la playa (`mira`) es hacia dónde mira; el viento y el oleaje se nombran por de dónde vienen (`packages/core/src/angulos.ts`).

## Vientos locales

`vientoLocal(dirección)` da el nombre del viento según la rosa mediterránea que se usa en la costa de Murcia, en sectores de 45° centrados en cada rumbo:

| Viento     | Viene del | Rumbo |
| ---------- | --------- | ----- |
| Tramontana | N         | 0     |
| Gregal     | NE        | 45    |
| Levante    | E         | 90    |
| Jaloque    | SE        | 135   |
| Mediodía   | S         | 180   |
| Lebeche    | SO        | 225   |
| Poniente   | O         | 270   |
| Mistral    | NO        | 315   |

Los nombres y sus rumbos siguen las definiciones del Diccionario de la lengua española (RAE).

## Entrada del viento

`entradaViento(mira, dirección, velocidad)` (`viento.ts`) dice cómo le llega el viento a la playa, según la separación entre hacia dónde mira y de dónde viene el viento:

| Entrada  | Separación       | Qué supone                                    |
| -------- | ---------------- | --------------------------------------------- |
| `mar`    | Hasta 60°        | Trae ola y frescor                            |
| `lado`   | Entre 60° y 120° | Intermedio                                    |
| `tierra` | Desde 120°       | Deja el agua plana; en verano puede dar calor |
| `calma`  | Menos de 6 km/h  | La dirección no significa nada                |

Cada categoría ocupa un tercio de la rosa. El corte de calma es la fuerza 0 y 1 de la escala de Beaufort (calma y ventolina). Además de la categoría devuelve `haciaTierra`, el coseno de la separación: 1 con el viento de mar de frente, 0 de lado puro y -1 de tierra de frente, para que los perfiles gradúen dentro de cada categoría.

Ejemplo real (29 de octubre de 2026, gregal de 13 km/h): en La Manga, Galúa (Mediterráneo, mira 71°) lo recibe de mar (0,97) y El Galán, a 500 m en la orilla del Mar Menor (mira 218°), de tierra (-0,94).

## Oleaje en la orilla

`oleajeEnOrilla(playa, hora)` (`oleaje.ts`) estima la altura significativa de la ola en la orilla. Usa los **alcances** de la playa (`playas.alcances`): los metros de mar libre en cada uno de los 37 rayos que calcula `calcular:geografia`, de `mira` - 90° a `mira` + 90° cada 5° (ver [geografia-playas.md](geografia-playas.md)). El alcance en cualquier rumbo se interpola entre los dos rayos más cercanos.

### Playas del Mediterráneo

```
ola en la orilla = ola mar adentro × √cos(ángulo de llegada) × apertura
```

- **Ángulo de llegada:** la separación entre `mira` y la dirección de la ola. La energía que llega a la orilla es proporcional al coseno del ángulo y la altura, a la raíz de la energía. Una ola de 90° o más no llega.
- **Apertura:** el alcance en la dirección de la ola dividido entre 30 km, con un máximo de 1 (con 30 km de mar libre o más entra entera; es el mismo umbral que el abrigo).

Usar el alcance en la dirección exacta, y no el abrigo medio, importa en playas con un cabo a un lado. La Azohía (abrigo 0,52) tiene la Punta de la Azohía al sur, a 300-900 m: una ola de 0,28 m del sudoeste (207°) llega con 0,01 m, mientras que la del oeste entra casi entera. En Levante de Águilas (abrigo 0,69), una ola del sudeste entra por la boca de la bahía y llega entera.

### Playas del Mar Menor

El modelo marino de Open-Meteo no cubre la laguna, así que la ola se estima con el viento local, con las relaciones de oleaje limitado por el alcance del Shore Protection Manual (US Army Corps of Engineers, 1984), basadas en JONSWAP:

```
H = 0,0016 · U · √(F / g)
T = 0,2857 · (U / g) · ∛(g · F / U²)
```

con U el viento en m/s, F los metros de laguna que tiene en contra (el alcance en la dirección del viento) y g = 9,81 m/s². Con 30 km/h y 10 km de laguna da 0,43 m y 2,7 s. Se aplica también el factor del ángulo de llegada, y el viento de tierra no levanta ola en la orilla. El periodo, muy corto, es lo que distingue la ola de viento de la laguna del mar de fondo: con 40 km/h y toda la laguna en contra se queda en 3,8 s.

F se limita a 21 km. El rayo más largo dentro de la laguna mide 20,7 km (de La Puntica a Playa Honda, de un extremo al otro); algunos rayos se escapan al Mediterráneo por las golas de La Manga y llegan a 50 km, pero la ola solo se forma sobre la laguna.

### Límites del oleaje

- **No hay propagación del oleaje.** Ni refracción ni difracción alrededor de los cabos, ni el efecto del fondo: es una estimación geométrica. Una bahía cerrada por un cabo recibe algo de ola que lo rodea, y aquí sale casi 0.
- **El periodo no modifica la altura en la orilla.** Un mar de fondo de periodo largo rompe más que una mar de viento de la misma altura; el periodo solo lo usa el perfil surf.
- **En el Mar Menor no se limita por la profundidad**, de 4 a 7 m: con vientos muy fuertes la fórmula puede pasarse un poco.
- Si falta la orientación, los alcances o los datos de la hora, el resultado es `null`: no se inventa.

## Claridad del agua

`estimarClaridad(alturas, fondo)` (`claridad.ts`) estima si el agua está cristalina, buena o turbia. El oleaje remueve el fondo y el agua tarda horas en aclararse mientras el sedimento se posa, así que no basta con la ola de la hora: se acumula la de las horas previas.

1. Se toma la ola en la orilla de cada hora, de la más antigua a la actual.
2. Se calcula la media de su energía (H²) ponderada por la antigüedad: la hora actual pesa 1 y cada **semivida** el peso se reduce a la mitad. Se cuentan 4 semividas; más allá, una hora pesa menos de 1/16.
3. La **ola equivalente** es la raíz de esa media: la ola constante que habría removido el fondo lo mismo. Con oleaje sostenido, es esa misma ola.
4. Estado: **cristalina** por debajo de 0,2 m, **buena** hasta 0,5 m y **turbia** desde 0,5 m. Además devuelve `claridad`, de 1 (agua quieta) a 0 (ola equivalente de 1 m o más), que vale 0,5 en el corte de turbia.

La semivida depende del fondo (`fondoDePlaya`, con el suelo de ITREM):

| Fondo               | Semivida | Memoria | Por qué                                                   |
| ------------------- | -------- | ------- | --------------------------------------------------------- |
| Grava, bolos, roca  | 6 h      | 24 h    | Casi sin sedimento fino                                   |
| Arena (o sin datos) | 12 h     | 48 h    | Lo más común en la costa de Murcia                        |
| Mar Menor           | 24 h     | 96 h    | Somero y de fondo fangoso: se enturbia y tarda en aclarar |

Después de un día de temporal de 1 m en la orilla, con el mar ya casi plano (0,1 m):

| Horas de calma | 0      | 12     | 24         | 36         | 48         | 72         |
| -------------- | ------ | ------ | ---------- | ---------- | ---------- | ---------- |
| Grava          | turbia | buena  | cristalina | cristalina | cristalina | cristalina |
| Arena          | turbia | turbia | buena      | buena      | cristalina | cristalina |
| Mar Menor      | turbia | turbia | turbia     | buena      | buena      | buena      |

### Límites de la claridad

- **Las semividas y los cortes son estimaciones razonables, no valores medidos.** Hay que calibrarlos en la fase 12 con la transparencia del agua que mide el satélite (Copernicus Marine publica a diario la turbidez de la costa, con el coeficiente de atenuación KD490).
- **Solo ve el oleaje.** No sabe de lluvias y ramblas que arrastran barro, de algas, ni del estado ecológico del Mar Menor (los episodios de agua verde de 2016 y 2019 no los explica el oleaje).
- El suelo de ITREM es el de la playa, no el del fondo a unos metros; en la orilla suelen coincidir.
- Necesita las horas previas: quien la llame tiene que pasar al menos 4 semividas de historia (96 h en el Mar Menor). Las previsiones de horas pasadas se conservan (ver la retención en [modelo-datos.md](modelo-datos.md)).

## Perfiles

Cada perfil convierte las condiciones de una playa a una hora (`Condiciones`, en `perfiles/comun.ts`: ola en la orilla, viento y su entrada, temperaturas, nubosidad, claridad y socorrista) en una nota de 0 a 100, con el detalle de cada factor para poder explicarla.

- Cada dato se convierte en un **factor** de 0 a 1 con una **rampa** lineal entre un valor bueno (1) y uno malo (0), o una **meseta** si lo bueno es un tramo intermedio (la temperatura del aire).
- La nota es la **media geométrica ponderada** de los factores: `100 × Π factor^peso`. Un factor en 0 deja la nota en 0, así que un factor de **seguridad** veta la playa aunque todo lo demás sea perfecto. Los factores de **comodidad** tienen un suelo: restan, pero nunca vetan.
- Si falta un dato de comodidad, su peso se reparte entre los demás. Si falta uno imprescindible para el perfil, la nota es `null`.

Los umbrales son criterio de playa·hoy, no una norma; están juntos en cada perfil para poder revisarlos.

### Familia con niños

`notaFamilia` (`perfiles/familia.ts`). Sin ola o sin viento no hay nota.

| Factor               | Peso | Tipo      | 1         | 0 (o el suelo)           |
| -------------------- | ---- | --------- | --------- | ------------------------ |
| Ola en la orilla     | 35 % | Seguridad | ≤ 0,2 m   | ≥ 0,6 m                  |
| Viento               | 20 % | Seguridad | ≤ 12 km/h | ≥ 35 km/h                |
| Viento de tierra     | —    | Seguridad | ≤ 8 km/h  | ≥ 20 km/h                |
| Temperatura del aire | 15 % | Comodidad | 24-30 °C  | ≤ 16 °C o ≥ 38 °C (0,2)  |
| Temperatura del agua | 15 % | Comodidad | ≥ 24 °C   | ≤ 18 °C (0,2)            |
| Claridad             | 10 % | Comodidad | ≥ 0,8     | 0 (0,5)                  |
| Socorrista           | 5 %  | Comodidad | sí        | no (0,6); sin datos, 0,8 |

- **El viento de tierra tiene su propia rampa, más estricta,** porque arrastra colchonetas e hinchables mar adentro. Con 20 km/h de mar la nota baja a 92; con 20 km/h de tierra, a 0.
- **En calma**, el viento no resta.
- **El socorrista pesa poco** porque OpenStreetMap no dice en qué meses hay.

Ejemplos: un día perfecto da 100; 0,4 m de ola y 20 km/h de mar, 72; 0,6 m de ola o más, 0.

### Snorkel

`notaSnorkel` (`perfiles/snorkel.ts`). Sin claridad o sin ola no hay nota.

| Factor               | Peso | Tipo           | 1            | 0 (o el suelo) |
| -------------------- | ---- | -------------- | ------------ | -------------- |
| Claridad             | 35 % | Imprescindible | ≥ 0,85       | ≤ 0,4          |
| Ola en la orilla     | 25 % | Seguridad      | ≤ 0,15 m     | ≥ 0,5 m        |
| Fondo                | 15 % | Comodidad      | roca o bolos | arena (0,4)    |
| Viento               | 10 % | Seguridad      | ≤ 12 km/h    | ≥ 30 km/h      |
| Viento de tierra     | —    | Seguridad      | ≤ 10 km/h    | ≥ 25 km/h      |
| Temperatura del agua | 10 % | Comodidad      | ≥ 24 °C      | ≤ 18 °C (0,2)  |
| Nubosidad            | 5 %  | Comodidad      | ≤ 30 %       | 100 % (0,6)    |

- **El agua turbia veta:** con la claridad en 0,4 o menos (ola equivalente de 0,6 m) no se ve nada bajo el agua.
- **El fondo cuenta al revés que para una familia:** roca y bolos 1, arena y grava 0,7, grava 0,6, arena 0,4 y sin datos 0,6. En la roca está la vida marina.
- **La ola veta antes** que en familia (0,5 m), porque la resaca empuja contra las rocas, y el viento de tierra aleja de la orilla al que nada.
- Con sol se ve más y con más color, pero el cielo cubierto resta poco.

Con las mismas condiciones, una playa de arena con el mar plano y el agua aún turbia tras un temporal puede ser buena para una familia y estar vetada para el snorkel.

**Límite:** el perfil no sabe del estado ecológico de cada sitio. La bahía de Portmán, colmatada por los vertidos de la minería, puntúa como cualquier otra playa de arena y grava con el mar en calma.

### Tomar el sol

`notaSol` (`perfiles/sol.ts`). Sin nubosidad o sin temperatura del aire no hay nota.

| Factor               | Peso | Tipo           | 1         | 0 (o el suelo)    |
| -------------------- | ---- | -------------- | --------- | ----------------- |
| Nubosidad            | 35 % | Imprescindible | ≤ 20 %    | ≥ 90 %            |
| Temperatura del aire | 30 % | Imprescindible | 22-30 °C  | ≤ 14 °C o ≥ 38 °C |
| Viento               | 25 % | Seguridad      | ≤ 10 km/h | ≥ 30 km/h         |
| Ola en la orilla     | 5 %  | Comodidad      | ≤ 0,5 m   | ≥ 1,5 m (0,7)     |
| Temperatura del agua | 5 %  | Comodidad      | ≥ 22 °C   | ≤ 18 °C (0,6)     |

- **El calor veta a partir de 38 °C**, por el riesgo de golpe de calor: a 30 °C la nota es 100, a 34 °C 81 y a 37 °C 54. En la Región de Murcia se superan a menudo en verano.
- **El viento pesa más que en los otros perfiles**, porque tumbado se nota mucho, pero da igual de dónde venga: no hay hinchables ni nadadores que arrastrar.
- **La ola apenas cuenta**: un día despejado con 1 m de ola es bueno para tomar el sol y está vetado para una familia.

**Mejora pendiente: el índice UV.** AEMET solo da el máximo del día y para 27 playas. Open-Meteo Forecast tiene `uv_index` por horas: añadirlo a la ingesta permitiría avisar de las horas de radiación más alta.

### Surf

`notaSurf` (`perfiles/surf.ts`), con la lógica al revés que los demás: se busca la ola. Sin ola no hay nota.

| Factor               | Peso | Tipo           | 1             | 0 (o el suelo)         |
| -------------------- | ---- | -------------- | ------------- | ---------------------- |
| Ola en la orilla     | 40 % | Imprescindible | 0,7-1,8 m     | ≤ 0,3 m o ≥ 2,8 m      |
| Periodo              | 25 % | Calidad        | ≥ 8 s         | ≤ 4 s                  |
| Viento               | 25 % | Calidad        | según entrada | según entrada          |
| Temperatura del agua | 5 %  | Comodidad      | ≥ 20 °C       | ≤ 14 °C (0,5)          |
| Temperatura del aire | 5 %  | Comodidad      | 15-32 °C      | ≤ 8 °C o ≥ 38 °C (0,5) |

El viento, según cómo entra en la playa:

| Entrada | 1         | 0         | Por qué                                |
| ------- | --------- | --------- | -------------------------------------- |
| Tierra  | ≤ 25 km/h | ≥ 45 km/h | Peina la ola; muy fuerte, cuesta remar |
| Lado    | ≤ 10 km/h | ≥ 30 km/h |                                        |
| Mar     | ≤ 8 km/h  | ≥ 25 km/h | Deshace la ola                         |
| Calma   | 1         |           |                                        |

- **La ola veta por los dos lados:** sin ola no hay surf y, en una costa sin picos de ola grande, a partir de 2,8 m es peligroso. Los días buenos de levante dan 1-1,5 m en la orilla.
- **El periodo corta en 4 s**, por debajo de lo que se pediría en el Atlántico, porque el Mediterráneo rara vez pasa de 9 s.
- **El abrigo no es un factor aparte:** ya está dentro de la ola en la orilla.
- **El Mar Menor queda fuera por la física, no por una excepción:** hasta 40 km/h su ola de viento no llega a 4 s de periodo, y con más viento, que tiene que entrar desde la laguna para levantar ola, lo veta el viento de mar.
- Un buen día de surf veta a la familia, y un día de mar plano veta el surf.

## Razones

`generarRazones(perfil, nota, condiciones)` (`razones.ts`) convierte el detalle de factores de una nota en frases cortas, con su cifra y con coma decimal. Cada factor da como mucho una frase, según su valor:

| Tipo        | Valor del factor | Ejemplo                                       |
| ----------- | ---------------- | --------------------------------------------- |
| `descarta`  | 0                | Demasiada ola para niños (0,8 m en la orilla) |
| `en_contra` | menos de 0,65    | Agua fría (19 °C)                             |
| `a_favor`   | 0,9 o más        | Poca ola en la orilla (0,1 m)                 |

Entre 0,65 y 0,9 no se dice nada: ni ayuda ni estorba lo bastante. Se devuelven como mucho 4, en este orden:

- **Si algo descarta la playa**: lo que la descarta y lo que resta. Las razones a favor confundirían.
- **Con nota alta (70 o más)**: la razón a favor que más pesa, después todo lo que resta y después el resto a favor. Un 97 de snorkel empieza por «Agua cristalina» y no por «Nubes», aunque resten un poco; y una advertencia como «cuidado con los hinchables» cabe siempre.
- **Con nota baja**: primero lo que resta.

Lo que resta va de más a menos (peso × lo que le falta para 1); lo que suma, por su peso.

Las frases cambian con el perfil cuando cambia el sentido: el viento de tierra es «cuidado con los hinchables» en familia, «aleja de la orilla» en snorkel y «peina la ola» en surf. En los factores de meseta, el perfil indica si fallan por abajo o por arriba (`lado`), para distinguir «Fresco» de «Calor» o «Poca ola» de «Ola grande» sin repetir los umbrales.

Ejemplo real (Pedrucho Norte, 30 de octubre de 2026 a las 12:00):

| Plan    | Nota | Razones                                                                                           |
| ------- | ---- | ------------------------------------------------------------------------------------------------- |
| Familia | 80   | Ola de 0,4 m en la orilla · Viento suave (7 km/h) · Agua templada (24 °C)                         |
| Snorkel | 58   | Agua algo turbia: poca visibilidad · Ola de 0,4 m en la orilla · Fondo de arena: poca vida marina |
| Sol     | 61   | Nubes (73 % del cielo) · Temperatura agradable (22 °C) · Viento suave (7 km/h)                    |
| Surf    | 0    | Mar de viento, sin ola surfeable (4 s) · Poca ola (0,4 m en la orilla)                            |

## Mejor franja del día

`mejorFranja(horas, luz)` (`franja.ts`) busca las tres horas seguidas de mejor nota media de un plan, solo entre las horas de luz. Una hora cuenta si entera es de día: empieza después del orto y acaba antes del ocaso. Si dos franjas empatan, gana la más temprana; las horas sin nota cortan la franja, y si la mejor media es 0 no hay franja que recomendar.

Las horas de luz salen de `ortoYOcaso(día, lat, lon)` (`luz.ts`), con la ecuación del orto (el método simplificado de la NOAA): el sol sale cuando su borde superior asoma, con el centro a 0,833° bajo el horizonte por la refracción y el radio del disco. Contrastado con Open-Meteo en Cartagena en los dos solsticios y los dos días de cambio de hora de 2025: acierta con menos de un minuto de diferencia. Así las horas de día cambian con la fecha y el lugar (en junio el día dura 14 h 45 min; en diciembre, 9 h 30 min).

Ejemplo real (Bolnuevo, 30 de octubre de 2026, sol de 07:27 a 18:09): familia de 12:00 a 15:00 (98), snorkel y sol de 08:00 a 11:00 (87 y 86), y surf sin franja.

## Bandera probable

`banderaProbable(ola, viento, entrada)` (`bandera.ts`) estima la bandera que es de esperar que ice el socorrista. La decide el socorrista en la playa, coordinado con el ayuntamiento: es una **estimación** y así hay que presentarla, y solo tiene sentido en playas con socorrista.

| Bandera  | Condición                                                                        |
| -------- | -------------------------------------------------------------------------------- |
| Verde    | Ola en la orilla de menos de 0,5 m y sin viento peligroso                        |
| Amarilla | Ola de 0,5 m o más, viento de tierra de 20 km/h o más, o viento de 40 km/h o más |
| Roja     | Ola en la orilla de 2 m o más                                                    |

Devuelve también los motivos de la amarilla o la roja (`ola`, `viento`, `viento_tierra`). Sin la ola no se estima.

**De dónde salen los cortes.** No hay criterios oficiales con cifras: el plan COPLA de la Región de Murcia (Plan de Vigilancia y Rescate en Playas y Salvamento en la Mar) no los fija. La única referencia encontrada con una cifra es el [plan de salvamento de Vélez-Málaga](https://www.velezmalaga.es/contenido/datos/playas/documentos/FASE-PLANIFICACION-KZ79e0.pdf): verde con «mar tranquilo, sin peligro o riesgo aparente», amarilla con «olas de 1,5 m de altura, corrientes moderadamente fuertes» y roja cuando se prohíbe el baño. Por eso 1,5 m queda dentro de la amarilla y la roja empieza en 2 m. El corte de la verde (0,5 m) y los del viento son criterio de playa·hoy; el del viento de tierra sigue la práctica de la costa de Murcia y Alicante de izar la amarilla con poniente, que arrastra las colchonetas mar adentro (el mismo umbral que veta el perfil familia).

Con la previsión de la última semana de octubre de 2026 (playas con socorrista, de 10:00 a 19:00), salen 1.335 horas verdes y 15 amarillas, todas en San Ginés por viento de tierra de 22-24 km/h con el mar plano.

**Pendiente de contrastar:** la bandera real que se iza. Algunos ayuntamientos la publican a diario; compararla con la estimada sería la forma de calibrar estos cortes.

## De la previsión a las notas

`evaluarPlaya(playa, horas, desde)` (`evaluar.ts`) une todas las piezas para una playa: de la serie de previsión mar adentro por horas saca, para cada hora desde `desde`, el oleaje en la orilla, la entrada del viento, la claridad (con las horas previas de la serie), las notas de los cuatro planes con sus razones y la bandera probable.

El job `calcular:notas` (`jobs/src/notas.ts`) prepara la serie de cada playa y guarda el resultado en `condiciones` y `notas`:

- De cada hora usa la previsión de la **última emisión**; para la claridad toma también las 96 horas anteriores (4 semividas en el Mar Menor), de la emisión que las cubría.
- En el **Mar Menor**, la temperatura del agua es la de AEMET de ese día, de la playa de laguna con predicción más cercana; si no la hay, la de Open-Meteo (la de una celda del Mediterráneo).
- Corre tras cada ingesta de Open-Meteo, en el mismo paso del workflow. Con 83 playas tarda unos 15 segundos.

Con la previsión del 29 de octubre de 2026, la nota media de familia es 74, la de snorkel 75, la de tomar el sol 43 (otoño, con nubes) y la de surf 3: sin mar de fondo, casi ninguna hora tiene ola surfeable.

## Escenarios de referencia

`packages/core/src/escenarios.test.ts` prueba el motor con la geografía real de 8 playas (`pruebas/playas-referencia.json`: Galúa, El Galán, Los Narejos, Bolnuevo, Levante de Águilas, La Azohía, Calblanque y El Portús) y cinco situaciones típicas de la costa, sostenidas durante las 96 horas previas. Comprueban lo que se sabe de la costa, no cifras exactas:

| Escenario                                  | Lo que debe salir                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Levante fuerte (1,8 m del este, 30 km/h)   | La Manga hacia el Mediterráneo, 0 para familias y bandera amarilla; al sur (Mazarrón, Águilas, Cartagena), resguardadas. En la orilla del Mar Menor de La Manga el levante es de tierra y arrastra los hinchables. Nadie toma el sol con 30 km/h |
| Mar de fondo de levante con poniente suave | Día de surf en La Manga (90 o más): la ola entra y el poniente, de tierra, la peina. En las demás, abrigadas o de laguna, no hay ola                                                                                                             |
| Poniente (30 km/h, 33 °C)                  | En La Manga hacia el Mediterráneo es de tierra: bandera amarilla por viento y 0 para familias. En el Mar Menor llega desde la laguna y levanta picado en la orilla de La Manga                                                                   |
| Calma de verano                            | Familia 95 o más y sol 100 en todas; surf 0; para snorkel, mejor las calas de fondo mixto que la arena fina                                                                                                                                      |
| Brisa de tarde (sudeste, 18 km/h)          | Familia algo más baja que en calma, sin bandera roja ni vetos; sin surf (mar de viento de 4 s)                                                                                                                                                   |

Si un cambio en el motor rompe uno de estos escenarios, o el cambio es un error o el escenario tiene que revisarse con un motivo.

## Tests de propiedades

`packages/core/src/propiedades.test.ts` usa [fast-check](https://fast-check.dev/) para comprobar reglas que el motor debe cumplir con **cualquier** entrada: genera 2.000 casos al azar por regla, con nulos y valores extremos (olas de 6 m, vientos de 150 km/h, rumbos de -720° a 720°), y si uno rompe una regla lo reduce al caso más simple que la rompe.

- La nota es siempre un entero entre 0 y 100, o `null` si faltan datos; cada factor, entre 0 y 1.
- Un factor en 0 deja la nota en 0, y si falta un dato imprescindible de un plan, la nota es `null`.
- Las notas se mueven en el sentido que deben, con todo lo demás igual: más ola nunca sube familia ni snorkel; más viento nunca sube familia ni sol; agua más clara nunca baja snorkel; más nubes nunca suben sol; un periodo más largo nunca baja surf.
- Como mucho cuatro razones; si alguna descarta la playa, la nota es 0 y no hay razones a favor.
- Los rumbos normalizados están en [0, 360) y los giros en (-180, 180]; `haciaTierra` entre -1 y 1.
- En el Mediterráneo la ola en la orilla nunca es mayor que mar adentro; la claridad está entre 0 y 1 y su ola equivalente no pasa de la más alta; más ola nunca baja la bandera.
- Si hay mejor franja, son tres horas de día con nota entre 1 y 100.

Para comprobar que las reglas sirven, se rompió a propósito `rampa` (sin limitar a [0, 1]): fallaron 8 de las 16.
