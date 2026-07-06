/**
 * One-time backfill: assign a studentID to any existing Student document
 * that is missing one (created before the pre-validate hook generated it).
 *
 * Usage (from the ems-api directory):
 *   node scripts/backfillStudentIDs.js          // apply changes
 *   node scripts/backfillStudentIDs.js --dry-run // report only, no writes
 */
import dotenv from "dotenv";
import connectDB from "../db/connectdb.js";
import Student from "../models/StudentModel.js";
import generateID from "../utils/generateId.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

const run = async () => {
  if (!process.env.MONGO_URL) {
    console.error("Missing MONGO_URL in environment. Aborting.");
    process.exit(1);
  }

  await connectDB(process.env.MONGO_URL);
  console.log(`Connected to MongoDB${DRY_RUN ? " (dry run)" : ""}.`);

  // Students with no studentID at all, or an empty/null value.
  const filter = {
    $or: [
      { studentID: { $exists: false } },
      { studentID: null },
      { studentID: "" },
    ],
  };

  const students = await Student.find(filter).select(
    "_id firstName middleName lastName studentID",
  );

  console.log(`Found ${students.length} student(s) without a studentID.`);

  let updated = 0;
  let failed = 0;

  for (const student of students) {
    try {
      const newID = await generateID(
        "STU",
        student.firstName,
        student.middleName,
        student.lastName,
      );

      if (DRY_RUN) {
        console.log(`[dry-run] ${student._id} -> ${newID}`);
        updated += 1;
        continue;
      }

      student.studentID = newID;
      // Skip full validation so other legacy/required-field gaps don't block the backfill.
      await student.save({ validateBeforeSave: false });
      console.log(`Updated ${student._id} -> ${newID}`);
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed for ${student._id}:`, error.message);
    }
  }

  console.log(
    `\nDone. ${DRY_RUN ? "Would update" : "Updated"}: ${updated}, Failed: ${failed}.`,
  );

  await import("mongoose").then(({ default: mongoose }) =>
    mongoose.connection.close(),
  );
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error("Backfill crashed:", error);
  process.exit(1);
});
