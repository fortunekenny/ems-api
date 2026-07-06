// ─── Academic-records helpers ────────────────────────────────────────────────
// academicRecords is grouped by class (per session):
//   [{ session, classId, terms: [{ term, attendance, assignments, classworks,
//                                   tests, exam, reportCard, subjects }] }]
// These helpers hide that nesting so controllers keep a single, consistent way
// to locate the term entry they need to read or write.

const sameId = (a, b) => String(a ?? "") === String(b ?? "");
// Term casing is stored inconsistently across the app ("first" vs "First"), so
// always compare terms case-insensitively.
const sameTerm = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();

// The class-session group that contains a given term.
export function findGroupByTerm(student, { term, session }) {
  return (student.academicRecords ?? []).find(
    (g) => g.session === session && (g.terms ?? []).some((t) => sameTerm(t.term, term)),
  );
}

// The term sub-record for a (term, session). Optionally scoped to a class.
export function findTermRecord(student, { term, session, classId } = {}) {
  for (const g of student.academicRecords ?? []) {
    if (g.session !== session) continue;
    if (classId && !sameId(g.classId, classId)) continue;
    const t = (g.terms ?? []).find((x) => sameTerm(x.term, term));
    if (t) return t;
  }
  return undefined;
}

// The classId a (term, session) belongs to.
export function classIdForTerm(student, { term, session }) {
  return findGroupByTerm(student, { term, session })?.classId;
}

// Find (or create) the class-session group and its term entry; returns the term
// sub-document so the caller can push into its arrays and student.save().
export function findOrCreateTermRecord(student, { term, session, classId }) {
  if (!student.academicRecords) student.academicRecords = [];
  let group = student.academicRecords.find(
    (g) => g.session === session && sameId(g.classId, classId),
  );
  if (!group) {
    student.academicRecords.push({ session, classId, terms: [] });
    group = student.academicRecords[student.academicRecords.length - 1];
  }
  let termEntry = (group.terms ?? []).find((t) => sameTerm(t.term, term));
  if (!termEntry) {
    group.terms.push({ term });
    termEntry = group.terms[group.terms.length - 1];
  }
  return termEntry;
}

// Move a (term, session) entry to the given class group, preserving its
// attendance/answers. classId lives on the group, so a class change relocates
// the term entry into the (classId, session) group (created if missing).
// Optionally resets the term's subjects. Persist with student.save().
// Returns the resulting term sub-document, or undefined if the term isn't found.
export function moveTermToClass(student, { term, session, classId, subjects }) {
  const group = findGroupByTerm(student, { term, session });
  const record = group?.terms?.find((t) => sameTerm(t.term, term));
  if (!record) return undefined;

  if (sameId(group.classId, classId)) {
    if (subjects) record.subjects = subjects;
    return record;
  }

  const moved = record.toObject();
  delete moved._id; // let the target group assign a fresh subdoc id
  if (subjects) moved.subjects = subjects;

  group.terms.pull(record._id);
  if (group.terms.length === 0) student.academicRecords.pull(group._id);

  let target = student.academicRecords.find(
    (g) => g.session === session && sameId(g.classId, classId),
  );
  if (!target) {
    student.academicRecords.push({ session, classId, terms: [] });
    target = student.academicRecords[student.academicRecords.length - 1];
  }
  target.terms.push(moved);
  return target.terms[target.terms.length - 1];
}

// Mongoose populate paths for the whole nested tree.
export const academicPopulatePaths = [
  { path: "academicRecords.classId", select: "_id className" },
  {
    path: "academicRecords.terms.subjects",
    select: "_id subjectName subjectCode classId term session",
  },
  { path: "academicRecords.terms.attendance" },
  { path: "academicRecords.terms.assignments" },
  { path: "academicRecords.terms.classworks" },
  { path: "academicRecords.terms.tests" },
  { path: "academicRecords.terms.exam" },
  { path: "academicRecords.terms.reportCard" },
];
