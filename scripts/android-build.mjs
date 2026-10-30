import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] ?? 'debug';
if (!['debug', 'bundle'].includes(mode)) { console.error('Usage: node scripts/android-build.mjs [debug|bundle]'); process.exit(1); }
const sdkCandidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(root, '.android-sdk'), path.join(os.homedir(), 'Library/Android/sdk'), path.join(os.homedir(), 'Android/Sdk')].filter(Boolean);
const sdk = sdkCandidates.find(candidate => existsSync(path.join(candidate, 'platforms/android-36/android.jar')));
const problems = [];
if (!sdk) problems.push('Android SDK 36 missing. Install Android SDK Platform 36, Platform-Tools and Build-Tools 36.0.0; set ANDROID_HOME to the SDK directory.');
else {
  if (!existsSync(path.join(sdk, 'build-tools/36.0.0'))) problems.push('Install Android Build-Tools 36.0.0.');
  if (!existsSync(path.join(sdk, 'licenses/android-sdk-license'))) problems.push('Review and accept the Android SDK license with sdkmanager --licenses. This script never accepts agreements automatically.');
}
const javaCandidates = [process.env.JAVA_HOME, '/Applications/Android Studio.app/Contents/jbr/Contents/Home'];
const localJava = path.join(root, '.android-cache/java');
if (existsSync(localJava)) {
  for (const entry of readdirSync(localJava)) {
    javaCandidates.push(path.join(localJava, entry, 'Contents/Home'), path.join(localJava, entry));
  }
}
if (process.platform === 'darwin') {
  const discovered = spawnSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' });
  if (discovered.status === 0) javaCandidates.push(discovered.stdout.trim());
}
const javaHome = javaCandidates.filter(Boolean).find(candidate => {
  const result = spawnSync(path.join(candidate, 'bin/java'), ['-version'], { encoding: 'utf8' });
  return result.status === 0 && /version "21[.\"]/.test(`${result.stdout}${result.stderr}`);
});
if (!javaHome) problems.push('Java 21 missing. Install a JDK 21 and set JAVA_HOME. A different IDE runtime (for example Java 25) is not selected automatically.');
if (problems.length) {
  console.error('Android build is not ready on this machine:\n' + problems.map(problem => `- ${problem}`).join('\n') + '\nSee ANDROID.md. No GUI, installation, license acceptance or device changes were performed.');
  process.exit(2);
}
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, ANDROID_USER_HOME: path.join(root, '.android-cache/android-user'), GRADLE_USER_HOME: path.join(root, '.android-cache/gradle'), PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH}` };
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('npm', ['run', 'build']);
run('npx', ['cap', 'sync', 'android']);
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [mode === 'debug' ? 'assembleDebug' : 'bundleRelease', '--no-daemon'], path.join(root, 'android'));
console.log(mode === 'debug'
  ? 'APK: android/app/build/outputs/apk/debug/app-debug.apk (development signature).'
  : 'AAB: android/app/build/outputs/bundle/release/app-release.aab (unsigned; configure your production signing before Play upload).');
