import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TriggerObserver, observesSkillRead, triggerDetection, parseTriggerDetection, parseTriggerEvidence, type StreamWireShape } from './trigger-detection.js';

const terminal = { type: 'result', subtype: 'success', is_error: false };
function observe(shape: StreamWireShape | undefined, events: Record<string, unknown>[], succeeded = true, extra = {}) {
  const observer = new TriggerObserver({ wireShape: shape, toolName: 'Skill', skillKey: 'skill', identities: ['review'],
    skillPaths: ['.agents/skills/review/SKILL.md'], workdir: '/repo', ...extra });
  const header = shape === 'content-blocks' ? [{ type: 'system', subtype: 'init' }] : shape === 'codex-items' ? [{ type: 'thread.started' }] : [];
  [...header, ...events].forEach((event, i) => observer.event(event, i + 1));
  return observer.finish(succeeded);
}
function claude(input: unknown) { return { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input }] } }; }
function kimi(args: unknown) { return { role: 'assistant', tool_calls: [{ function: { name: 'Skill', arguments: args } }] }; }

test('Skill identity uses the exact designated argument, including JSON-encoded strings', () => {
  for (const shape of ['content-blocks', 'flat-tool-call'] as const) {
    for (const input of [{ skill: 'review' }, JSON.stringify({ skill: 'review' })]) {
      const result = observe(shape, shape === 'content-blocks' ? [claude(input), terminal] : [kimi(input), { role: 'assistant', content: 'done' }]);
      assert.deepEqual(result, { status: 'observed', complete: true, matchedIdentity: 'review', eventLines: [shape === 'content-blocks' ? 2 : 1] });
    }
    for (const input of [{ skill: 'review-extra' }, { skill: 'other', args: 'review' }, { skill: 'my-review' }, { skill: 'plugin:review' }]) {
      const events = shape === 'content-blocks' ? [claude(input), terminal] : [kimi(JSON.stringify(input)), { role: 'assistant', content: 'done' }];
      assert.equal(observe(shape, events).status, 'not-observed');
    }
  }
});

test('Only explicitly registered aliases and namespaced identities can match', () => {
  assert.equal(observe('content-blocks', [claude({ skill: 'plugin:review' }), terminal], true, { identities: ['review', 'plugin:review'] }).status, 'observed');
  assert.equal(observe('content-blocks', [claude({ skill: 'other:review' }), terminal], true, { identities: ['review', 'plugin:review'] }).status, 'not-observed');
  assert.equal(observe('content-blocks', [claude({ id: 'review', skill: 'other' }), terminal], true, { skillKey: 'id' }).status, 'observed');
});

test('Malformed Skill identities are unknown rather than negative even after a normal terminal', () => {
  for (const input of [null, [], {}, { args: 'review' }, { skill: 3 }, '{broken', '"review"']) {
    assert.equal(observe('content-blocks', [claude(input), terminal]).status, 'unknown');
    assert.equal(observe('flat-tool-call', [kimi(input), { role: 'assistant', content: 'done' }]).status, 'unknown');
  }
});

test('Negative observations require a recognizable format, a normal terminal and successful process', () => {
  for (const shape of ['content-blocks', 'codex-items', 'flat-tool-call'] as const) {
    assert.equal(observe(shape, [{ anything: true }]).status, 'unknown');
  }
  assert.equal(observe(undefined, [{ type: 'assistant', message: { content: [{ type: 'text', text: 'done' }] } }]).status, 'unknown');
  assert.equal(observe(undefined, [terminal]).status, 'unknown');
  assert.equal(observe(undefined, [{ type: 'system', subtype: 'init' }, terminal]).status, 'not-observed');
  assert.equal(observe(undefined, [{ type: 'turn.completed' }]).status, 'unknown');
  assert.equal(observe('content-blocks', [terminal], false).status, 'unknown');
  assert.equal(observe('content-blocks', [{ type: 'result', is_error: true }]).status, 'unknown');
  assert.equal(observe('flat-tool-call', [kimi({ skill: 'other' }), { role: 'tool', content: 'done' }]).status, 'unknown');
  assert.equal(observe('codex-items', [{ type: 'turn.completed' }, { type: 'turn.started' }]).status, 'unknown');
  assert.equal(observe('content-blocks', [terminal, { role: 'assistant', content: 'different format' }]).status, 'unknown');
  assert.equal(observe('content-blocks', [terminal, { type: 'stream_event' }]).status, 'unknown');
  assert.equal(observe('flat-tool-call', [{ role: 'assistant', content: 'cut short', finish_reason: 'length' }]).status, 'unknown');
});

test('Positive observations survive truncation or failure without claiming complete coverage', () => {
  for (const succeeded of [true, false]) {
    const result = observe('content-blocks', [claude({ skill: 'review' })], succeeded);
    assert.deepEqual(result, { status: 'observed', complete: false, matchedIdentity: 'review', eventLines: [2] });
  }
});

