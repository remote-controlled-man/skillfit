import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLI_OPTIONS, USAGE } from '../../dist/cli/definition.js';

const START = '<!-- cli-reference:start -->', END = '<!-- cli-reference:end -->';
// Documentation selects useful rows; facts come only from help + parser declarations.
const SELECTED = ['agent', 'mode', 'baseline-skill', 'request', 'plan-sha', 'json',
  'bench', 'task', 'trials', 'max-calls', 'pair-order', 'executor-timeout-seconds',
  'spending-budget', 'runs-root', 'run-group', 'input', 'replay', 'export'];

export function cliReference(usage = USAGE, options = CLI_OPTIONS) {
  const section = usage.split('\nOptions:\n');
  if (section.length !== 2) throw Error('Help must contain one general Options section.');
  const lines = section[1].split(/\n(?=\S)/)[0].split('\n'), rows = [];
  for (const name of SELECTED) {
    if (!Object.hasOwn(options, name)) throw Error(`Documented option is not declared: --${name}`);
    const matches = lines.flatMap((line, i) => line.startsWith(`  --${name} `) ? [i] : []);
    if (matches.length !== 1) throw Error(`Help must describe --${name} exactly once.`);
    let i = matches[0];
    const match = /^\s+(--\S+(?: <[^>]+>)?)\s{2,}(.+)$/.exec(lines[i]);
    if (!match) throw Error(`Cannot derive help row for --${name}.`);
    let description = match[2];
    while (/^ {4,}\S/.test(lines[i + 1] ?? '')) description += ` ${lines[++i].trim()}`;
    const escape = value => value.replaceAll('|', '\\|');
    rows.push(`| \`${escape(match[1])}\` | ${escape(description)} |`);
  }
  return `${START}\n| CLI option | Help description |\n| --- | --- |\n${rows.join('\n')}\n${END}`;
}

export function withCliReference(text) {
  const start = text.indexOf(START), end = text.indexOf(END);
  if (start < 0 || end < start || start !== text.lastIndexOf(START) || end !== text.lastIndexOf(END)) throw Error('Keep exactly one ordered CLI reference marker pair.');
  return text.slice(0, start) + cliReference() + text.slice(end + END.length);
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--write' && args[0] !== '--check')) throw Error('Use node tools/verify/cli-reference.mjs [--check|--write] after building.');
  const path = new URL('../../docs/reference/eval-component.md', import.meta.url), text = readFileSync(path, 'utf8'), expected = withCliReference(text);
  if (args[0] === '--write') writeFileSync(path, expected);
  else if (text !== expected) throw Error('CLI reference drift: build, then run node tools/verify/cli-reference.mjs --write.');
  console.log('CLI reference: help/parser declarations match the generated documentation.');
}
