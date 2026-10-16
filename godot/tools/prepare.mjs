import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Godot shares the repository's artwork. Keep browser build/dependency trees out
// of its importer without copying 86 MB of source artwork into a second project.
fs.mkdirSync(path.join(root, 'godot/test-results'), { recursive: true });
for (const directory of ['node_modules', 'dist', 'test-results', 'playwright-report', 'builds', 'godot/test-results']) {
  const target = path.join(root, directory);
  if (fs.existsSync(target)) fs.writeFileSync(path.join(target, '.gdignore'), '');
}
console.log('Godot project prepared. Open project.godot or run Godot with --path .');
