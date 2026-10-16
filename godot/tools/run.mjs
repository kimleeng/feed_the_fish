import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './prepare.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const candidates = process.env.GODOT_BIN
  ? [process.env.GODOT_BIN]
  : ['godot', 'godot4', ...(process.platform === 'darwin'
    ? ['/Applications/Godot.app/Contents/MacOS/Godot'] : [])];
const executable = candidates.find(candidate =>
  spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
if (!executable) {
  console.error('Install Godot 4.6+, add it to PATH, or set GODOT_BIN to its executable. You can also open project.godot in the editor.');
  process.exit(1);
}

function run(args) {
  const result = spawnSync(executable, ['--path', root, ...args], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: process.env,
  });
  if (result.error) throw result.error;
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status !== 0) process.exit(result.status ?? 1);
  // Godot can return zero after a script parse error during editor import.
  if (/SCRIPT ERROR:|Failed to load script/.test((result.stdout ?? '') + (result.stderr ?? ''))) process.exit(1);
}

const [mode = 'play', ...extra] = process.argv.slice(2);
if (mode === 'test') {
  run(['--headless', '--editor', '--import', '--quit']);
  for (const suite of ['simulation', 'ambience', 'integration']) {
    run(['--headless', '--script', `godot/tests/test_${suite}.gd`]);
  }
} else if (mode === 'editor') {
  run(['--editor', ...extra]);
} else if (mode === 'import') {
  run(['--headless', '--editor', '--import', '--quit', ...extra]);
} else if (mode === 'review') {
  run(['--script', 'godot/tests/review_native.gd', ...extra]);
} else if (mode === 'play') {
  run(extra);
} else {
  console.error(`Unknown Godot command: ${mode}`);
  process.exit(1);
}
