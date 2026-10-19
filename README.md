# clocking

Solo un reloj analógico blanco y un contador de segundos grande sobre negro. Sin menús, textos, colores de acento ni botones visibles. Trazos gruesos y redondeados; las manecillas se mueven con un pequeño rebote y el reloj responde a cada toque. Al llegar a las doce, un círculo sólido blanco nace detrás del reloj, alcanza todas las esquinas y después desaparece en fade out. El efecto completo dura **un segundo**, sin degradados.

## Jugar sin instalar nada

1. Descarga el ZIP del repositorio desde **Code → Download ZIP**.
2. Extrae el ZIP.
3. Abre el **index.html de la carpeta principal** en tu navegador.

El archivo ya incluye todo el juego. No necesita conexión, fuentes externas, Node.js ni servidor. Puedes copiarlo o renombrarlo. En móvil utiliza un navegador que ejecute HTML local: algunas aplicaciones de archivos solo muestran una vista previa.

## Controles

- Toca la mitad izquierda para retroceder y la derecha para avanzar. El primer toque inicia el ensayo y mueve el reloj.
- Toca el contador para pausar o continuar. Al volver de otra pestaña, el tiempo permanece pausado hasta que toques.
- Si llegas a cero, toca para repetir la fase sin perder el avance.
- En ordenador también funcionan las flechas, Espacio para iniciar/pausar y Escape para pausar.
- Durante el resplandor, los giros quedan bloqueados para evitar mover accidentalmente el reloj de la siguiente fase.
- Al completar las 270 fases, otro toque inicia una nueva partida.

## Progresión

Ensayo de 10 segundos. Después, tres tandas de horas → minutos → segundos, con 30 fases por etapa: 270 ajustes en total. Cada fase tiene su propio límite: la primera de cada etapa empieza en 15 segundos y disminuye linealmente hasta 7, 5 o 3 según la tanda. Un paso mueve una hora (30°), un minuto (6°) o un segundo (6°). La manecilla móvil es la que se ajusta; la otra señala las doce.

El temporizador se detiene durante el resplandor. La siguiente fase empieza después del segundo completo de animación. Con movimiento reducido, el efecto se sustituye por una iluminación suave de un segundo, sin expansión ni bump.

## Desarrollo

Node.js 20.19+ o 22.12+; validado con Node.js 24.

```sh
npm ci
npm run dev -- --port 5173
```

En Codex, si la caché predeterminada no es escribible: `npm ci --cache /workspace/.cache/npm`.

El código editable está en `src/`. La plantilla es `src/index.html`. `npm run build` genera `dist/index.html` y actualiza la versión autónoma `index.html` de la carpeta principal. Vuelve a compilar antes de subir cambios; no edites el archivo generado.

## Validación

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Con Chromium del sistema: `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`.

Los tests del motor recorren las 270 fases y sus límites. Las pruebas de navegador cubren escritorio/móvil, controles, el resplandor de un segundo, pausa, reintentos, progreso y movimiento reducido. También ejecutan el HTML autónomo sin red ni acceso al almacenamiento. La comprobación adicional de `file://` se omite si el navegador administrado bloquea ese protocolo; las pruebas del contenido autónomo se ejecutan igualmente.

Es un prototipo web; no incluye paquetes nativos de iOS/Android.
