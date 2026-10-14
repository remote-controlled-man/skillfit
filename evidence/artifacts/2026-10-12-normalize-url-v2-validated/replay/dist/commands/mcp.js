import { loadMcpProbeSpec, probeMcp, renderMcpProbe } from '../mcp/probe.js';
export async function runMcpCheck(options) {
    const log = options.log ?? ((message) => console.log(message));
    const spec = loadMcpProbeSpec(options.specPath);
    if (options.dryRun) {
        const target = spec.transport === 'http'
            ? `Endpoint : ${new URL(spec.url).origin}${new URL(spec.url).pathname} (query withheld)`
            : `Command  : ${spec.command} (${spec.args.length} argument(s); values withheld)`;
        log([
            'MCP check plan (dry run)',
            `Server   : ${spec.name}`,
            `Transport: ${spec.transport}`,
            target,
            'Checks   : initialize handshake, capabilities, tools/list, unique names, descriptions, input schemas, annotations',
            'Tool calls: none',
            'Dry run — the server was not contacted.',
        ].join('\n'));
        return null;
    }
    const result = await probeMcp(spec);
    log(renderMcpProbe(result));
    return result;
}
