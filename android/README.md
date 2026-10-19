# clocking para Android

Aplicación offline a pantalla completa, compatible con Android 8.0 o posterior. El APK de lanzamiento está en [`../downloads/clocking-0.1.1.apk`](../downloads/clocking-0.1.1.apk). Está firmado con un certificado de lanzamiento propio, no con una clave de depuración.

El contenedor nativo usa Android WebView y lleva el HTML, fuentes y audios integrados. No solicita permiso de Internet. Permite vibración; los botones físicos de volumen controlan el audio multimedia. Al cambiar de aplicación, la partida se pausa. Atrás cierra ajustes, abre ajustes desde el juego, vuelve al menú desde resultados o sale desde el menú.

## Compilar sin Android Studio

Requisitos: Linux x86_64, JDK 17 o posterior **con javac**, Python 3.10 o posterior y Node 22 con npm. Las herramientas de Android se descargan del repositorio oficial de Google y se verifican con SHA-256.

```sh
npm ci
export ANDROID_HOME="$HOME/Android/Sdk"
python3 scripts/install-android-tools.py
python3 scripts/build-android.py \
  --keystore /ruta/privada/clocking-release.p12 \
  --password-file /ruta/privada/keystore.pass
```

El archivo de contraseña debe contener la contraseña del almacén y de la clave, con alias `clocking-release`. También se pueden usar `CLOCKING_KEYSTORE`, `CLOCKING_PASSWORD_FILE` y `CLOCKING_KEY_ALIAS`. El script rechaza claves y contraseñas dentro del checkout. No publica ni sube nada por sí mismo.

Para una actualización, usa **la misma clave** y aumenta el código de versión:

```sh
python3 scripts/build-android.py \
  --keystore /ruta/privada/clocking-release.p12 \
  --password-file /ruta/privada/keystore.pass \
  --version-name 0.1.2 --version-code 3
```

Sin esa clave, Android no permitirá instalar una actualización sobre esta versión. El certificado público se incluye en `signing-certificate.pem`; su huella se puede contrastar con el APK:

```sh
java -jar "$ANDROID_HOME/build-tools/35.0.0/lib/apksigner.jar" verify \
  --verbose --print-certs downloads/clocking-0.1.1.apk
```

La clave privada y su contraseña se entregan por separado al propietario, nunca en GitHub. Guarda esa copia privada antes de descartar el entorno de compilación.

## Instalación

Descarga el APK en el teléfono, ábrelo y autoriza a tu navegador a instalar esta aplicación si Android lo solicita. No requiere Google Play ni conexión después de instalarse. Es una firma propia: Android puede mostrar una advertencia para aplicaciones instaladas fuera de Google Play.
