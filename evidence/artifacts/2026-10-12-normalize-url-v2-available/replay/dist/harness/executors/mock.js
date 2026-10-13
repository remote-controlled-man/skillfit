import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOCK_MARKER_FILE } from '../constants.js';
function estimateTokens(prompt, output) {
    return {
        input: Math.ceil(prompt.length / 4),
        output: Math.ceil(output.length / 4),
    };
}
export class MockExecutor {
    markerFile;
    constructor(markerFile = MOCK_MARKER_FILE) {
        this.markerFile = markerFile;
    }
    describe() {
        return { kind: 'mock', model: 'mock', detail: `marker:${this.markerFile}`, sampling: null };
    }
    run(prompt, workdir) {
        const marker = this.readMarker(workdir);
        const condition = prompt.includes('<skill name=') ? 'treatment' : 'baseline';
        const behavior = condition === 'treatment' ? marker.treatment : marker.baseline;
        const output = behavior?.output ?? '';
        return Promise.resolve({
            output,
            tokens: behavior?.tokens ?? estimateTokens(prompt, output),
        });
    }
    readMarker(workdir) {
        const path = join(workdir, this.markerFile);
        if (!existsSync(path))
            return {};
        return JSON.parse(readFileSync(path, 'utf8'));
    }
}