test('Codex read observations accept literal registered paths, quotes and supported shell wrappers', () => {
  const paths = ['.agents/skills/review/SKILL.md'];
  for (const command of ['cat .agents/skills/review/SKILL.md', "sed -n '1,200p' /repo/.agents/skills/review/SKILL.md", "bash -lc 'cat ./.agents/skills/review/SKILL.md'"])
    assert.ok(observesSkillRead(command, paths, '/repo'));
  assert.ok(observesSkillRead('powershell -Command "Get-Content -Raw \'C:\\repo\\.agents\\skills\\review\\SKILL.md\'"', ['C:/repo/.agents/skills/review/SKILL.md'], '/repo'));
  assert.ok(observesSkillRead("cat '/repo with spaces/.agents/skills/review/SKILL.md'", paths, '/repo with spaces'));
  assert.ok(observesSkillRead("cat /repo\\ with\\ spaces/.agents/skills/review/SKILL.md", paths, '/repo with spaces'));
  assert.ok(observesSkillRead('powershell -Command "type .agents/skills/review/SKILL.md"', paths, '/repo'));
  assert.equal(observesSkillRead("bash -lc 'type .agents/skills/review/SKILL.md'", paths, '/repo'), false);
});

test('Codex path mentions, searches, different directories and suffix collisions are not reads of this Skill', () => {
  for (const command of ["echo '.agents/skills/review/SKILL.md'", "printf '%s' '.agents/skills/review/SKILL.md'", '# cat .agents/skills/review/SKILL.md',
    'rg review .agents/skills/review/SKILL.md', 'cat /other/.agents/skills/review/SKILL.md', 'cat .agents/skills/review-extra/SKILL.md', 'cat src/skills/review/SKILL.md', 'cat README.md']) {
    assert.equal(observesSkillRead(command, ['.agents/skills/review/SKILL.md'], '/repo'), false, command);
  }
});

test('Shell expressions and unsupported reads stay unknown instead of being evaluated', () => {
  for (const command of ['cat "$SKILL/SKILL.md"', 'echo x; cat .agents/skills/review/SKILL.md', 'cat .agents/skills/*/SKILL.md',
    'python -c "open(\'.agents/skills/review/SKILL.md\').read()"', 'cat < .agents/skills/review/SKILL.md', 'cat "unterminated',
    'cat README.md # .agents/skills/review/SKILL.md', 'cat ~/../.agents/skills/review/SKILL.md',
    'cat %OTHER%/../.agents/skills/review/SKILL.md', 'cat link/../.agents/skills/review/SKILL.md'])
    assert.equal(observesSkillRead(command, ['.agents/skills/review/SKILL.md'], '/repo'), null, command);
  if (process.platform !== 'win32') assert.equal(observesSkillRead('cat .agents\\skills\\review\\SKILL.md', ['.agents/skills/review/SKILL.md'], '/repo'), null);
});

test('Windows absolute short-name paths are literal reads, while home expansion remains unknown', () => {
  const root = 'C:/Users/RUNNER~1/AppData/Local/Temp/work';
  const path = `${root}/.agents/skills/review/SKILL.md`;
  const command = `powershell -Command "Get-Content -LiteralPath '${path}'"`;
  assert.equal(observesSkillRead(command, ['.agents/skills/review/SKILL.md'], root), path);
  assert.equal(observesSkillRead(command, ['.agents/skills/review/SKILL.md'], `${root}-other`), false);
  assert.equal(observesSkillRead("powershell -Command \"Get-Content '~/.agents/skills/review/SKILL.md'\"", ['.agents/skills/review/SKILL.md'], root), null);
});

test('Registered reads resolve the disposable workdir alias without accepting a different directory', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-trigger-path-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const actual = join(root, 'actual'), alias = join(root, 'alias'); mkdirSync(actual); symlinkSync(actual, alias, 'junction');
  const path = `${realpathSync(actual).replaceAll('\\', '/')}/.agents/skills/review/SKILL.md`;
  assert.ok(observesSkillRead(`cat '${path}'`, ['.agents/skills/review/SKILL.md'], alias));
  assert.equal(observesSkillRead(`cat '${path}'`, ['.agents/skills/review/SKILL.md'], join(root, 'different')), false);
});

test('Versioned observation metadata and evidence reject contradictory or unsupported declarations', () => {
  const detection = triggerDetection('content-blocks', ['review']);
  assert.deepEqual(parseTriggerDetection(detection), detection);
  assert.equal(parseTriggerDetection(undefined), null);
  assert.throws(() => parseTriggerDetection({ ...detection, schemaVersion: 3 }), /Unsupported/);
  assert.throws(() => parseTriggerDetection({ ...detection, method: 'skill-file-read-command' }), /method/);
  assert.throws(() => parseTriggerEvidence({ status: 'not-observed', complete: false, matchedIdentity: null, eventLines: [] }, detection), /contradicts/);
  assert.throws(() => parseTriggerEvidence({ status: 'observed', complete: true, matchedIdentity: 'review-extra', eventLines: [1] }, detection), /contradicts/);
  assert.throws(() => parseTriggerEvidence({ status: 'observed', complete: true, matchedIdentity: 'review', eventLines: [2, 1] }, detection), /Invalid/);
});
