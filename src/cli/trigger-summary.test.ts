import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTriggerSummary } from './trigger-summary.js';
import type { TriggerManifest } from '../evaluation/execution/activation.js';

const manifest: TriggerManifest = {
  "schemaVersion": 1,
  "mode": "trigger",
  "runGroup": "example",
  "createdAt": "2026-10-25T00:00:00.000Z",
  "skill": {
    "name": "example",
    "sourceDir": "/example",
    "bundleSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "files": [
      "SKILL.md"
    ],
    "installedSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "installedFiles": [
      "SKILL.md",
      "asset.txt"
    ]
  },
  "bench": {
    "name": "known-trigger",
    "dir": "/bench",
    "contentSha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "taskCount": 1
  },
  "executor": {
    "kind": "cli",
    "model": "offline",
    "detail": "fixture"
  },
  "trials": 3,
  "skillInstallDir": ".agents/skills",
  "competition": {
    "mode": "installed",
    "skills": [
      {
        "name": "other",
        "sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
      }
    ]
  },
  "detection": "skill-read",
  "tasks": [
    {
      "id": "one",
      "shouldTrigger": true,
      "triggerClass": "explicit",
      "runs": 1,
      "fired": 1,
      "unknown": 1,
      "errors": 1,
      "passes": 1,
      "tokens": {
        "input": 5,
        "output": 2
      }
    }
  ],
  "metrics": {
    "recall": 1,
    "recallCi95": {
      "lo": 0.2,
      "hi": 1
    },
    "falseTriggerRate": null,
    "falseTriggerRateCi95": null,
    "precision": 1,
    "precisionCi95": {
      "lo": 0.2,
      "hi": 1
    },
    "f1": 1,
    "positives": {
      "fired": 1,
      "runs": 1
    },
    "negatives": {
      "fired": 0,
      "runs": 0
    },
    "classRecall": {
      "explicit": {
        "fired": 1,
        "runs": 1,
        "recall": 1,
        "recallCi95": {
          "lo": 0.2,
          "hi": 1
        }
      }
    },
    "tokens": {
      "input": 5,
      "output": 2
    }
  },
  "warnings": [
    "Unknown and failed trials remain in the table."
  ]
};

// Expected bytes captured from the previously accepted installed package, before the move.
test('trigger presentation preserves accepted text for current and legacy manifests', () => {
  assert.equal(renderTriggerSummary(manifest, 'manifest.json'), "Skill    : example (injectable bundle sha256 aaaaaaaaaaaa…, 1 injectable files)\nInstalled: sha256 bbbbbbbbbbbb…, 2 files (before execution)\nBench    : known-trigger (1 task(s), content sha256 cccccccccccc…)\nExecutor : cli (offline) — fixture\nMode     : trigger — skill installed into .agents/skills, not injected into the prompt\nCompete  : 1 other user Skill(s): other\nDetect   : SKILL.md read, not a Skill-invocation event\nProtocol : legacy/unversioned detection; saved observations are not reinterpreted\nTrials   : 3 per task\n\nTASK     FIRE?  FIRED    UNKNOWN  ERRORS  PASS\none      yes    1/3      1        1       1/3\n\nTrigger recall      : 1/1 (100%) [95% CI 20%–100%]\n  explicit          : 1/1 (100%) [95% CI 20%–100%]\nFalse-trigger rate  : n/a (no runs)\nPrecision           : 1/1 (100%) [95% CI 20%–100%]\nF1                  : 1.00 (no CI: a harmonic mean of two proportions has no closed-form binomial interval)\n\nTokens used (per task):\n- one: input 5, output 2\n- total: input 5, output 2\n\nWarnings:\n- Unknown and failed trials remain in the table.\n\nManifest: manifest.json");
  const legacy = { ...manifest, skill: { name: 'example', sourceDir: '/example', bundleSha256: 'a'.repeat(64), files: ['SKILL.md'] }, competition: undefined };
  assert.equal(renderTriggerSummary(legacy, 'manifest.json'), "Skill    : example (injectable bundle sha256 aaaaaaaaaaaa…, 1 injectable files)\nInstalled: not recorded (legacy manifest; injectable hash does not identify all installed resources)\nBench    : known-trigger (1 task(s), content sha256 cccccccccccc…)\nExecutor : cli (offline) — fixture\nMode     : trigger — skill installed into .agents/skills, not injected into the prompt\nCompete  : alone (recall is an upper bound)\nDetect   : SKILL.md read, not a Skill-invocation event\nProtocol : legacy/unversioned detection; saved observations are not reinterpreted\nTrials   : 3 per task\n\nTASK     FIRE?  FIRED    UNKNOWN  ERRORS  PASS\none      yes    1/3      1        1       1/3\n\nTrigger recall      : 1/1 (100%) [95% CI 20%–100%]\n  explicit          : 1/1 (100%) [95% CI 20%–100%]\nFalse-trigger rate  : n/a (no runs)\nPrecision           : 1/1 (100%) [95% CI 20%–100%]\nF1                  : 1.00 (no CI: a harmonic mean of two proportions has no closed-form binomial interval)\n\nTokens used (per task):\n- one: input 5, output 2\n- total: input 5, output 2\n\nWarnings:\n- Unknown and failed trials remain in the table.\n\nManifest: manifest.json");
});
