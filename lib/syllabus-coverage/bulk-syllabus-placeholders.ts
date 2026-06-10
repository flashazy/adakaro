const MATHEMATICS_PLACEHOLDER = `Topic: NUMBERS AND ARITHMETIC
- Whole Numbers
- Factors and Multiples
- Fractions
- Decimals

Topic: ALGEBRA
- Algebraic Expressions
- Simplifying Expressions
- Linear Equations

Topic: GEOMETRY
- Angles
- Triangles
- Circles`;

const ENGLISH_PLACEHOLDER = `Topic: READING AND COMPREHENSION
- Main Idea
- Supporting Details
- Inference

Topic: GRAMMAR
- Parts of Speech
- Sentence Structure
- Punctuation

Topic: WRITING
- Paragraph Writing
- Letter Writing
- Editing and Proofreading`;

const KISWAHILI_PLACEHOLDER = `Topic: KUSOMA NA KUELEWA
- Kusoma kwa Ufahamu
- Kutambua Wazo Kuu
- Kujibu Maswali

Topic: SARUFI
- Aina za Maneno
- Sentensi Sahihi
- Uandishi wa Alama za Uandishi

Topic: KUANDIKA
- Insha za Aya Moja
- Barua Rasmi
- Kuhariri na Kusahihisha`;

const GEOGRAPHY_PLACEHOLDER = `Topic: PHYSICAL GEOGRAPHY
- Weather and Climate
- Landforms
- Natural Vegetation

Topic: HUMAN GEOGRAPHY
- Population
- Settlement
- Economic Activities

Topic: MAP WORK
- Map Symbols
- Scale and Distance
- Direction and Bearings`;

const HISTORY_PLACEHOLDER = `Topic: EARLY SOCIETIES
- Sources of History
- Early Communities
- Trade and Interaction

Topic: COLONIAL PERIOD
- Colonization
- Resistance Movements
- Social and Economic Changes

Topic: INDEPENDENCE AND NATION BUILDING
- Path to Independence
- Post-Independence Governments
- National Development`;

const SUBJECT_PLACEHOLDERS: Record<string, string> = {
  mathematics: MATHEMATICS_PLACEHOLDER,
  english: ENGLISH_PLACEHOLDER,
  kiswahili: KISWAHILI_PLACEHOLDER,
  geography: GEOGRAPHY_PLACEHOLDER,
  history: HISTORY_PLACEHOLDER,
};

function normalizeSubjectKey(subjectName?: string | null): string | null {
  const raw = subjectName?.trim().toLowerCase() ?? "";
  if (!raw) return null;

  if (raw.includes("math")) return "mathematics";
  if (raw.includes("english")) return "english";
  if (raw.includes("kiswahili") || raw.includes("swahili")) return "kiswahili";
  if (raw.includes("geography")) return "geography";
  if (raw.includes("history")) return "history";

  return null;
}

/** Placeholder paste examples for bulk syllabus import, keyed by subject name. */
export function getBulkSyllabusPlaceholder(
  subjectName?: string | null
): string {
  const key = normalizeSubjectKey(subjectName);
  if (key && SUBJECT_PLACEHOLDERS[key]) {
    return SUBJECT_PLACEHOLDERS[key];
  }
  return MATHEMATICS_PLACEHOLDER;
}
