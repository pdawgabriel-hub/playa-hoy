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

### Límites

- **No hay propagación del oleaje.** Ni refracción ni difracción alrededor de los cabos, ni el efecto del fondo: es una estimación geométrica. Una bahía cerrada por un cabo recibe algo de ola que lo rodea, y aquí sale casi 0.
- **El periodo no se usa todavía.** Un mar de fondo de periodo largo rompe más en la orilla que una mar de viento de la misma altura.
- **En el Mar Menor no se limita por la profundidad**, de 4 a 7 m: con vientos muy fuertes la fórmula puede pasarse un poco.
- Si falta la orientación, los alcances o los datos de la hora, el resultado es `null`: no se inventa.
