import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const artifact = join(dist, 'sharepoint-loader.zip');
execFileSync(process.execPath, ['scripts/validate.mjs'], { cwd: root, stdio: 'inherit' });

const staging = mkdtempSync(join(tmpdir(), 'sharepoint-loader-'));
const files = ['manifest.json', 'src/content.js'];
try {
  for (const file of files) {
    const destination = join(staging, file);
    mkdirSync(resolve(destination, '..'), { recursive: true });
    cpSync(join(root, file), destination);
    utimesSync(destination, new Date(0), new Date(0));
  }
  mkdirSync(dist, { recursive: true });
  rmSync(artifact, { force: true });
  execFileSync('zip', ['-X', '-q', artifact, ...files], { cwd: staging, stdio: 'inherit' });
} finally {
  rmSync(staging, { recursive: true, force: true });
}
console.log(`Built ${artifact} (${files.length} files).`);
