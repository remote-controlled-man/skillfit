import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOCK_MARKER_FILE } from '../constants.js';
import type { Executor, ExecutorDescriptor, ExecutorResult, TokenUsage } from '../types.js';

interface MockBehavior {
  output?: string;
  tokens?: TokenUsage;
}

interface MockMarker {
  baseline?: MockBehavior;
  treatment?: MockBehavior;
}

function estimateTokens(prompt: string, output: string): TokenUsage {
  return {
    input: Math.ceil(prompt.length / 4),
    output: Math.ceil(output.length / 4),
  };
}

export class MockExecutor implements Executor {
  constructor(private readonly markerFile: string = MOCK_MARKER_FILE) {}

  describe(): ExecutorDescriptor {
    return { kind: 'mock', model: 'mock', detail: `marker:${this.markerFile}` };
  }

  run(prompt: string, workdir: string): Promise<ExecutorResult> {
    const marker = this.readMarker(workdir);
    const condition = prompt.includes('<skill name=') ? 'treatment' : 'baseline';
    const behavior = condition === 'treatment' ? marker.treatment : marker.baseline;
    const output = behavior?.output ?? '';
    return Promise.resolve({
      output,
      tokens: behavior?.tokens ?? estimateTokens(prompt, output),
    });
  }

  private readMarker(workdir: string): MockMarker {
    const path = join(workdir, this.markerFile);
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, 'utf8')) as MockMarker;
  }
}
