# clocking · Android y HTML

**[Descargar APK firmado para Android](https://github.com/sebaawl/clockgame/raw/refs/heads/main/downloads/clocking-0.2.0.apk)** · Android 8.0 o posterior · sin conexión.

[Compilar y firmar sin Android Studio](android/README.md). La clave privada de firma no está en el repositorio.


Juego móvil minimalista de reloj analógico. Poppins Bold para el tiempo y el puntaje, ciclo a la izquierda y botón de ajustes a la derecha. Reloj grueso, manecillas con rebote y respuesta táctil y sonora opcional.

## Abrir el juego

Descarga el HTML entregado en el chat y ábrelo en un navegador que ejecute archivos HTML. Es un único archivo: incluye juego, estilos, Poppins y su licencia. No requiere red, servidor ni instalaciones. Algunas vistas previas de archivos móviles no ejecutan JavaScript; utiliza un navegador.

Las nuevas versiones se entregan como HTML en el chat. No se suben automáticamente a GitHub.

## Inicio y modos

Primero aparece el selector de modo. Al pulsar **Jugar**, se muestra **FASE 1 · HORA** durante tres segundos y comienza el primer ajuste con cero puntos. No hay ensayo ni jugada previa.

- **Normal:** cualquier dirección sirve para llegar a las doce. Cada ciclo empieza con 15 segundos.
- **Difícil:** solo cuenta completar el recorrido más largo, con un 20 % menos de tiempo. Si marca las 3, hay que avanzar en sentido horario durante nueve pasos. Llegar por el atajo antihorario no da puntos ni supera el ajuste. El progreso neto impide saltarse la regla invirtiendo el último toque. Los empates a las seis se excluyen de este modo para que el recorrido largo sea inequívoco. Los aciertos válidos reciben ×1,5 puntos.

Las posiciones iniciales se eligen de toda la esfera: cerca o lejos de las doce, desde el primer ajuste y en todos los ciclos.

## Controles y ajustes

Toca la mitad izquierda para girar en sentido antihorario y la derecha para girar en sentido horario. Tocar el propio reloj también gira: los ajustes se abren con el botón dedicado de engranaje.

El contador permite pausar. En ordenador funcionan las flechas, Espacio para pausar/continuar y Escape para pausar. Ocultar la pestaña pausa el juego y conserva el tiempo restante.

El panel de ajustes entra desde abajo y sale hacia abajo; la partida permanece pausada hasta que termina de cerrarse. Permite activar/desactivar sonido y vibración y cambiar entre modo claro y oscuro. Las preferencias y el último modo se conservan cuando el navegador permite almacenamiento local.

El clic usa un recorte de 90 ms del audio proporcionado por el usuario, integrado en el HTML como PCM y reproducido a volumen bajo. No requiere descargas de audio. La vibración es de 8 ms por ajuste y más larga al abrir ajustes. Si el navegador no admite vibración, el control se desactiva con una explicación.

## Aciertos, fases y final

Cada acierto dispara un círculo sólido que alcanza los bordes y se desvanece en un segundo: blanco en modo oscuro, negro en modo claro. Durante el efecto se bloquean giros accidentales.

Hay tres fases; cada una tiene los ciclos HORA → MINUTO → SEGUNDO, con 10 ajustes por ciclo: 90 ajustes en total. Los límites bajan durante cada fase, con mínimos distintos por ciclo y margen para completar el recorrido manualmente; ver el equilibrio de Nitro más abajo. Difícil reduce el presupuesto base con un factor de 0,8. Cambiar de ciclo o fase muestra su nombre durante tres segundos, sin consumir tiempo de juego.

El fondo se mantiene negro puro; el modo claro usa blanco puro. Si ambos cambian a la vez, fase y ciclo se anuncian en un único descanso.

Al agotarse el tiempo aparecen inmediatamente el puntaje y **Reintentar**, con un único destello rojo. No hay texto flotante ni espera adicional. Reintentar conserva el modo y vuelve a FASE 1 · HORA con cero puntos; **Cambiar modo** vuelve al menú.

## Puntaje

La clasificación interna usa el tiempo activo absoluto: **excelente** hasta 1 segundo (20–22 puntos base), **bien** hasta 2 segundos (10–14), **insuficiente** hasta 3 segundos (4–6) y **malo** después de 3 segundos (2 puntos; 1 después de 5). La precisión reduce la recompensa si hay pulsaciones extra. Los ciclos y fases añaden un pequeño multiplicador, la racha se limita a un 10 % y difícil conserva ×1,5.

Las resoluciones de más de tres segundos siempre dan 1–2 puntos, sin multiplicadores. En normal, 1000 puntos requieren alrededor de 40 resoluciones excelentes o 60 buenas, según precisión y avance. La espera de los descansos y las pausas no se cuenta.

El ajuste **Destello de acierto** desactiva tanto el círculo de acierto como el del aterrizaje inicial. El puntaje invierte su color sobre el círculo para seguir visible en ambos temas.

## Desarrollo y validación

Node.js 20.19+ o 22.12+; validado con Node.js 24.

```sh
npm ci
npm run dev -- --port 5173
npm test
npm run build
```

En Codex: `npm ci --cache /workspace/.cache/npm` si la caché predeterminada no es escribible. Edita `src/`, incluida la plantilla `src/index.html`. La compilación genera `dist/index.html` y actualiza el HTML autónomo `index.html` de la raíz; no edites ese archivo generado.

```sh
npx playwright install chromium
npm run test:e2e
```

Con Chromium del sistema: `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`.

Los tests recorren los 90 ajustes en ambos modos, comprueban el bloqueo de atajos en difícil, límites, pausas, aleatoriedad, puntaje y flujo de inicio. Las pruebas de navegador cubren móvil y escritorio, audio y vibración, ajustes animados, temas, game over inmediato y HTML autónomo sin red ni almacenamiento. La prueba adicional de file:// se omite si la política del navegador administrado impide abrir archivos locales; las pruebas del contenido autónomo se ejecutan igualmente.

Prototipo web; no incluye paquetes nativos de iOS/Android.

Los segundos tienen 120 pasos por vuelta (10 pulsaciones entre marcas); los minutos, 60 (5 entre marcas). Los ajustes permiten volver al menú sin reanudar la partida. El puntaje depende principalmente del tiempo activo de resolución.

Los ajustes usan una superficie sólida (negra o blanca) con botones de iconos para volver al menú y reiniciar. El selector de modo comparte un contorno que se desplaza y dibuja su trazo. Botones, iconos, interruptores, cambios de pantalla y contenidos del panel tienen animaciones breves; se desactivan con la preferencia de movimiento reducido del sistema.

Los botones principales tienen forma de pastilla. En ajustes se puede elegir y preescuchar Suave, Gota, Madera, Aire o el clic Reloj proporcionado por el usuario; la selección se guarda. Los controles usan sonidos discretos de pulsación y deslizamiento, con señales breves para aciertos y fin de partida. El interruptor Sonido silencia todo, incluidas las muestras; un compresor y un límite de voces evitan acumulación de volumen al pulsar rápido. Todo el audio funciona sin red.

El audio actual usa exclusivamente el recorte mecánico real del usuario: Amortiguado, Grave y Mecánico son variaciones filtradas y ralentizadas de esa grabación. Se eliminaron los tonos sintetizados. Los botones combinan una presión y una liberación más suave; dos filtros de paso bajo atenúan los agudos, y el audio sigue respetando el silencio global.

Los botones usan ahora el archivo real `emilianodleon-select-button-ui-395763.mp3`. Iniciar, abrir/cerrar ajustes y regresar al menú combinan ese clic con `dishantbabariya-chalk-slide-short-516557.mp3`, con una separación de 25 ms y volumen más bajo para el deslizamiento. Ambos recortes están integrados como PCM en el HTML. Se conserva el sonido previamente aprobado del selector de modo.

Tras FASE 1 · HORA aparece una guía transparente con ambas mitades y sus sentidos de giro. El tiempo permanece congelado hasta el primer toque. Este inicia un salto con giro completo; al aterrizar, el reloj emite un resplandor y arranca el temporizador. El toque inicial no altera la posición ni suma puntos. La guía vuelve a mostrarse al reiniciar; el movimiento reducido sustituye el salto por un fundido breve.

## Nitro, combos y formatos (0.2.0)

- **Clásico:** mantiene las tres fases de HORA → MINUTO → SEGUNDO. Los límites avanzados se revisaron: minutos tienen mínimos de 9/7/6 segundos; segundos 12/10/9; horas conservan 7/5/3. Difícil aplica su factor de 0,8, con un margen mínimo adicional según el recorrido (pasos/9 + 0,75 s), para poder completarlo con nueve pulsaciones manuales por segundo sin Nitro.
- **Supervivencia:** empieza con 15 s en un único cronómetro, hasta un máximo de 25 s. Sigue contando durante el segundo de celebración. Cada reloj añade `max(1,3; 3,1 − aciertos × 0,015)` segundos y una solución perfecta añade 0,6 s. Cambia de ciclo cada diez relojes sin interrumpir la partida; continúa indefinidamente y guarda el récord local por formato y dificultad.
- **Arcade:** solo aparece como próximo modo. Todavía no cambia direcciones ni introduce movimientos automáticos.

Cada partida empieza con **40% de Nitro**. Un toque corto mueve un paso al soltar. Mantener **250 ms** activa la aceleración, sin sumar una pulsación inicial adicional. En 100 ms alcanza 10/28/42 pasos por segundo (horas/minutos/segundos). Se consumen **40 puntos porcentuales por segundo**, solo mientras acelera; sin carga, mantener no repite movimientos. Al soltar se detiene. No hay recarga pasiva ni avance automático entre relojes.

Resolver recarga 4%; el recorrido perfecto añade 4%; los múltiplos de cinco dan 6% extra y los de diez 10% extra (en diez se concede solo el bono de diez). El máximo es 100%. Usar Nitro no resta precisión: se cuentan pasos, no gestos. Normal considera perfecto el camino más corto (ambos en un empate); difícil, el recorrido largo obligatorio. Desviarse del recorrido o pasarse de las doce rompe el combo y la perfección, aunque se puede corregir y resolver el reloj.

**No se detiene al pasar por las doce.** Mientras el dedo sigue pulsando, no se resuelve el objetivo. Soltar con Nitro todavía activo exactamente en las doce añade **Perfect Nitro: +5%**, además de los otros bonos. Agotar el depósito, cancelar el toque o abrir ajustes no concede ese bono. Si se agota la carga en las doce, se puede completar al soltar, sin Perfect Nitro. Los cambios de aplicación y la pausa cancelan la aceleración.

Un indicador pequeño bajo el reloj muestra carga y combo. A partir de ×5 aparecen acentos naranja y un pulso suave; Nitro colorea la manecilla, deja una estela corta y usa un sonido mecánico atenuado. Los últimos tres segundos activan un pulso del contador, tics discretos y una sola advertencia háptica por reloj. Sonido y vibración respetan los ajustes; movimiento reducido elimina la estela y los pulsos. No se añaden botones de Nitro ni sacudidas de pantalla.
