import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { diffApi, readApi } from './api.js';

const legacy = {
  tags: [
    {
      name: 'cds-button',
      path: './src/components/button/button.ts',
      attributes: [{ name: 'disabled' }],
    },
    {
      name: 'step-group',
      path: './src/utilities/step-flow/step-group.ts',
    },
  ],
};

const standard = {
  schemaVersion: '1.0.0',
  modules: [
    {
      path: 'es/components/button/button.js',
      declarations: [
        { tagName: 'cds-button', attributes: [{ name: 'disabled' }] },
      ],
    },
    {
      path: 'es/utilities/step-flow/step-group.js',
      declarations: [{ tagName: 'step-group' }],
    },
  ],
};

let directory;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'carbon-api-reader-'));
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

function readManifest(manifest) {
  fs.writeFileSync(
    path.join(directory, 'custom-elements.json'),
    JSON.stringify(manifest)
  );
  return readApi(directory, 'custom-elements');
}

test('excludes WCA test/example entries and invalid names while keeping public tags', () => {
  const manifest = structuredClone(legacy);
  manifest.tags.push(
    { name: 'cds-test', path: './src/components/button/__tests__/test.ts' },
    {
      name: 'cds-story',
      path: './src/components/button/_story-assets/story.ts',
    },
    { name: 'cds-demo', path: './src/examples/demo/demo.ts' },
    {
      name: 'elementName',
      path: './src/components/full-page-error/full-page-error.ts',
    },
    {
      name: 'cds-examples-card',
      path: './src/components/examples-card/card.ts',
    },
    { name: 'cds-unknown-source' }
  );

  expect(readManifest(manifest)).toEqual([
    '<cds-button>',
    '<cds-button disabled>',
    '<step-group>',
    '<cds-examples-card>',
    '<cds-unknown-source>',
  ]);
});

test('compares the same public API across WCA and CEM formats', () => {
  const manifest = structuredClone(legacy);
  manifest.tags.push(
    { name: 'test-element', path: './src/__tests__/test.ts' },
    {
      name: 'elementName',
      path: './src/components/truncated-text/truncated-text.ts',
    }
  );

  expect(diffApi(readManifest(manifest), readManifest(standard))).toEqual({
    added: [],
    removed: [],
  });
});

test('detects removal of a public utility tag during a WCA-to-CEM migration', () => {
  const manifest = structuredClone(standard);
  manifest.modules.pop();

  expect(diffApi(readManifest(legacy), readManifest(manifest)).removed).toEqual(
    ['<step-group>']
  );
});

test('detects removal of a public attribute during a WCA-to-CEM migration', () => {
  const manifest = structuredClone(standard);
  manifest.modules[0].declarations[0].attributes = [];

  expect(diffApi(readManifest(legacy), readManifest(manifest)).removed).toEqual(
    ['<cds-button disabled>']
  );
});

test.each([
  ['exports without main', { exports: './public.js' }],
  [
    'exports overriding main',
    { main: './legacy.js', exports: { '.': { import: './public.js' } } },
  ],
  ['legacy main', { main: './public.js' }],
])('reads the public JavaScript entry point: %s', (_, entryPoints) => {
  const packageDir = path.join(directory, 'node_modules', '@test', 'api');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify({ name: '@test/api', type: 'module', ...entryPoints })
  );
  fs.writeFileSync(
    path.join(packageDir, 'public.js'),
    'export const PublicComponent = {}; export default {};'
  );
  fs.writeFileSync(
    path.join(packageDir, 'legacy.js'),
    'export const LegacyComponent = {};'
  );

  expect(readApi(packageDir, 'js')).toEqual(['PublicComponent']);
});
