import { PACKAGE_ROOT, RUNTIME_ROOT } from '../../shared/package-root.js';

import { join } from 'node:path';
import { assertOutputPaths } from '../../shared/output-path.js';
export { physicalPath } from '../../shared/output-path.js';
export function assertEvaluationOutputLayout(output: string, inputs: { benchDir: string; targetDirs?: readonly string[] }): void {
 const packageRoot = PACKAGE_ROOT;
 assertOutputPaths(output, ['docs', 'evidence', 'src', 'tools', 'profiles', 'skills', 'benches', '.github'].map(tree => join(packageRoot, tree)),
 'Experiment output must be outside Git metadata; choose a separate --runs-root.',
 'Experiment output must be outside maintained project trees; use an explicit run workspace.');
 assertOutputPaths(output, [inputs.benchDir, ...(inputs.targetDirs ?? []), RUNTIME_ROOT],
 'Experiment output must be outside Git metadata; choose a separate --runs-root.',
 'Experiment output must be outside the bench, Skill/overlay and compiled runtime inputs; choose a sibling --runs-root before previewing or running.');
}
