import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { resolveViewResource } from '../src/resolve-view-resource.ts';
import { RESOURCE_MIME_TYPE } from '../src/ext-apps-bridge.js';

const asBlob = (html) => Buffer.from(html, 'utf8').toString('base64');
const resolve = (content, options = {}) => resolveViewResource({
  resourceResult: { contents: [content] },
  cspMode: 'strict',
  ...options,
});

test('decodes UTF-8 base64 HTML exactly like text, including Chinese and emoji', () => {
  const html = '<!doctype html><meta charset="utf-8"><p>你好，世界！😀 🚀 café e\u0301</p>';
  const textResult = resolve({ mimeType: RESOURCE_MIME_TYPE, text: html });
  const blobResult = resolve({ mimeType: RESOURCE_MIME_TYPE, blob: asBlob(html) });

  assert.equal(textResult.html, html);
  assert.equal(blobResult.html, html);
  assert.deepEqual(blobResult, textResult);
});

test('preserves ASCII blobs and gives text precedence over blobs', () => {
  const html = '<p>Hello</p>';
  assert.equal(resolve({ blob: asBlob(html), mimeType: RESOURCE_MIME_TYPE }).html, html);
  assert.equal(resolve({ text: html, blob: 'invalid base64!', mimeType: RESOURCE_MIME_TYPE }).html, html);
});

test('preserves listing and content metadata in strict and permissive modes', () => {
  const listingCsp = { connectDomains: ['https://listing.example'] };
  const contentCsp = { resourceDomains: ['https://content.example'] };
  const listingPermissions = { microphone: {} };
  const contentPermissions = { camera: {} };
  const listingResource = { _meta: { ui: {
    csp: listingCsp, permissions: listingPermissions, prefersBorder: true,
  } } };

  for (const payload of [{ text: '<p>你好 😀</p>' }, { blob: asBlob('<p>你好 😀</p>') }]) {
    const content = { ...payload, mimeType: RESOURCE_MIME_TYPE };
    const inherited = resolve(content, { listingResource });
    assert.deepEqual(inherited.declaredCsp, listingCsp);
    assert.deepEqual(inherited.csp, listingCsp);
    assert.deepEqual(inherited.permissions, listingPermissions);
    assert.equal(inherited.prefersBorder, true);

    content._meta = { ui: { csp: contentCsp, permissions: contentPermissions, prefersBorder: false } };
    for (const cspMode of ['strict', 'permissive']) {
      const result = resolve(content, { listingResource, cspMode });
      assert.deepEqual(result.declaredCsp, contentCsp);
      assert.deepEqual(result.csp, cspMode === 'permissive' ? undefined : contentCsp);
      assert.deepEqual(result.permissions, contentPermissions);
      assert.equal(result.prefersBorder, false);
    }
  }
});

test('preserves MIME validation and warnings for text and blobs', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const resourceUri = 'ui://test/view';

  for (const payload of [{ text: '<p>Hello</p>' }, { blob: asBlob('<p>Hello</p>') }]) {
    for (const mimeType of [RESOURCE_MIME_TYPE, 'text/html', undefined]) {
      const callCount = warning.mock.callCount();
      const result = resolve({ ...payload, mimeType }, { resourceUri });
      const expectedWarning = mimeType === RESOURCE_MIME_TYPE
        ? null
        : mimeType
          ? `Invalid MIME type "${mimeType}" - SEP-1865 requires "${RESOURCE_MIME_TYPE}"`
          : `Missing MIME type - SEP-1865 requires "${RESOURCE_MIME_TYPE}"`;

      assert.equal(result.mimeType, mimeType);
      assert.equal(result.mimeTypeValid, mimeType === RESOURCE_MIME_TYPE);
      assert.equal(result.mimeTypeWarning, expectedWarning);
      assert.equal(warning.mock.callCount(), callCount + (expectedWarning ? 1 : 0));
      if (expectedWarning) {
        assert.deepEqual(warning.mock.calls.at(-1).arguments, [
          '[ViewRenderer] MIME type validation:', expectedWarning, { resourceUri },
        ]);
      }
    }
  }
});

test('preserves missing-content errors, including empty text precedence and first-block selection', () => {
  for (const resourceResult of [
    null,
    {},
    { contents: {} },
    { contents: [] },
    { contents: [{}] },
    { contents: [{ text: '' }] },
    { contents: [{ blob: '' }] },
    { contents: [{ text: '', blob: asBlob('<p>Hello</p>') }] },
    { contents: [{}, { text: '<p>Hello</p>' }] },
  ]) {
    assert.throws(
      () => resolveViewResource({ resourceResult, cspMode: 'strict' }),
      { message: 'No HTML content in resource' },
    );
  }
});
