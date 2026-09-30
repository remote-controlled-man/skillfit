import { loadMcpProbeSpec, probeMcpStdio, renderMcpProbe, type McpProbeResult } from '../mcp/probe.js';

export interface McpCheckOptions {
  specPath: string;
  dryRun?: boolean;
  log?: (message: string) => void;
}

export async function runMcpCheck(options: McpCheckOptions): Promise<McpProbeResult | null> {
  const log = options.log ?? ((message: string) => console.log(message));
  const spec = loadMcpProbeSpec(options.specPath);
  if (options.dryRun) {
    log([
      'MCP check plan (dry run)',
      `Server   : ${spec.name}`,
      `Transport: stdio`,
      `Command  : ${spec.command} (${spec.args.length} argument(s); values withheld)`,
      'Checks   : initialize handshake, capabilities, tools/list, unique names, descriptions, input schemas, annotations',
      'Tool calls: none',
      'Dry run — the server was not started.',
    ].join('\n'));
    return null;
  }
  const result = await probeMcpStdio(spec);
  log(renderMcpProbe(result));
  return result;
}
