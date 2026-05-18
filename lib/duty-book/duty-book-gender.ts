import type {
  DutyBookGenderFilter,
  DutyBookPayload,
  DutyBookViewSlice,
} from "./types";

export function isBoyGender(gender: string | null | undefined): boolean {
  return String(gender ?? "").toLowerCase() === "male";
}

export function isGirlGender(gender: string | null | undefined): boolean {
  return String(gender ?? "").toLowerCase() === "female";
}

export function studentInGenderView(
  gender: string | null | undefined,
  view: DutyBookGenderFilter
): boolean {
  if (view === "all") return true;
  if (view === "boys") return isBoyGender(gender);
  return isGirlGender(gender);
}

export function getDutyBookView(
  data: DutyBookPayload,
  gender: DutyBookGenderFilter
): DutyBookViewSlice {
  return data.views[gender];
}

export function genderViewLabel(gender: DutyBookGenderFilter): string {
  if (gender === "boys") return "Boys only";
  if (gender === "girls") return "Girls only";
  return "All genders";
}
