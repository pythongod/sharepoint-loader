import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

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

const javascriptReferences = [];
const findJavaScript = (value) => {
  if (typeof value === 'string' && value.endsWith('.js')) javascriptReferences.push(value);
  else if (Array.isArray(value)) value.forEach(findJavaScript);
  else if (value && typeof value === 'object') Object.values(value).forEach(findJavaScript);
};
findJavaScript(manifest);
if (javascriptReferences.length === 0) fail('manifest.json does not reference a content script');
for (const file of new Set(javascriptReferences)) {
  if (/^[a-z]+:/i.test(file) || file.startsWith('//')) fail(`JavaScript reference must be local: ${file}`);
  try {
    if (!statSync(resolve(root, file)).isFile()) fail(`JavaScript reference is not a file: ${file}`);
  } catch {
    fail(`referenced JavaScript file does not exist: ${file}`);
  }
}

try {
  execFileSync(process.execPath, ['--check', 'src/content.js'], { cwd: root, stdio: 'inherit' });
} catch {
  fail('node --check src/content.js failed');
}
console.log(`Validation passed: Manifest V3, version ${manifest.version}, ${javascriptReferences.length} JavaScript reference(s).`);
