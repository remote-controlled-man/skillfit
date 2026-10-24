/** Preserve line numbers while excluding examples from link/heading checks. */
export function withoutFences(markdown) {
  let fence = null;
  return markdown.split('\n').map(line => {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = null;
      return '';
    }
    if (match) { fence = match[1]; return ''; }
    return line;
  }).join('\n');
}

export function markdownFencedBlocks(markdown) {
  const blocks = [];
  let fence = null, lines = [];
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      lines.push(line);
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) {
        blocks.push(lines.join('\n')); fence = null; lines = [];
      }
    } else if (match) { fence = match[1]; lines = [line]; }
  }
  if (fence) blocks.push(lines.join('\n'));
  return blocks;
}

export function markdownAnchors(markdown) {
  const text = withoutFences(markdown), used = new Set(), anchors = new Set();
  for (const tag of text.matchAll(/<(?:a|h[1-6])\b[^>]*>/gi)) {
    for (const match of tag[0].matchAll(/\b(?:id|name)=["']([^"']+)["']/gi)) anchors.add(match[1]);
  }
  for (const match of text.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = match[1].replace(/<[^>]*>/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
    let slug = base, suffix = 0;
    while (used.has(slug)) slug = `${base}-${++suffix}`;
    used.add(slug); anchors.add(slug);
  }
  return anchors;
}

export function markdownLinks(markdown) {
  const text = withoutFences(markdown).replace(/(`+)([^\n]*?)\1/g, match => ' '.repeat(match.length));
  const links = [];
  const patterns = [/\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g, /^ {0,3}\[[^\]]+\]:\s*(?:<([^>\n]+)>|(\S+))/gm];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) {
    links.push({ target: match[1] ?? match[2], line: text.slice(0, match.index).split('\n').length });
  }
  return links;
}
