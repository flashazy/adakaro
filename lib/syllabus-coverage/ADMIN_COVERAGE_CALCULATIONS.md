# School Admin Syllabus Coverage — Calculation Reference

This document describes how numbers on **School Admin → Syllabus Coverage**
(`/dashboard/syllabus-coverage`) are calculated. It applies only to the school
admin dashboard, not teacher or academic-department coverage pages.

## Data sources (Supabase)

| Table | Purpose |
|-------|---------|
| `schools` | Term structure and term start/end dates (`term_1_start`, `term_1_end`, etc.) |
| `syllabus_topics` | Syllabus topics per school, class, subject, academic year |
| `syllabus_subtopics` | Subtopics under each topic (denominator for coverage) |
| `syllabus_subtopic_progress` | Per-teacher subtopic status (`not_started`, `in_progress`, `completed`) |
| `teacher_assignments` | Which teacher teaches which class/subject (one dashboard row per assignment) |
| `teacher_gradebook_assignments` + `teacher_scores` | Optional exam averages for Coverage vs Performance |
| `classes`, `subjects`, `profiles` | Display names |

Loader: `lib/syllabus-coverage/load-admin-syllabus-dashboard.server.ts`  
Server action: `app/(dashboard)/dashboard/syllabus-coverage/actions.ts`

There are **no hardcoded percentages** (e.g. 45%, 33%, 42). All values are
computed from live database rows for the selected academic year and filters.

---

## 1. Actual coverage (per class / subject / teacher row)

**Formula:**

```
actual coverage % = round(completed subtopics ÷ total subtopics × 100)
```

**Implementation:** `coveragePercent()` in `lib/syllabus-coverage/coverage-stats.ts`

**Rules:**

- **Total subtopics:** Count of `syllabus_subtopics` linked to `syllabus_topics`
  that match the teacher's class cluster and subject assignment.
- **Completed subtopics:** Count where `syllabus_subtopic_progress.status = 'completed'`
  for that teacher and subtopic.
- `in_progress` and `not_started` do **not** count toward completed coverage.
- If total subtopics = 0, actual coverage = **0%**.

**Displayed as:** "Completed" on mobile subject cards, "Actual" column in the table.

---

## 2. Expected coverage (pace target)

**Formula:**

```
expected coverage % = round(days elapsed in period ÷ total days in period × 100)
```

**Implementation:** `computeAdminExpectedCoveragePercent()` in
`lib/syllabus-coverage/admin-expected-coverage.ts`

**Period selection (dashboard Term filter):**

| Term filter | Date range used |
|-------------|-----------------|
| **Term 1** | `schools.term_1_start` → `schools.term_1_end` |
| **Term 2** | `schools.term_2_start` → `schools.term_2_end` |
| **Term 3** | `schools.term_3_start` → `schools.term_3_end` (if 3-term school) |
| **All Terms** | Jan 1 → Dec 31 of the selected academic year |

**Fallbacks** (when school term dates are not configured in School Settings):

- Term 1: Jan 1 – Apr 30
- Term 2: May 1 – Aug 31
- Term 3: Sep 1 – Dec 31

**Edge cases:**

- Before period start → 0%
- After period end → 100%
- Uses **today's date** at calculation time

Expected coverage is **not** based on topic counts or lesson plans directly; it
reflects how far through the selected term or year the calendar has progressed.

**Displayed as:** "Target" on subject cards, "Expected" column in the table.

When the user changes the Term filter, `enrichRowForTerm()` recomputes expected
coverage and pace status for each row client-side (no extra query).

---

## 3. Behind / ahead / on target (subject cards)

**Formula:**

```
difference = actual coverage % − expected coverage %
```

**Implementation:** `formatAdminCoveragePaceLabel()` in
`lib/syllabus-coverage/admin-dashboard-utils.ts`

**Display rules:**

| Condition | Label shown |
|-----------|-------------|
| `difference < 0` | `{abs(difference)}% behind target` (equivalent to expected − actual) |
| `difference = 0` | `On target` |
| `difference > 0` | `{difference}% ahead of target` |

**Examples:**

- Completed 0%, Target 45% → **45% behind target**
- Completed 30%, Target 50% → **20% behind target**
- Completed 80%, Target 50% → **30% ahead of target**
- Completed 50%, Target 50% → **On target**

This wording is presentation-only; the underlying math is unchanged.

---

## 4. Pace status badges (Ahead / On Track / Slightly Behind / Critical)

**Formula:**

```
variance = actual coverage % − expected coverage %
```

**Implementation:** `deriveAdminPaceStatus()` in `admin-dashboard-utils.ts`

| Variance | Status |
|----------|--------|
| ≥ +5 | Ahead |
| ≥ −5 | On Track |
| ≥ −15 | Slightly Behind |
| < −15 | Critical |

Status badges use these bands so small differences near target still show as
"On Track". This is separate from the plain-language behind/ahead line on
subject cards.

---

## 5. Overall KPI: Overall Coverage

**Formula:**

```
overall coverage % = round(average of actual coverage % across all subjects with subtopics > 0)
```

**Implementation:** `buildAdminSyllabusKpis()` in `admin-dashboard-utils.ts`

---

## 6. School Coverage Health score (e.g. 42 / 100)

This is a **composite executive score**, not a single coverage gap.

**Formula:**

```
coverageScore  = average actual coverage % across active subjects
activityScore  = % of subjects with last progress update within 7 days
scheduleScore  = % of subjects with pace status Ahead or On Track

health score = round(coverageScore × 0.5 + activityScore × 0.25 + scheduleScore × 0.25)
```

**Implementation:** `buildSchoolHealth()` in `admin-dashboard-utils.ts`

The health badge label (On Track, Critical, etc.) applies `deriveAdminPaceStatus()`
to the health score vs expected coverage for the selected term.

---

## 7. Coverage vs Performance

- **Coverage:** Same actual coverage % as above (per class/subject row).
- **Performance:** Average exam score % from gradebook (`teacher_scores` ÷
  `max_score`), when assessment data exists; otherwise "No assessment data".

---

## Filter behaviour

Filters (academic year, term, class, subject, teacher, status chips, search,
pagination) only **narrow which rows are shown**. They do not change how
coverage or expected coverage is calculated for each row.

---

## Quick answer for school owners

> **"Where does 45% target come from?"**  
> From how much of the selected term (or full year) has passed on the calendar,
> using your school's term dates from Settings.

> **"Where does 0% completed come from?"**  
> From syllabus subtopics marked completed by the teacher divided by total
> subtopics for that class and subject.

> **"What does 45% behind target mean?"**  
> The teacher has completed 45 percentage points less syllabus than the calendar
> pace expects at today's date.
