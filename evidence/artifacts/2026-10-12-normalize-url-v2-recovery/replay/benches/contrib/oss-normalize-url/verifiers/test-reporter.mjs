import { isAbsolute, relative, sep } from 'node:path';

// Node delivers start/pass/fail in declaration order. Child stdout is a separate event and ignored.
export default async function* report(source) {
  const frames = []; const records = []; let summary = null;
  for await (const event of source) {
    const data = event.data;
    if (event.type === 'test:start') {
      if (!Number.isInteger(data.nesting) || data.nesting < 0) continue;
      if (data.nesting > 0 && frames[data.nesting - 1]) frames[data.nesting - 1].hasChildren = true;
      frames.length = data.nesting;
      frames.push({ name: data.name, hasChildren: false });
    } else if (event.type === 'test:pass' || event.type === 'test:fail') {
      const frame = frames[data.nesting];
      const file = typeof data.file === 'string' ? relative(process.cwd(), data.file).split(sep).join('/') : null;
      // A process that exits without declaring tests gets a synthetic root named after its file.
      const fileWrapper = data.nesting === 0 && (data.name === data.file || data.name === file);
      const registered = !fileWrapper && file !== null && file !== '..' && !file.startsWith('../') && !isAbsolute(file) &&
        Number.isInteger(data.line) && data.line > 0 && frame?.name === data.name &&
        frames.slice(0, data.nesting).every(parent => typeof parent.name === 'string');
      records.push({ file, path: [...frames.slice(0, data.nesting).map(parent => parent.name), data.name],
        // Node 22 omits details.type for ordinary tests; explicit suites still carry 'suite'.
        registered, leaf: data.details?.type !== 'suite' && !frame?.hasChildren,
        pass: event.type === 'test:pass', skip: !!data.skip, todo: !!data.todo,
        failureType: data.details?.error?.failureType ?? null });
    } else if (event.type === 'test:summary' && data.file === undefined) summary = data;
  }
  yield JSON.stringify({ schemaVersion: 1, kind: 'node-test-evidence', summary, records }) + '\n';
}
