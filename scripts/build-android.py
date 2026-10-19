#!/usr/bin/env python3
"""Build a release-signed APK using Android CLI tools and an external key."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--keystore', default=os.environ.get('CLOCKING_KEYSTORE'))
parser.add_argument('--password-file', default=os.environ.get('CLOCKING_PASSWORD_FILE'))
parser.add_argument('--alias', default=os.environ.get('CLOCKING_KEY_ALIAS', 'clocking-release'))
parser.add_argument('--version-name', default='0.2.7')
parser.add_argument('--version-code', default='10')
parser.add_argument('--skip-web-build', action='store_true')
args = parser.parse_args()
if not args.keystore or not args.password_file:
    parser.error('--keystore and --password-file are required; release keys must stay outside the repository')
key, password = Path(args.keystore).resolve(), Path(args.password_file).resolve()
for private in [key, password]:
    if not private.is_file():
        parser.error('Signing file does not exist: ' + str(private))
    if private.is_relative_to(ROOT):
        parser.error('Keep signing files outside the Git checkout')
sdk = Path(os.environ.get('ANDROID_HOME', '/workspace/android-sdk')).resolve()
tools, platform = sdk / 'build-tools/35.0.0', sdk / 'platforms/android-35/android.jar'
for required in [tools / 'aapt2', tools / 'zipalign', tools / 'lib/d8.jar', tools / 'lib/apksigner.jar', platform]:
    if not required.exists():
        parser.error('Missing Android tool: ' + str(required) + '; run python3 scripts/install-android-tools.py')
def run(*command):
    subprocess.run([str(x) for x in command], cwd=ROOT, check=True)
if not args.skip_web_build:
    run('npm', 'run', 'build')
build = ROOT / 'android/build'
if build.exists():
    shutil.rmtree(build)
for directory in ['assets', 'generated', 'classes', 'dex']:
    (build / directory).mkdir(parents=True, exist_ok=True)
shutil.copyfile(ROOT / 'index.html', build / 'assets/index.html')
main = ROOT / 'android/app/src/main'
run(tools / 'aapt2', 'compile', '--dir', main / 'res', '-o', build / 'resources.zip')
run(tools / 'aapt2', 'link', '-I', platform, '--manifest', main / 'AndroidManifest.xml',
    '--min-sdk-version', '26', '--target-sdk-version', '35', '--version-code', args.version_code,
    '--version-name', args.version_name, '--java', build / 'generated', '-A', build / 'assets',
    '-o', build / 'unsigned.apk', build / 'resources.zip')
sources = list((main / 'java').rglob('*.java')) + list((build / 'generated').rglob('*.java'))
run('javac', '--release', '8', '-classpath', platform, '-d', build / 'classes', *sources)
with zipfile.ZipFile(build / 'classes.jar', 'w', zipfile.ZIP_DEFLATED) as jar:
    for path in sorted((build / 'classes').rglob('*.class')):
        jar.write(path, path.relative_to(build / 'classes').as_posix())
run('java', '-cp', tools / 'lib/d8.jar', 'com.android.tools.r8.D8', '--release', '--min-api', '26',
    '--lib', platform, '--output', build / 'dex', build / 'classes.jar')
with zipfile.ZipFile(build / 'unsigned.apk', 'a', zipfile.ZIP_DEFLATED) as apk:
    for dex in sorted((build / 'dex').glob('*.dex')):
        apk.write(dex, dex.name)
run(tools / 'zipalign', '-P', '16', '-f', '4', build / 'unsigned.apk', build / 'aligned.apk')
output = ROOT / 'downloads' / f'clocking-{args.version_name}.apk'
output.parent.mkdir(exist_ok=True)
run('java', '-jar', tools / 'lib/apksigner.jar', 'sign', '--ks', key, '--ks-key-alias', args.alias,
    '--ks-pass', 'file:' + str(password), '--v1-signing-enabled', 'true',
    '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true', '--v4-signing-enabled', 'false', '--out', output, build / 'aligned.apk')
run('java', '-jar', tools / 'lib/apksigner.jar', 'verify', '--verbose', '--print-certs', output)
run(tools / 'zipalign', '-c', '-P', '16', '4', output)
print('Signed APK:', output)
