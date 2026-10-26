import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveViewResource } from '../src/resolve-view-resource.ts';
import { RESOURCE_MIME_TYPE } from '../src/ext-apps-bridge.js';

test('base64 HTML is decoded as UTF-8', () => {
  const html = '<p>你好 🌍</p>';
  const blob = Buffer.from(html, 'utf8').toString('base64');
  const result = resolveViewResource({
    resourceResult: { contents: [{ mimeType: RESOURCE_MIME_TYPE, blob }] },
    cspMode: 'strict',
  });
  assert.equal(result.html, html);
});
