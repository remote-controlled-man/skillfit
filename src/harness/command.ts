/** Tokenize a shell-free command. Quotes group arguments; no expansions run. */
export function parseCommand(command: string): string[] {
  const args: string[] = [];
  let word = '', started = false, quote: "'" | '"' | null = null;
  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;
    if (char === '\0') throw new Error('Command contains a NUL character.');
    if (quote === "'") {
      if (char === quote) quote = null;
      else word += char;
    } else if (char === '\\' && i + 1 < command.length &&
      (command[i + 1] === quote || (!quote && /[\s'"]/.test(command[i + 1]!)))) {
      word += command[++i]; started = true;
    } else if (quote === '"') {
      if (char === quote) quote = null;
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char; started = true;
    } else if (/\s/.test(char)) {
      if (started) { args.push(word); word = ''; started = false; }
    } else { word += char; started = true; }
  }
  if (quote) throw new Error('Command has an unterminated quote.');
  if (started) args.push(word);
  if (!args[0]) throw new Error('Command requires a non-empty executable.');
  return args;
}
