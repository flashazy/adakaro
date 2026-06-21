export type IntelligenceCardId =
  | "churn"
  | "risk"
  | "revenue"
  | "onboarding"
  | "engagement";

export type ChurnRiskLevel = "low" | "medium" | "high";

export type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "almost_ready"
  | "complete";

export type EngagementLabel =
  | "champion"
  | "active"
  | "weak_usage"
  | "disengaged";

export type GrowthDirection = "up" | "down" | "stable" | "unknown";

export type IntelligenceStatusTone =
  | "healthy"
  | "warning"
  | "critical"
  | "neutral";

export interface IntelligenceStatusBadge {
  label: string;
  tone: IntelligenceStatusTone;
}

export interface SchoolIntelligenceBrief {
  id: string;
  name: string;
  score?: number;
  label?: string;
  riskLevel?: ChurnRiskLevel;
  progressPercent?: number;
  onboardingStatus?: OnboardingStatus;
  engagementLabel?: EngagementLabel;
}

export interface ChurnSchoolDetail {
  id: string;
  name: string;
  riskLevel: ChurnRiskLevel;
  riskScore: number;
  signals: string[];
}

export interface RiskSchoolDetail {
  id: string;
  name: string;
  riskScore: number;
  signals: string[];
}

export interface OnboardingSchoolDetail {
  id: string;
  name: string;
  progressPercent: number;
  status: OnboardingStatus;
  completedSteps: string[];
  missingSteps: string[];
}

export interface EngagementSchoolDetail {
  id: string;
  name: string;
  score: number;
  label: EngagementLabel;
  signals: string[];
}

export interface ChurnIntelligence {
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  headlineValue: string;
  explanation: string;
  statusBadge: IntelligenceStatusBadge;
  recommendedAction: string;
  signalsUsed: string[];
  schools: ChurnSchoolDetail[];
}

export interface RiskIntelligence {
  averageRiskScore: number;
  schoolsAtRisk: RiskSchoolDetail[];
  headlineValue: string;
  explanation: string;
  statusBadge: IntelligenceStatusBadge;
  recommendedAction: string;
  signalsUsed: string[];
}

export interface RevenueIntelligence {
  currentRevenue: number;
  projectedNextMonth: number;
  projected3Month: number;
  growthDirection: GrowthDirection;
  growthPercent: number | null;
  paidSchoolCount: number;
  headlineValue: string;
  explanation: string;
  statusBadge: IntelligenceStatusBadge;
  recommendedAction: string;
  signalsUsed: string[];
}

export interface OnboardingIntelligence {
  averageProgress: number;
  completeCount: number;
  stuckCount: number;
  headlineValue: string;
  explanation: string;
  statusBadge: IntelligenceStatusBadge;
  recommendedAction: string;
  signalsUsed: string[];
  stuckSchools: OnboardingSchoolDetail[];
  schools: OnboardingSchoolDetail[];
}

export interface EngagementIntelligence {
  averageScore: number;
  headlineValue: string;
  explanation: string;
  statusBadge: IntelligenceStatusBadge;
  recommendedAction: string;
  signalsUsed: string[];
  topEngaged: EngagementSchoolDetail[];
  lowEngagement: EngagementSchoolDetail[];
  schools: EngagementSchoolDetail[];
}

export interface SmartIntelligencePayload {
  computedAt: string;
  churn: ChurnIntelligence;
  risk: RiskIntelligence;
  revenue: RevenueIntelligence;
  onboarding: OnboardingIntelligence;
  engagement: EngagementIntelligence;
}

export type LoadSmartIntelligenceResult =
  | { ok: true; data: SmartIntelligencePayload }
  | { ok: false; message: string };

export interface SchoolIntelligenceContext {
  classCount: number;
  revenueLast30Days: number;
  revenueLast90Days: number;
}
