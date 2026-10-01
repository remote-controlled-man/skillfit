import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveViewResource } from '../src/resolve-view-resource.ts';
import { RESOURCE_MIME_TYPE } from '../src/ext-apps-bridge.js';

test('UTF-8 base64 HTML preserves Chinese and emoji just like text HTML', () => {
  const html = '<p>中文😀</p>';
  const resolve = (content) => resolveViewResource({
    resourceResult: { contents: [{ mimeType: RESOURCE_MIME_TYPE, ...content }] },
    cspMode: 'permissive',
  });

  const textResult = resolve({ text: html });
  assert.equal(textResult.html, html);

  const blobResult = resolve({ blob: Buffer.from(html, 'utf8').toString('base64') });
  assert.equal(blobResult.html, html);
  assert.deepEqual(blobResult, textResult);
});

test('ASCII base64 HTML still decodes correctly', () => {
  const html = '<p>Hello</p>';
  const result = resolveViewResource({
    resourceResult: { contents: [{
      mimeType: RESOURCE_MIME_TYPE,
      blob: Buffer.from(html, 'utf8').toString('base64'),
    }] },
    cspMode: 'permissive',
  });
  assert.equal(result.html, html);
});

test('text takes precedence over a blob, without decoding the blob', () => {
  const html = '<p>中文😀</p>';
  const result = resolveViewResource({
    resourceResult: { contents: [{
      mimeType: RESOURCE_MIME_TYPE,
      text: html,
      blob: 'invalid base64!',
    }] },
    cspMode: 'permissive',
  });
  assert.equal(result.html, html);
});

test('blob HTML retains metadata precedence and CSP enforcement modes', () => {
  const listingCsp = { connectDomains: ['https://listing.example'] };
  const contentCsp = { resourceDomains: ['https://content.example'] };
  const listingPermissions = { camera: {} };
  const contentPermissions = { clipboardWrite: {} };
  const listingResource = { _meta: { ui: {
    csp: listingCsp,
    permissions: listingPermissions,
    prefersBorder: true,
  } } };
  const blob = Buffer.from('<p>中文😀</p>', 'utf8').toString('base64');

  for (const cspMode of ['strict', 'permissive']) {
    for (const ui of [undefined, { csp: contentCsp, permissions: contentPermissions }]) {
      const result = resolveViewResource({
        resourceResult: { contents: [{ mimeType: RESOURCE_MIME_TYPE, blob, _meta: { ui } }] },
        listingResource,
        cspMode,
      });
      const expectedCsp = ui ? contentCsp : listingCsp;
      assert.equal(result.declaredCsp, expectedCsp);
      assert.equal(result.csp, cspMode === 'permissive' ? undefined : expectedCsp);
      assert.equal(result.permissions, ui ? contentPermissions : listingPermissions);
      assert.equal(result.prefersBorder, true);
    }
  }

  const result = resolveViewResource({
    resourceResult: { contents: [{
      mimeType: RESOURCE_MIME_TYPE,
      blob,
      _meta: { ui: { prefersBorder: false } },
    }] },
    listingResource,
    cspMode: 'strict',
  });
  assert.equal(result.prefersBorder, false);
  assert.equal(result.permissions, listingPermissions);
  assert.equal(result.csp, listingCsp);
});

test('invalid and missing MIME types retain validation warnings for blob HTML', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  for (const mimeType of ['text/html', undefined]) {
    const expectedWarning = mimeType
      ? `Invalid MIME type "${mimeType}" - SEP-1865 requires "${RESOURCE_MIME_TYPE}"`
      : `Missing MIME type - SEP-1865 requires "${RESOURCE_MIME_TYPE}"`;
    const result = resolveViewResource({
      resourceResult: { contents: [{ mimeType, blob: 'PHA+SGVsbG88L3A+' }] },
      cspMode: 'permissive',
      resourceUri: 'ui://test/view.html',
    });
    assert.equal(result.html, '<p>Hello</p>');
    assert.equal(result.mimeType, mimeType);
    assert.equal(result.mimeTypeValid, false);
    assert.equal(result.mimeTypeWarning, expectedWarning);
    assert.deepEqual(warn.mock.calls.at(-1).arguments, [
      '[ViewRenderer] MIME type validation:', expectedWarning,
      { resourceUri: 'ui://test/view.html' },
    ]);
  }
  assert.equal(warn.mock.callCount(), 2);
});

test('missing and empty content still throw, using only the first content block', () => {
  const validBlob = Buffer.from('<p>Hello</p>', 'utf8').toString('base64');
  for (const resourceResult of [
    undefined,
    null,
    {},
    { contents: {} },
    { contents: [] },
    { contents: [{}] },
    { contents: [{ text: '' }] },
    { contents: [{ blob: '' }] },
    { contents: [{ text: '', blob: validBlob }] },
    { contents: [{}, { text: '<p>Hello</p>' }] },
  ]) {
    assert.throws(
      () => resolveViewResource({ resourceResult, cspMode: 'permissive' }),
      { message: 'No HTML content in resource' },
    );
  }
});

test('invalid base64 still throws', () => {
  assert.throws(() => resolveViewResource({
    resourceResult: { contents: [{ mimeType: RESOURCE_MIME_TYPE, blob: 'invalid base64!' }] },
    cspMode: 'permissive',
  }), { name: 'InvalidCharacterError' });
});
