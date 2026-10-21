import assert from 'node:assert/strict';
import test from 'node:test';
import { assertUnused, validateRelease, waitForPublished, retryRegistryInstall } from './npm-release.mjs';

const version = '0.9.1', integrity = 'sha512-reviewed';
const pkg = { name: 'skillfit', version, repository: { url: 'git+https://github.com/remote-controlled-man/skillfit.git' } };
const lock = { version, packages: { '': { version } } };
const pack = { name: 'skillfit', version, files: [{ path: 'package.json' }] };
const ok = () => ({ status: 200, body: { version, dist: { integrity } } });
const missing = () => ({ status: 404, body: null });
const expected = { version, integrity };

test('release requires matching package, lock and inspected archive', () => {
  validateRelease(pkg, lock, pack);
  assert.throws(() => validateRelease(pkg, { ...lock, version: '0.8.0' }, pack));
  assert.throws(() => validateRelease(pkg, { ...lock, packages: { '': { version: '0.8.0' } } }, pack));
  assert.throws(() => validateRelease(pkg, lock, { ...pack, version: '0.8.0' }));
  assert.throws(() => validateRelease(pkg, lock, { ...pack, files: [] }));
});
test('release rejects runtime dependencies, forks and prereleases tagged latest', () => {
  assert.throws(() => validateRelease({ ...pkg, dependencies: { extra: '1' } }, lock, pack));
  assert.throws(() => validateRelease({ ...pkg, repository: { url: 'git+https://github.com/other/skillfit.git' } }, lock, pack));
  assert.throws(() => validateRelease({ ...pkg, version: '0.9.1-beta' }, lock, pack));
});
test('only an explicit missing version permits publication', () => {
  assertUnused(404);
  for (const status of [200, 401, 403, 429, 500, undefined]) assert.throws(() => assertUnused(status));
});
test('pending scans and old latest remain pending until exact metadata matches', async () => {
  let time = 0, calls = 0;
  const result = await waitForPublished(expected, {
    now: () => time, sleep: async ms => { time += ms; }, intervalMs: 1, timeoutMs: 10,
    lookup: async () => {
      calls++;
      if (calls === 1) return { version: missing(), latest: missing() };
      if (calls === 2) return { version: ok(), latest: { status: 200, body: { version: '0.8.0' } } };
      return { version: ok(), latest: ok() };
    },
  });
  assert.equal(result.attempts.length, 3);
});
test('registry integrity mismatch never becomes a successful receipt', async () => {
  await assert.rejects(waitForPublished(expected, {
    lookup: async () => ({ version: { status: 200, body: { version, dist: { integrity: 'sha512-other' } } }, latest: ok() }),
  }), /integrity differs/);
});
test('a mismatched latest archive fails even when the version archive matches', async () => {
  await assert.rejects(waitForPublished(expected, {
    lookup: async () => ({ version: ok(), latest: { status: 200, body: { version, dist: { integrity: 'sha512-other' } } } }),
  }), /Latest archive integrity differs/);
});
test('registry availability timeout fails with no install or publication', async () => {
  let time = 0;
  const retained = [];
  await assert.rejects(waitForPublished(expected, {
    now: () => time, sleep: async ms => { time += ms; }, intervalMs: 1, timeoutMs: 2,
    lookup: async () => ({ version: missing(), latest: missing() }),
    onAttempt: attempt => retained.push(attempt),
  }), /deadline exceeded/);
  assert.equal(retained.length, 3);
  assert.ok(retained.every(attempt => attempt.versionStatus === 404));
});
test('authentication errors and network failures cannot be treated as pending success', async () => {
  await assert.rejects(waitForPublished(expected, {
    lookup: async () => ({ version: { status: 401 }, latest: missing() }),
  }), /Unexpected registry response/);
  await assert.rejects(waitForPublished(expected, { lookup: async () => { throw new Error('network failed'); } }), /network failed/);
});

test('metadata visibility followed by npm ETARGET retries installation only, with retained observations', async () => {
  let time = 0, calls = 0; const observations = [];
  const result = await retryRegistryInstall(() => {
    if (++calls === 1) throw Object.assign(Error('pending'), { stderr: 'npm error code ETARGET' });
    return 'new-isolated-prefix';
  }, { deadline: 100_000, now: () => time, sleep: async ms => { time += ms; }, onAttempt: row => observations.push(row) });
  assert.equal(calls, 2); assert.equal(result.installed, 'new-isolated-prefix');
  assert.deepEqual(observations.map(row => row.status), ['failed', 'passed']);
  assert.equal(observations[0].code, 'ETARGET');
});
test('install auth/integrity errors never retry and pending installs share a bounded deadline', async () => {
  for (const code of ['E401', 'EINTEGRITY']) {
    let calls = 0;
    await assert.rejects(retryRegistryInstall(() => { calls++; throw Object.assign(Error(code), { stderr: `npm error code ${code}` }); }, { deadline: 100, now: () => 0 }));
    assert.equal(calls, 1);
  }
  let time = 0, calls = 0;
  await assert.rejects(retryRegistryInstall(() => { calls++; throw Object.assign(Error('pending'), { stderr: 'npm error code ETARGET' }); },
    { deadline: 10, now: () => time, sleep: async ms => { time += ms; } }), /deadline exceeded/);
  assert.equal(calls, 1);
});
