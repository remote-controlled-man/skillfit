import assert from 'node:assert/strict';

export const checksFor = normalize => [
  ['bare path and flag query parameters retain their shape', () => {
    assert.equal(normalize('https://example.com/index.php?/catalog/item'), 'https://example.com/index.php?/catalog/item');
    assert.equal(normalize('https://example.com/?flag'), 'https://example.com/?flag');
  }],
  ['mixed bare parameters preserve explicit empty values', () => {
    assert.equal(normalize('https://example.com/route.php?flag=&/products/item&bare'), 'https://example.com/route.php?/products/item&bare&flag=');
    assert.equal(normalize('https://example.com/?x=&z=2&a=1'), 'https://example.com/?a=1&x=&z=2');
  }],
  ['similar parameter names do not interfere', () => {
    assert.equal(normalize('https://example.com/route.php?flag&longflag&/api&/api/v1'), 'https://example.com/route.php?/api&/api/v1&flag&longflag');
  }],
  ['default sorting and its opt-out remain supported', () => {
    assert.equal(normalize('https://example.com/route.php?z=9&/products/item&a=1'), 'https://example.com/route.php?/products/item&a=1&z=9');
    assert.equal(normalize('https://example.com/route.php?z=9&/products/item&a=1', {sortQueryParameters: false}), 'https://example.com/route.php?z=9&/products/item&a=1');
  }],
  ['ordinary URL normalization and fragments remain intact', () => {
    assert.equal(normalize('HTTPS://WWW.Example.COM:443/a/?utm_source=x&b=2&a=1#section'), 'https://example.com/a?a=1&b=2#section');
  }],
  ['encoded backslashes and Unicode query values remain intact', () => {
    assert.equal(normalize('https://example.com/something%5Celse/great?b=2&a=1'), 'https://example.com/something%5Celse/great?a=1&b=2');
    assert.equal(normalize('https://example.com/x?name=caf%C3%A9&z=2'), 'https://example.com/x?name=caf%C3%A9&z=2');
  }],
];
