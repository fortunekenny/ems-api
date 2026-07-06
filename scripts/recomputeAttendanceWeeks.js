/**
 * One-time migration: recompute weekOfTerm & dayOfTerm for existing Attendance
 * records.
 *
 * Each (student, term, session) group is ordered chronologically and numbered
 * from 1 — days 1–5 -> week 1, 6–10 -> week 2, etc. — matching the corrected
 * createStudentTermAttendance logic. Records were only ever created for school
 * days (weekends/public holidays excluded), so the chronological index lines up
 * with the day-of-term used at creation time.
 *
 * Usage (from the ems-api directory):
 *   node scripts/recomputeAttendanceWeeks.js            // apply changes
 *   node scripts/recomputeAttendanceWeeks.js --dry-run  // report only, no writes
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db/connectdb.js";
import Attendance from "../models/AttendanceModel.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

const run = async () => {
  if (!process.env.MONGO_URL) {
    console.error("Missing MONGO_URL in environment. Aborting.");
    process.exit(1);
  }

  await connectDB(process.env.MONGO_URL);
  console.log(`Connected to MongoDB${DRY_RUN ? " (dry run)" : ""}.`);

  // Distinct (student, session, term) groups. Term is lower-cased so that
  // inconsistent casing ("First" vs "first") collapses into one group — they
  // are the same term — and we normalise the stored value to lowercase below.
  const groups = await Attendance.aggregate([
    {
      $group: {
        _id: {
          student: "$student",
          session: "$session",
          term: { $toLower: { $ifNull: ["$term", ""] } },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  console.log(`Found ${groups.length} student/term/session group(s).`);

  let scanned = 0;
  const ops = [];

  for (const g of groups) {
    const { student, session, term } = g._id; // term is already lower-cased

    // Match every casing variant of this term. Chronological order mirrors the
    // schoolDays ordering used at creation.
    const termFilter = term ? new RegExp(`^${term}$`, "i") : { $in: [null, ""] };
    const records = await Attendance.find({ student, session, term: termFilter })
      .sort({ date: 1, createdAt: 1 })
      .select("_id term weekOfTerm dayOfTerm");

    records.forEach((rec, i) => {
      scanned += 1;
      const dayOfTerm = i + 1;
      const weekOfTerm = Math.ceil(dayOfTerm / 5);
      // Normalise the stored term to the canonical lowercase form too.
      const needsTerm = term && rec.term !== term;
      if (
        rec.weekOfTerm !== weekOfTerm ||
        rec.dayOfTerm !== dayOfTerm ||
        needsTerm
      ) {
        const set = { weekOfTerm, dayOfTerm };
        if (needsTerm) set.term = term;
        ops.push({
          updateOne: { filter: { _id: rec._id }, update: { $set: set } },
        });
      }
    });
  }

  console.log(`Scanned ${scanned} record(s); ${ops.length} need updating.`);

  if (DRY_RUN) {
    console.log("[dry-run] No writes performed.");
  } else if (ops.length) {
    // Chunk to keep each bulkWrite payload reasonable.
    const CHUNK = 1000;
    let modified = 0;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const res = await Attendance.bulkWrite(ops.slice(i, i + CHUNK));
      modified += res.modifiedCount ?? 0;
    }
    console.log(`Updated ${modified} record(s).`);
  } else {
    console.log("Nothing to update.");
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error("Migration crashed:", error);
  process.exit(1);
});
