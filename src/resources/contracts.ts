export type Condition = 'baseline' | 'treatment';


export interface SkillBundle {
  kind: 'skill';
  name: string;
  sourceDir: string;
  files: string[];
  sha256: string;
  payload: string;
  overlays: Partial<Record<Condition, string>>;
}


export type EvaluationTargetKind = 'skill' | 'rules' | 'mcp';


/**
 * The one variable changed between paired experiment arms.
 *
 * Skills are injected into the treatment prompt. Rules and MCP targets are installed as project
 * files in the run workspace so the agent encounters them through its real configuration loader.
 */
export interface EvaluationTarget {
  kind: EvaluationTargetKind;
  name: string;
  sourceDir: string;
  files: string[];
  sha256: string;
  payload: string | null;
  overlays: Partial<Record<Condition, string>>;
}
