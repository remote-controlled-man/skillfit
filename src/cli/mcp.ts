import { homedir } from "node:os";
import {
  loadMcpProbeSpec,
  probeMcp,
  renderMcpProbe,
  selectAgentMcpProbe,
  type McpProbeResult,
} from "../agents/mcp-probe.js";

export interface McpCheckOptions {
  specPath?: string;
  agent?: string;
  server?: string;
  project?: boolean;
  homeDir?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  dryRun?: boolean;
  log?: (message: string) => void;
}

export async function runMcpCheck(options: McpCheckOptions): Promise<McpProbeResult | null> {
  const log = options.log ?? ((message: string) => console.log(message));
  if (options.specPath !== undefined && options.server !== undefined)
    throw new Error("Choose either an MCP probe spec path or --server selection, not both.");
  if (options.specPath === undefined && (!options.agent || !options.server))
    throw new Error("Real-config MCP checks require both --agent and --server.");
  const selected =
    options.specPath === undefined
      ? selectAgentMcpProbe({
          agent: options.agent!,
          server: options.server!,
          project: options.project ?? false,
          homeDir: options.homeDir ?? homedir(),
          cwd: options.cwd ?? process.cwd(),
          env: options.env ?? process.env,
        })
      : null;
  const spec = selected?.spec ?? loadMcpProbeSpec(options.specPath!);
  if (options.dryRun) {
    const target =
      spec.transport === "http"
        ? `Endpoint : ${new URL(spec.url).origin}${new URL(spec.url).pathname} (query withheld)`
        : `Command  : ${spec.command} (${spec.args.length} argument(s); values withheld)`;
    const lines = [
      "MCP check plan (dry run)",
      `Server   : ${spec.name}`,
      `Transport: ${spec.transport}`,
      target,
    ];
    if (selected) lines.push(`Source   : ${selected.sourcePath}`, `Scope    : ${selected.scope}`);
    lines.push(
      "Checks   : initialize handshake, capabilities, tools/list, unique names, descriptions, input schemas, annotations",
      "Tool calls: none",
      "Dry run — the server was not contacted.",
    );
    log(lines.join("\n"));
    return null;
  }
  const result = await probeMcp(spec);
  log(renderMcpProbe(result));
  return result;
}
