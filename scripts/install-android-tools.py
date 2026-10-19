#!/usr/bin/env python3
"""Install verified Android command-line build tools without Android Studio."""
import hashlib
import os
from pathlib import Path
import tempfile
import urllib.request
import zipfile

sdk = Path(os.environ.get('ANDROID_HOME', '/workspace/android-sdk')).resolve()
archives = [
    ('platform-35_r02.zip', '0988cacad01b38a18a47bac14a0695f246bc76c1b06c0eeb8eb0dc825ab0c8e0', 'android-35', 'platforms/android-35', 'android.jar'),
    ('build-tools_r35_linux.zip', 'bd3a4966912eb8b30ed0d00b0cda6b6543b949d5ffe00bea54c04c81e1561d88', 'android-15', 'build-tools/35.0.0', 'aapt2'),
]
for filename, checksum, prefix, target, marker in archives:
    destination = sdk / target
    if (destination / marker).exists():
        print(f'Using {destination}')
        continue
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / filename
        urllib.request.urlretrieve('https://dl.google.com/android/repository/' + filename, archive)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != checksum:
            raise SystemExit('Android download checksum verification failed: ' + filename)
        with zipfile.ZipFile(archive) as package:
            for item in package.infolist():
                relative = Path(item.filename).relative_to(prefix)
                output = destination / relative
                if '..' in relative.parts:
                    raise SystemExit('Unsafe archive member')
                if item.is_dir():
                    output.mkdir(parents=True, exist_ok=True)
                else:
                    output.parent.mkdir(parents=True, exist_ok=True)
                    output.write_bytes(package.read(item))
                    output.chmod(0o755 if (item.external_attr >> 16) & 0o111 else 0o644)
    print(f'Installed {destination}')
