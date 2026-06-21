import type { DemoRequestStatus } from "@/lib/demo-requests/types";

export interface PipelineStageStyle {
  badge: string;
  text: string;
  selectAccent: string;
  timelineIcon: string;
  header: string;
  headerActive: string;
}

/** Consistent pipeline stage colors across Demo Requests UI. */
export const PIPELINE_STAGE_STYLES: Record<
  DemoRequestStatus,
  PipelineStageStyle
> = {
  New: {
    badge: "bg-blue-100 text-blue-800 ring-blue-200",
    text: "text-blue-700",
    selectAccent: "border-l-blue-500",
    timelineIcon: "border-blue-200 bg-blue-50 text-blue-600",
    header: "border-blue-200 bg-blue-50 text-blue-900",
    headerActive: "border-blue-500 bg-blue-600 text-white shadow-sm",
  },
  Contacted: {
    badge: "bg-cyan-100 text-cyan-800 ring-cyan-200",
    text: "text-cyan-700",
    selectAccent: "border-l-cyan-500",
    timelineIcon: "border-cyan-200 bg-cyan-50 text-cyan-600",
    header: "border-cyan-200 bg-cyan-50 text-cyan-900",
    headerActive: "border-cyan-500 bg-cyan-600 text-white shadow-sm",
  },
  "Demo Scheduled": {
    badge: "bg-amber-100 text-amber-900 ring-amber-200",
    text: "text-amber-800",
    selectAccent: "border-l-amber-500",
    timelineIcon: "border-amber-200 bg-amber-50 text-amber-700",
    header: "border-amber-200 bg-amber-50 text-amber-950",
    headerActive: "border-amber-500 bg-amber-600 text-white shadow-sm",
  },
  "Demo Completed": {
    badge: "bg-purple-100 text-purple-800 ring-purple-200",
    text: "text-purple-700",
    selectAccent: "border-l-purple-500",
    timelineIcon: "border-purple-200 bg-purple-50 text-purple-600",
    header: "border-purple-200 bg-purple-50 text-purple-900",
    headerActive: "border-purple-500 bg-purple-600 text-white shadow-sm",
  },
  Won: {
    badge: "bg-green-100 text-green-800 ring-green-200",
    text: "text-green-700",
    selectAccent: "border-l-green-500",
    timelineIcon: "border-green-200 bg-green-50 text-green-600",
    header: "border-green-200 bg-green-50 text-green-900",
    headerActive: "border-green-500 bg-green-600 text-white shadow-sm",
  },
  Lost: {
    badge: "bg-red-100 text-red-800 ring-red-200",
    text: "text-red-700",
    selectAccent: "border-l-red-500",
    timelineIcon: "border-red-200 bg-red-50 text-red-600",
    header: "border-red-200 bg-red-50 text-red-900",
    headerActive: "border-red-500 bg-red-600 text-white shadow-sm",
  },
};

export function pipelineStageBadgeClass(status: DemoRequestStatus): string {
  return PIPELINE_STAGE_STYLES[status]?.badge ?? "bg-slate-100 text-slate-700 ring-slate-200";
}

export function pipelineStageTextClass(status: DemoRequestStatus): string {
  return PIPELINE_STAGE_STYLES[status]?.text ?? "text-slate-700";
}

export function pipelineStageSelectAccentClass(
  status: DemoRequestStatus
): string {
  return PIPELINE_STAGE_STYLES[status]?.selectAccent ?? "border-l-slate-400";
}

export function timelineActivityIconClass(
  eventType: string,
  label: string
): string {
  const key = `${eventType} ${label}`.toLowerCase();
  if (key.includes("won")) {
    return PIPELINE_STAGE_STYLES.Won.timelineIcon;
  }
  if (key.includes("lost")) {
    return PIPELINE_STAGE_STYLES.Lost.timelineIcon;
  }
  if (key.includes("demo") || key.includes("scheduled")) {
    return PIPELINE_STAGE_STYLES["Demo Scheduled"].timelineIcon;
  }
  if (key.includes("google meet") || key.includes("zoom") || key.includes("invitation")) {
    return "border-violet-200 bg-violet-50 text-violet-600";
  }
  if (key.includes("assigned")) {
    return PIPELINE_STAGE_STYLES.Contacted.timelineIcon;
  }
  if (key.includes("call")) {
    return PIPELINE_STAGE_STYLES.Contacted.timelineIcon;
  }
  if (key.includes("whatsapp")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-600";
  }
  if (key.includes("email")) {
    return PIPELINE_STAGE_STYLES.New.timelineIcon;
  }
  if (key.includes("note")) {
    return PIPELINE_STAGE_STYLES["Demo Completed"].timelineIcon;
  }
  if (key.includes("lead created")) {
    return PIPELINE_STAGE_STYLES.New.timelineIcon;
  }
  return "border-slate-200 bg-white text-slate-600";
}

export const TIMELINE_FILTER_ACTIVE_STYLES: Record<string, string> = {
  all: "bg-slate-800 text-white shadow-sm",
  calls: "bg-cyan-600 text-white shadow-sm",
  whatsapp: "bg-emerald-600 text-white shadow-sm",
  emails: "bg-blue-600 text-white shadow-sm",
  meetings: "bg-amber-600 text-white shadow-sm",
  notes: "bg-purple-600 text-white shadow-sm",
};
