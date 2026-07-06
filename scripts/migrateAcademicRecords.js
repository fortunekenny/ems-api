/**
 * One-time migration: convert each student's flat academicRecords into the
 * class-grouped, term-nested shape.
 *
 *   OLD: [{ session, term, classId, attendance, assignments, classworks,
 *           tests, exam, reportCard, subjects }, ...]
 *   NEW: [{ session, classId, terms: [{ term, attendance, assignments,
 *           classworks, tests, exam, reportCard, subjects }, ...] }, ...]
 *
 * Records are grouped by (classId, session); each old record becomes a term
 * entry inside its group. Duplicate (classId, session, term) rows are merged so
 * no attendance/answers are lost. Reads run against the raw collection so the
 * new Mongoose schema doesn't strip the legacy fields before we can read them.
 *
 * Idempotent: students whose records already use `terms` are skipped.
 *
 * Usage (from the ems-api directory):
 *   node scripts/migrateAcademicRecords.js            // apply changes
 *   node scripts/migrateAcademicRecords.js --dry-run  // report only, no writes
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db/connectdb.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");
const TERM_FIELDS = [
  "attendance",
  "assignments",
  "classworks",
  "tests",
  "subjects",
];
const SINGLE_FIELDS = ["exam", "reportCard"];

const isMigrated = (records) =>
  Array.isArray(records) && records.some((r) => Array.isArray(r?.terms));

// Build the nested shape from a flat academicRecords array.
function regroup(records) {
  const groups = new Map(); // key = `${classId}|${session}` -> group
  for (const rec of records) {
    if (!rec) continue;
    const classKey = rec.classId ? String(rec.classId) : "null";
    const key = `${classKey}|${rec.session ?? ""}`;
    let group = groups.get(key);
    if (!group) {
      group = { session: rec.session, classId: rec.classId ?? null, terms: [] };
      groups.set(key, group);
    }
    // Merge into an existing term entry if this (classId, session, term) repeats.
    let term = group.terms.find((t) => t.term === rec.term);
    if (!term) {
      term = { term: rec.term };
      for (const f of TERM_FIELDS) term[f] = [];
      group.terms.push(term);
    }
    for (const f of TERM_FIELDS) {
      if (Array.isArray(rec[f])) term[f] = [...term[f], ...rec[f]];
    }
    for (const f of SINGLE_FIELDS) {
      if (rec[f] != null) term[f] = rec[f];
    }
  }
  return [...groups.values()];
}

const run = async () => {
  if (!process.env.MONGO_URL) {
    console.error("Missing MONGO_URL in environment. Aborting.");
    process.exit(1);
  }

  await connectDB(process.env.MONGO_URL);
  console.log(`Connected to MongoDB${DRY_RUN ? " (dry run)" : ""}.`);

  const coll = mongoose.connection.collection("students");
  const students = await coll
    .find({}, { projection: { academicRecords: 1 } })
    .toArray();

  let migrated = 0;
  let skipped = 0;
  let empty = 0;

  for (const s of students) {
    const records = s.academicRecords;
    if (!Array.isArray(records) || records.length === 0) {
      empty += 1;
      continue;
    }
    if (isMigrated(records)) {
      skipped += 1;
      continue;
    }
    const nested = regroup(records);
    console.log(
      `Student ${s._id}: ${records.length} flat record(s) -> ${nested.length} class group(s) (${nested.reduce((a, g) => a + g.terms.length, 0)} term entries).`,
    );
    if (!DRY_RUN) {
      await coll.updateOne(
        { _id: s._id },
        { $set: { academicRecords: nested } },
      );
    }
    migrated += 1;
  }

  console.log(
    `\nDone. ${migrated} migrated, ${skipped} already nested, ${empty} with no records.${DRY_RUN ? " (dry run — no writes)" : ""}`,
  );
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
