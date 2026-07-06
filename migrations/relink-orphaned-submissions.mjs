/**
 * Migration: relink orphaned submissions into student.academicRecords.
 *
 * Some StudentAnswer submissions (assignment / classwork / test / exam) — and
 * report cards — reference a student but were never linked into that student's
 * academicRecords under their (session, classId) group / term. As a result they
 * don't appear in the stored record (getStudentById reconciles them at read time,
 * but the document itself stays incomplete). This migration writes those links
 * into the document permanently.
 *
 * It uses the same findOrCreateTermRecord helper the app uses, so the resulting
 * structure is identical to a normally-linked submission. It only ADDS links that
 * are missing anywhere — it never moves or removes existing links — and is
 * idempotent (safe to run repeatedly).
 *
 * Usage (run from the ems-api directory):
 *   node migrations/relink-orphaned-submissions.mjs            # dry run (no writes)
 *   node migrations/relink-orphaned-submissions.mjs --apply    # persist changes
 *   node migrations/relink-orphaned-submissions.mjs --apply --student <id>
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Student from "../models/StudentModel.js";
import StudentAnswer from "../models/StudentAnswerModel.js";
import ReportCard from "../models/ReportcardModel.js";
import { findOrCreateTermRecord } from "../utils/academicRecords.js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ONE_STUDENT = args.includes("--student") ? args[args.indexOf("--student") + 1] : null;

// Which StudentAnswer.evaluationType maps to which term list (exam is a single ref).
const LIST_FOR = { assignment: "assignments", classwork: "classworks", test: "tests" };

const totals = {
  studentsScanned: 0,
  studentsUpdated: 0,
  submissionsRelinked: 0,
  reportCardsRelinked: 0,
  skippedNoTermSession: 0,
  errors: 0,
};

async function run() {
  await mongoose.connect(process.env.MONGO_URL);
  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY RUN (no writes)"}`);

  // Only visit students that actually have submissions or report cards.
  let ids;
  if (ONE_STUDENT) {
    ids = [ONE_STUDENT];
  } else {
    const [ansIds, rcIds] = await Promise.all([
      StudentAnswer.distinct("student"),
      ReportCard.distinct("student"),
    ]);
    ids = [...new Set([...ansIds, ...rcIds].map(String))];
  }
  console.log(`Students to scan: ${ids.length}\n`);

  for (const id of ids) {
    totals.studentsScanned++;
    try {
      const student = await Student.findById(id);
      if (!student) continue;

      const [answers, reportCards] = await Promise.all([
        StudentAnswer.find({ student: id }).select("_id evaluationType term session classId").lean(),
        ReportCard.find({ student: id }).select("_id term session classId").lean(),
      ]);

      // Every ref already linked ANYWHERE in this student's academicRecords.
      const linked = new Set();
      for (const g of student.academicRecords ?? []) {
        for (const t of g.terms ?? []) {
          for (const key of ["assignments", "classworks", "tests"]) {
            for (const x of t[key] ?? []) linked.add(String(x));
          }
          if (t.exam) linked.add(String(t.exam));
          if (t.reportCard) linked.add(String(t.reportCard));
        }
      }

      let changed = 0;
      const place = (session, term, classId, fn) => {
        if (!session || !term) {
          totals.skippedNoTermSession++;
          return;
        }
        const rec = findOrCreateTermRecord(student, { term, session, classId });
        fn(rec);
      };

      // ── Submissions ──────────────────────────────────────────────────────
      for (const a of answers) {
        if (linked.has(String(a._id))) continue;
        const type = String(a.evaluationType || "").toLowerCase();
        place(a.session, a.term, a.classId, (rec) => {
          if (type === "exam") {
            if (!rec.exam) {
              rec.exam = a._id;
              linked.add(String(a._id));
              changed++;
              totals.submissionsRelinked++;
            }
          } else {
            const list = LIST_FOR[type];
            if (!list) return; // unknown type — leave it alone
            if (!rec[list]) rec[list] = [];
            if (!rec[list].some((x) => String(x) === String(a._id))) {
              rec[list].push(a._id);
              linked.add(String(a._id));
              changed++;
              totals.submissionsRelinked++;
            }
          }
        });
      }

      // ── Report cards ─────────────────────────────────────────────────────
      for (const rc of reportCards) {
        if (linked.has(String(rc._id))) continue;
        place(rc.session, rc.term, rc.classId, (rec) => {
          if (!rec.reportCard) {
            rec.reportCard = rc._id;
            linked.add(String(rc._id));
            changed++;
            totals.reportCardsRelinked++;
          }
        });
      }

      if (changed > 0) {
        totals.studentsUpdated++;
        const name = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
        console.log(`  ${APPLY ? "linked" : "would link"} ${changed} ref(s) for ${name} (${id})`);
        if (APPLY) await student.save();
      }
    } catch (err) {
      totals.errors++;
      console.error(`  ERROR on student ${id}: ${err.message}`);
    }
  }

  console.log("\n──────── Summary ────────");
  console.log(`Mode:                 ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Students scanned:     ${totals.studentsScanned}`);
  console.log(`Students updated:     ${totals.studentsUpdated}`);
  console.log(`Submissions relinked: ${totals.submissionsRelinked}`);
  console.log(`Report cards relinked:${totals.reportCardsRelinked}`);
  console.log(`Skipped (no term/session): ${totals.skippedNoTermSession}`);
  console.log(`Errors:               ${totals.errors}`);
  if (!APPLY) console.log("\nDry run — no changes written. Re-run with --apply to persist.");
}

run()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
