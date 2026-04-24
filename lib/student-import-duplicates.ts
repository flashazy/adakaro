/** Digits only; used for composite / partial duplicate matching. */
export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (phone == null || phone === "") return "";
  return phone.replace(/\D/g, "");
}

export function makeNameClassKey(fullName: string, className: string): string {
  return `${fullName.trim().toLowerCase()}|${className.trim()}`;
}

/** Returns null if phone is too short to form a stable composite key. */
export function makeCompositeKey(
  fullName: string,
  className: string,
  parentPhone: string | null | undefined
): string | null {
  const d = normalizePhoneDigits(parentPhone);
  if (d.length < 8) return null;
  return `${makeNameClassKey(fullName, className)}|${d}`;
}

export type DbStudentForDuplicateRow = {
  admission_number: string | null;
  full_name: string;
  parent_phone: string | null;
  class_id: string;
};

export type StudentDuplicateLookups = {
  admissionLowerSet: Set<string>;
  compositeExactSet: Set<string>;
  nameClassToPhones: Map<string, Set<string>>;
};

export function buildStudentDuplicateLookups(
  students: DbStudentForDuplicateRow[],
  classIdToName: Map<string, string>
): StudentDuplicateLookups {
  const admissionLowerSet = new Set<string>();
  const compositeExactSet = new Set<string>();
  const nameClassToPhones = new Map<string, Set<string>>();

  for (const s of students) {
    const adm = s.admission_number?.trim();
    if (adm) admissionLowerSet.add(adm.toLowerCase());

    const className = (classIdToName.get(s.class_id) ?? "").trim();
    const fname = (s.full_name ?? "").trim();
    if (!fname || !className) continue;

    const nc = makeNameClassKey(fname, className);
    const pd = normalizePhoneDigits(s.parent_phone);
    if (pd.length >= 8) {
      const ck = makeCompositeKey(fname, className, s.parent_phone);
      if (ck) compositeExactSet.add(ck);
      let set = nameClassToPhones.get(nc);
      if (!set) {
        set = new Set();
        nameClassToPhones.set(nc, set);
      }
      set.add(pd);
    }
  }

  return { admissionLowerSet, compositeExactSet, nameClassToPhones };
}
