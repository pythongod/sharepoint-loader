import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageFiles } from './package-files.mjs';

const root = resolve(import.meta.dirname, '..');
const fail = (message) => {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
};
const readJson = (name) => {
  try {
    return JSON.parse(readFileSync(resolve(root, name), 'utf8'));
  } catch (error) {
    fail(`${name} is not valid JSON: ${error.message}`);
  }
};

const manifest = readJson('manifest.json');
const packageJson = readJson('package.json');
if (manifest.manifest_version !== 3) fail('manifest_version must equal 3');
if (manifest.name !== 'SharePoint Loader') fail('extension name must be "SharePoint Loader"');
if (manifest.version !== packageJson.version) fail('manifest.json and package.json versions must match');
if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length === 0) {
  fail('at least one content script is required');
}

const allowedMatches = new Set([
  'https://*.sharepoint.com/*',
  'https://*.sharepoint.cn/*',
  'https://*.sharepoint.de/*',
  'https://*.sharepoint.us/*',
]);
for (const script of manifest.content_scripts) {
  if (!Array.isArray(script.matches) || script.matches.length === 0) fail('each content script must declare matches');
  for (const match of script.matches) {
    if (!allowedMatches.has(match)) fail(`content-script match is not an approved SharePoint host: ${match}`);
  }
}

// New permissions change the Web Store privacy disclosure, so adding one must
// be a deliberate edit here rather than a silent manifest change.
const allowedPermissions = new Set(['storage']);
for (const permission of manifest.permissions ?? []) {
  if (!allowedPermissions.has(permission)) fail(`permission is not approved: ${permission}`);
}
if (manifest.host_permissions) fail('host_permissions must not be declared');
if (manifest.optional_permissions) fail('optional_permissions must not be declared');

if (!manifest.options_page) fail('manifest.json must declare an options page');
if (!manifest.icons || !manifest.icons['128']) fail('manifest.json must declare a 128px icon');

const files = packageFiles(root, manifest);
if (!files.includes('src/content.js')) fail('the content script entry point is missing');

for (const file of files) {
  try {
    if (!statSync(resolve(root, file)).isFile()) fail(`packaged reference is not a file: ${file}`);
  } catch {
    fail(`packaged file does not exist: ${file}`);
  }
}

const javascript = files.filter((file) => file.endsWith('.js'));
if (javascript.length === 0) fail('manifest.json does not reference a content script');
// One invocation per file: `node --check` only ever inspects its first file
// argument and silently ignores the rest, so passing them all at once checked
// exactly one script while appearing to check every one.
for (const file of javascript) {
  try {
    execFileSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  } catch {
    fail(`node --check failed: ${file}`);
  }
}
console.log(
  `Validation passed: Manifest V3, version ${manifest.version}, ${files.length} packaged file(s), ${javascript.length} script(s).`
);
