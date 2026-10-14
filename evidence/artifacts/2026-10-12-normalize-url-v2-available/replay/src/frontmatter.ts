/**
 * Minimal YAML frontmatter reader for SKILL.md files.
 *
 * There is deliberately no YAML dependency (AGENTS.md: zero runtime dependencies), so this handles
 * the subset agent skill files actually use — `key: value` pairs, quoted scalars, and `>` / `|` block
 * scalars including their chomping indicators. It is not a YAML parser and does not claim to be one.
 *
 * This module exists because `doctor` and `install` each grew their own copy and the two drifted:
 * install's did not strip a BOM, did not tolerate spaces after the `---` fence, did not unquote
 * values, and stored the literal `>` for a folded description. The same SKILL.md could pass `doctor`
 * and be rejected by `install`. Neither handled `>-`, so a folded description was stored as the two
 * characters `>-` and still counted as present. One implementation, one behaviour.
 */

const BLOCK_SCALAR = /^([>|])[+-]?\d*$/;

function unquote(value: string): string {
  const match = /^(['"])([\s\S]*)\1$/.exec(value);
  return match?.[2] ?? value;
}

export function parseFrontmatter(content: string): Record<string, string> | null {
  const text = content.replace(/^\uFEFF/, '');
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match || match[1] === undefined) return null;
  const fields: Record<string, string> = {};
  let blockKey: string | null = null;
  let blockIsLiteral = false;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):(?:[ \t]+(.*))?$/.exec(line);
    if (kv && kv[1] !== undefined) {
      const raw = (kv[2] ?? '').trim();
      const block = BLOCK_SCALAR.exec(raw);
      if (block) {
        fields[kv[1]] = '';
        blockKey = kv[1];
        // `|` keeps line breaks; `>` folds them into spaces.
        blockIsLiteral = block[1] === '|';
      } else {
        fields[kv[1]] = unquote(raw);
        blockKey = null;
      }
      continue;
    }
    if (blockKey !== null && /^\s+\S/.test(line)) {
      const prior = fields[blockKey] ?? '';
      const piece = line.trim();
      fields[blockKey] = prior === '' ? piece : `${prior}${blockIsLiteral ? '\n' : ' '}${piece}`;
      continue;
    }
    blockKey = null;
  }
  return fields;
}
