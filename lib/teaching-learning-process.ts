/**
 * Tanzania lesson plan: "Teaching and Learning Process" grid (4 stages × 4 fields).
 * Stored in `lesson_plans.teaching_learning_process` (JSONB).
 */

export interface TeachingLearningProcessStage {
  time: number | null;
  teaching_activities: string;
  learning_activities: string;
  assessment_criteria: string;
}

export type TeachingLearningProcessStageKey =
  | "introduction"
  | "competence_development"
  | "design_and_realization"
  | "closure";

export interface TeachingLearningProcess {
  introduction: TeachingLearningProcessStage;
  competence_development: TeachingLearningProcessStage;
  design_and_realization: TeachingLearningProcessStage;
  closure: TeachingLearningProcessStage;
}

export const TEACHING_LEARNING_PROCESS_STAGES: {
  key: TeachingLearningProcessStageKey;
  label: string;
}[] = [
  { key: "introduction", label: "Introduction" },
  { key: "competence_development", label: "Competence Development" },
  { key: "design_and_realization", label: "Design and Realization" },
  { key: "closure", label: "Closure" },
];

export function emptyTeachingLearningProcess(): TeachingLearningProcess {
  const stage = (): TeachingLearningProcessStage => ({
    time: null,
    teaching_activities: "",
    learning_activities: "",
    assessment_criteria: "",
  });
  return {
    introduction: stage(),
    competence_development: stage(),
    design_and_realization: stage(),
    closure: stage(),
  };
}

/** Normalizes DB / API JSON into a full TeachingLearningProcess object. */
export function parseTeachingLearningProcess(
  raw: unknown
): TeachingLearningProcess {
  const base = emptyTeachingLearningProcess();
  if (raw == null || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  const merge = (key: TeachingLearningProcessStageKey): TeachingLearningProcessStage => {
    const s = o[key];
    if (s == null || typeof s !== "object") return base[key];
    const e = s as Record<string, unknown>;
    const tr = e.time;
    let time: number | null = null;
    if (typeof tr === "number" && Number.isFinite(tr)) time = tr;
    else if (typeof tr === "string" && tr.trim() !== "") {
      const n = Number.parseFloat(tr);
      if (Number.isFinite(n)) time = n;
    }
    return {
      time,
      teaching_activities: String(e.teaching_activities ?? ""),
      learning_activities: String(e.learning_activities ?? ""),
      assessment_criteria: String(e.assessment_criteria ?? ""),
    };
  };

  return {
    introduction: merge("introduction"),
    competence_development: merge("competence_development"),
    design_and_realization: merge("design_and_realization"),
    closure: merge("closure"),
  };
}
