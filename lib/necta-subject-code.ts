/**
 * Maps full subject names (as stored in report cards) to NECTA-style short codes
 * for printed result sheets (e.g. CIV - 'C' HIST - 'D').
 * Keys are normalized: lowercase, collapsed whitespace.
 */
const SUBJECT_TO_CODE: Record<string, string> = {
  civics: "CIV",
  history: "HIST",
  geography: "GEO",
  "kiswahili": "KISW",
  "english language": "ENGL",
  english: "ENGL",
  "basic mathematics": "B/MATH",
  mathematics: "B/MATH",
  math: "B/MATH",
  "general mathematics": "B/MATH",
  biology: "BIO",
  physics: "PHY",
  chemistry: "CHEM",
  "literature in english": "LIT ENG",
  literature: "LIT ENG",
  commerce: "COMM",
  "book-keeping": "BK",
  bookkeeping: "BK",
  "book keeping": "BK",
  "additional mathematics": "ADD MATH",
  "information and computer studies": "ICS",
  "computer studies": "ICS",
  "physical education": "PE",
  "bible knowledge": "BK",
  "islamic knowledge": "IK",
  edk: "EDK",
  "development knowledge": "EDK",
  "business studies": "BUS",
  "business study": "BUS",
  accounting: "ACC",
  "basic applied mathematics": "BAM",
  "food and nutrition": "F&N",
  "theatre arts": "THA",
  music: "MUS",
  "fine art": "ART",
  "fine arts": "ART",
  agriculture: "AGRI",
  "metal work": "MW",
  "wood work": "WW",
  "technical drawing": "TD",
  "electrical installation": "EI",
};

function normalizeSubjectKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Returns a NECTA-style subject code for the given subject label.
 * Unknown names become a short uppercase token (initials or truncated words).
 */
export function subjectNameToNectaCode(name: string): string {
  const key = normalizeSubjectKey(name);
  if (SUBJECT_TO_CODE[key]) return SUBJECT_TO_CODE[key];
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words
      .map((w) => w.replace(/[^a-zA-Z]/g, "").charAt(0))
      .join("")
      .toUpperCase();
    if (initials.length >= 2 && initials.length <= 8) return initials;
  }
  const compact = name.replace(/\s+/g, " ").trim().toUpperCase();
  if (compact.length <= 10) return compact;
  return compact.slice(0, 8);
}
