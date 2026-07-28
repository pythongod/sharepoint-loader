import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
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

// A changelog kept by good intentions stops at the third release. Requiring an
// entry for the version being shipped makes CI refuse an undocumented release.
const changelogPath = resolve(root, 'CHANGELOG.md');
let changelog = '';

try {
  changelog = readFileSync(changelogPath, 'utf8');
} catch {
  fail('CHANGELOG.md does not exist');
}

// Ask the parser rather than matching a second regex here. A guard with its
// own, looser grammar passes headings the extension cannot read — `## 0.4.0
// (2026-07-28)` satisfied a regex while rendering nothing — which is the exact
// silent-drop this rule exists to prevent.
createRequire(import.meta.url)('../src/changelog.js');

const documented = globalThis.SPL.changelog.highlights(changelog);

if (!documented.some((entry) => entry.version === manifest.version)) {
  fail(
    `CHANGELOG.md has no "## ${manifest.version}" entry the extension can read — ` +
      'document the release before shipping it'
  );
}

// Without an action block the toolbar tooltip and the click that opens the
// settings both disappear silently.
if (!manifest.action) fail('manifest.json must declare an action');

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
