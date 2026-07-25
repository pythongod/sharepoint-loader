// Works out exactly which files belong in the package, so neither the
// validator nor the build carries a hand-maintained list that can drift as
// modules are added.
import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';

const ASSET = /\.(js|html|css|png)$/i;

// Every string anywhere in the manifest that names a packaged file.
function manifestReferences(manifest) {
  const found = [];
  const walk = (value) => {
    if (typeof value === 'string') {
      if (ASSET.test(value) && !/^[a-z]+:/i.test(value) && !value.startsWith('//')) {
        found.push(value);
      }
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };

  walk(manifest);

  return found;
}

// An options page pulls in scripts the manifest never mentions.
function htmlReferences(root, htmlPath) {
  const html = readFileSync(resolve(root, htmlPath), 'utf8');
  const directory = posix.dirname(htmlPath);
  const found = [];

  for (const match of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/gi)) {
    const reference = match[1];

    if (!ASSET.test(reference) || /^[a-z]+:/i.test(reference) || reference.startsWith('//')) {
      continue;
    }

    found.push(posix.normalize(posix.join(directory, reference)));
  }

  return found;
}

export function packageFiles(root, manifest) {
  const files = new Set(['manifest.json']);

  for (const reference of manifestReferences(manifest)) {
    files.add(reference);

    if (reference.toLowerCase().endsWith('.html')) {
      for (const nested of htmlReferences(root, reference)) files.add(nested);
    }
  }

  return [...files].sort();
}
