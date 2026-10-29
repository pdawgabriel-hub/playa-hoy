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

El modelo marino de Open-Meteo no cubre la laguna, así que la ola se estima con el viento local, con la relación de oleaje limitado por el alcance de JONSWAP del Coastal Engineering Manual (US Army Corps of Engineers):

```
H = 0,0016 · U · √(F / g)
```

con U el viento en m/s, F los metros de laguna que tiene en contra (el alcance en la dirección del viento) y g = 9,81 m/s². Con 30 km/h y 10 km de laguna da 0,43 m. Se aplica también el factor del ángulo de llegada, y el viento de tierra no levanta ola en la orilla.

F se limita a 21 km. El rayo más largo dentro de la laguna mide 20,7 km (de La Puntica a Playa Honda, de un extremo al otro); algunos rayos se escapan al Mediterráneo por las golas de La Manga y llegan a 50 km, pero la ola solo se forma sobre la laguna.

### Límites del oleaje

- **No hay propagación del oleaje.** Ni refracción ni difracción alrededor de los cabos, ni el efecto del fondo: es una estimación geométrica. Una bahía cerrada por un cabo recibe algo de ola que lo rodea, y aquí sale casi 0.
- **El periodo no se usa todavía.** Un mar de fondo de periodo largo rompe más en la orilla que una mar de viento de la misma altura.
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
