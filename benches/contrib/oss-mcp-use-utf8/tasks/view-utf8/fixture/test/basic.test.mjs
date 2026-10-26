import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveViewResource } from '../src/resolve-view-resource.ts';
import { RESOURCE_MIME_TYPE } from '../src/ext-apps-bridge.js';

test('uses text content when present', () => {
  const result = resolveViewResource({
    resourceResult: { contents: [{ mimeType: RESOURCE_MIME_TYPE, text: '<p>Hello</p>' }] },
    cspMode: 'permissive',
  });
  assert.equal(result.html, '<p>Hello</p>');
  assert.equal(result.mimeTypeValid, true);
});
