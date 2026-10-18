import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, character => entities[character]);
}

export default defineConfig({
  plugins: [{
    name: 'build-identity',
    transformIndexHtml(html) {
      // Dev requests read the current checkout on every reload. Production HTML
      // keeps the identity of the source it was built from, even after git pull.
      const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
      const commit = git('rev-parse', '--verify', 'HEAD');
      const count = git('rev-list', '--count', 'HEAD');
      const status = commit ? git('status', '--porcelain', '--untracked-files=normal') : null;
      const values: Record<string, string> = {
        __APP_VERSION__: `v${version}${count ? '+' + count : ''}`,
        __APP_COMMIT__: commit ?? 'Unavailable',
        __APP_SOURCE_STATE__: status === null ? 'Git information unavailable' : status ? 'Local changes' : 'Committed source',
      };
      return html.replace(/__APP_(?:VERSION|COMMIT|SOURCE_STATE)__/g, token => escapeHtml(values[token]));
    },
  }],
});
