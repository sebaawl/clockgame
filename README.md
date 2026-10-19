# clocking

Un juego de precisión para móvil: lleva un reloj desajustado a las doce tocando las dos mitades de la pantalla. Prototipo web responsive, en español, sin cuentas, servicios externos ni claves de API.

## Jugar sin instalar nada

1. Descarga el ZIP del repositorio desde **Code → Download ZIP**.
2. Extrae el ZIP completo.
3. Abre **index.html** con tu navegador (doble clic en ordenador).

El `index.html` de la carpeta principal ya incluye el juego, los estilos y las fuentes. Funciona sin conexión y no necesita Node.js ni un servidor. También puedes copiar ese archivo solo a otra carpeta. En móvil, ábrelo en un navegador que permita ejecutar archivos HTML locales; algunas aplicaciones de archivos solo muestran una vista previa.

## Desarrollo

Requiere Node.js 20.19+ o 22.12+ (validado con Node.js 24).

```sh
npm ci
npm run dev -- --port 5173
```

El código editable está en `src/`, incluida la plantilla `src/index.html`. `npm run build` genera una versión autónoma en `dist/index.html` y actualiza el `index.html` de la carpeta principal. No edites el HTML generado a mano. Antes de subir cambios, vuelve a compilar para incluir la versión descargable actualizada.

En el entorno de Codex, utiliza `npm ci --cache /workspace/.cache/npm` si la caché predeterminada no tiene permisos de escritura.

## Reglas implementadas

- Ensayo inicial: un ajuste con 10 segundos.
- Tres tandas de horas → minutos → segundos. Cada etapa tiene 30 fases: 270 ajustes en total, además del ensayo.
- Cada fase tiene su propio límite. La primera de cada etapa empieza con 15 segundos. Disminuye linealmente hasta 7 segundos en la primera tanda, 5 en la segunda y 3 en la tercera.
- Izquierda: un paso antihorario. Derecha: un paso horario. Un paso equivale a una hora (30°), un minuto (6°) o un segundo (6°), según la etapa. La manecilla coral es la que se ajusta; la oscura indica el destino.
- Los primeros desajustes son pequeños. La distancia máxima crece durante cada etapa. Alcanzar las doce resuelve la fase automáticamente.
- Cada toque produce una pequeña animación. Se respeta la preferencia de movimiento reducido.
- Si el tiempo se acaba, se puede repetir la fase conservando el avance o empezar de cero. Pausa manual, al abrir la ayuda y al ocultar la pestaña.
- Sonido opcional y mejor marca guardados localmente. No se guarda la partida al recargar: solo la mejor marca.

En ordenador: flechas izquierda/derecha para girar, espacio para iniciar o pausar y Escape para pausar.

## Validación

```sh
npm test
npm run build
```

Los tests del motor recorren todas las fases, los cambios de etapa y tanda, límites de tiempo, pausa y giros en ambos sentidos.

Para pruebas de integración en Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

Si hay un Chromium del sistema, puede reutilizarse sin descargar otro navegador:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

El comando de integración compila primero el HTML descargable. Playwright inicia su propio servidor en el puerto 4173 y prueba escritorio y móvil. También carga el contenido de una copia aislada de `index.html` en un documento sin origen, con la red desactivada, y comprueba que el juego funcione incluso con el almacenamiento local bloqueado. Las fuentes se incluyen con la aplicación: no hay peticiones a Google Fonts.

Una prueba adicional abre el archivo mediante `file://` y verifica que funcione incluso al renombrarlo. Si el navegador administrado prohíbe las rutas `file://`, esa comprobación se registra como omitida; las pruebas del contenido autónomo sin conexión se ejecutan igualmente.

## Alcance

Este repositorio contiene un prototipo web jugable. La distribución nativa en iOS/Android y la verificación de que no existan juegos similares quedan fuera de esta implementación.
