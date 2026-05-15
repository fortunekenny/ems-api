import Grade from "../models/GradeModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import StudentAnswer from "../models/StudentAnswerModel.js";
import Test from "../models/TestModel.js";
import Exam from "../models/ExamModel.js";
import Staff from "../models/StaffModel.js";
import InternalServerError from "../errors/internal-server-error.js";
import PDFDocument from "pdfkit";

// Create a grade
export const createGrade = async (req, res, next) => {
  try {
    const {
      student,
      subject,
      teacher,
      classId,
      session,
      term,
      /* markObtainable, */
    } = req.body;

    if (
      !student ||
      !subject ||
      !classId /* || */
      /* !session || */
      /* !term || */
      /* !markObtainable */
    ) {
      throw new BadRequestError("Required fields must be provided.");
    }

    const { id: userId, role: userRole } = req.user;

    let subjectTeacherId;
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      subjectTeacherId = teacher;

      // Ensure 'subjectTeacher' field is provided
      if (!subjectTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'teacher' field must be provided.",
        );
      }

      const teacherData = await Staff.findById(subjectTeacherId).populate([
        { path: "teacherRecords.subjects", select: "_id subjectName" },
      ]);
      if (!teacherData) {
        throw new NotFoundError("Provided teacher not found.");
      }

      // Check if subject is assigned in any of the teacher's records
      const isAssignedSubject = teacherData.teacherRecords.some(
        (record) =>
          record.subjects &&
          record.subjects.some(
            (subjectItem) => subjectItem && subjectItem.equals(subject),
          ),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified teacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      const teacherData = await Staff.findById(userId).populate([
        { path: "teacherRecords.subjects", select: "_id subjectName" },
      ]);
      if (!teacherData) {
        throw new NotFoundError("Teacher not found.");
      }

      // Check if the teacher is assigned to this subject in any record
      isAuthorized = teacherData.teacherRecords.some(
        (record) =>
          record.subjects &&
          record.subjects.some(
            (subjectItem) => subjectItem.toString() === subject.toString(),
          ),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to grade this subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to grade this subject.",
      );
    }

    // Build the filter for StudentAnswer—term and session are optional
    const evaluationFilter = {
      student: student,
      classId: classId,
      subject: subject,
    };
    if (term) evaluationFilter.term = term;
    if (session) evaluationFilter.session = session;

    const evaluationData = await StudentAnswer.find(evaluationFilter);

    if (evaluationData.length === 0) {
      throw new NotFoundError(
        `Evaluation not found for student=${student}, subject=${subject}, classId=${classId}${
          term ? `, term=${term}` : ""
        }${session ? `, session=${session}` : ""}`,
      );
    }

    let exam = null;
    let examScore = 0;
    let examEvaluationId = null;
    const tests = [];
    let testsScore = 0;
    const testEvaluationIds = [];

    for (const studentAnswer of evaluationData) {
      if (studentAnswer.evaluationType === "Exam") {
        // Update exam-related fields
        exam = studentAnswer._id;
        examScore = Number(studentAnswer.markObtained || 0);
        examEvaluationId = studentAnswer.evaluationTypeId || null;
      } else if (studentAnswer.evaluationType === "Test") {
        // Update test-related fields
        tests.push(studentAnswer._id);
        testsScore += Number(studentAnswer.markObtained || 0);
        if (studentAnswer.evaluationTypeId)
          testEvaluationIds.push(String(studentAnswer.evaluationTypeId));
      }
    }

    const markObtained = examScore + testsScore;

    // Compute markObtainable by summing the marks obtainable from the related Test and Exam evaluations
    const uniqueTestEvalIds = [...new Set(testEvaluationIds)];
    const testDocs = uniqueTestEvalIds.length
      ? await Test.find({ _id: { $in: uniqueTestEvalIds } })
      : [];
    const examDoc = examEvaluationId
      ? await Exam.findById(String(examEvaluationId))
      : null;

    // Use the explicit `marksObtainable` field from Test and Exam documents.
    const testsMarksObtainable = testDocs.reduce(
      (sum, t) => sum + Number(t.marksObtainable || 0),
      0,
    );
    const examMarksObtainable = Number(
      (examDoc && examDoc.marksObtainable) || 0,
    );

    const markObtainable = testsMarksObtainable + examMarksObtainable;

    const percentageScore =
      markObtainable > 0 ? (markObtained / Number(markObtainable)) * 100 : 0;

    const grade = (() => {
      if (percentageScore < 30) return "F";
      if (percentageScore < 40) return "E";
      if (percentageScore < 50) return "D";
      if (percentageScore < 60) return "C";
      if (percentageScore < 70) return "B";
      return "A";
    })();

    const remark = (() => {
      if (grade === "F") return "Failed";
      if (grade === "E") return "Passed";
      if (grade === "D") return "Fair";
      if (grade === "C") return "Good";
      if (grade === "B") return "Very Good";
      return "Excellent";
    })();

    const newGrade = new Grade({
      student,
      subject,
      teacher,
      classId,
      exam,
      examScore,
      tests,
      testsScore,
      markObtained,
      markObtainable,
      percentageScore,
      grade,
      session,
      term,
      remark,
    });
    await newGrade.save();

    //Compute the student's position (ranking) based on percentageScore.
    // Retrieve all report cards for the class, term, and session, sorted descending.

    const rankingFilter = { classId };
    if (term) rankingFilter.term = term;
    if (session) rankingFilter.session = session;

    const allGrades = await Grade.find(rankingFilter).sort({
      percentageScore: -1,
    });

    let currentRank = 0;
    let lastPercentage = null;
    let rankCounter = 0;

    for (const g of allGrades) {
      rankCounter++;
      // If first record or current percentage is less than previous, update rank.
      if (lastPercentage === null || g.percentageScore < lastPercentage) {
        currentRank = rankCounter;
      }
      // Else if equal, currentRank remains the same (tie).
      lastPercentage = g.percentageScore;
      if (g._id.equals(newGrade._id)) {
        // Update the newly created report card's position in the database.
        await Grade.findByIdAndUpdate(newGrade._id, {
          position: currentRank,
        });
        break;
      }
    }

    const populatedGrade = await Grade.findById(newGrade._id).populate([
      // { path: "exam", select: "_id totalScore" },
      // { path: "tests", select: "_id totalScore" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "student", select: "_id firstName middleName lastName" },
      { path: "teacher", select: "_id name" },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Graded successfully",
      populatedGrade,
    });
  } catch (error) {
    console.log("Error creating test:", error);
    next(new InternalServerError(error.message));
  }
};

// Get all grades
export const getGrades = async (req, res, next) => {
  try {
    const allowedFilters = [
      "student",
      "subject",
      "classId",
      "term",
      "session",
      "sort",
      "page",
      "limit",
    ];

    // Get provided query keys
    const providedFilters = Object.keys(req.query);

    // Check for unknown parameters (ignore case differences if needed)
    const unknownFilters = providedFilters.filter(
      (key) => !allowedFilters.includes(key),
    );

    if (unknownFilters.length > 0) {
      // Return error if unknown parameters are present
      throw new BadRequestError(
        `Unknown query parameter(s): ${unknownFilters.join(", ")}`,
      );
    }

    const { student, subject, classId, term, session, sort, page, limit } =
      req.query;

    // Build an initial match stage for fields stored directly on Assignment
    const matchStage = {};

    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;

    const pipeline = [];
    pipeline.push({ $match: matchStage });

    // Lookup to join subjectTeacher data from the "staff" collection
    pipeline.push({
      $lookup: {
        from: "students", // collection name for staff (ensure this matches your DB)
        localField: "student",
        foreignField: "_id",
        as: "studentData",
      },
    });
    pipeline.push({ $unwind: "$studentData" });

    // Lookup to join subject data from the "subjects" collection
    pipeline.push({
      $lookup: {
        from: "subjects",
        localField: "subject",
        foreignField: "_id",
        as: "subjectData",
      },
    });
    pipeline.push({ $unwind: "$subjectData" });

    // Lookup to join class data from the "classes" collection
    pipeline.push({
      $lookup: {
        from: "classes",
        localField: "classId",
        foreignField: "_id",
        as: "classData",
      },
    });
    pipeline.push({ $unwind: "$classData" });

    const joinMatch = {};

    if (student) {
      const studentRegex = {
        $regex: `^${student}$`,
        $options: "i",
      };
      joinMatch.$or = [
        { "studentData.firstName": studentRegex },
        { "studentData.middleName": studentRegex },
        { "studentData.lastName": studentRegex },
      ];
    }
    if (subject) {
      const subjectRegex = { $regex: `^${subject}$`, $options: "i" };
      joinMatch.$or = [
        { "subjectData.subjectName": subjectRegex },
        { "subjectData.subjectCode": subjectRegex },
      ];
    }
    if (classId) {
      joinMatch["classData.className"] = {
        $regex: `^${classId}$`,
        $options: "i",
      };
    }
    if (Object.keys(joinMatch).length > 0) {
      pipeline.push({ $match: joinMatch });
    }

    // Sorting stage: define sort options.
    // Adjust the sort options to suit your requirements.
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "a-z": { firstName: 1 },
      "z-a": { firstName: -1 },
      lastPosition: { position: -1 },
      firstPosition: { position: 1 },
      lowestPercentage: { percentageScore: -1 },
      highestPercentage: { percentageScore: 1 },
      lowestMarkObtained: { markObtained: -1 },
      highestMarkObtained: { markObtained: 1 },
    };
    const sortKey = sortOptions[sort] || sortOptions.newest;
    pipeline.push({ $sort: sortKey });

    // Pagination stages: Calculate skip and limit.
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    pipeline.push({ $skip: (pageNumber - 1) * limitNumber });
    pipeline.push({ $limit: limitNumber });

    // Projection stage: structure the output.
    pipeline.push({
      $project: {
        _id: 1,
        term: 1,
        session: 1,
        student: {
          _id: "$studentData._id",
          firstName: "$studentData.firstName",
          middleName: "$studentData.middleName",
          lastName: "$studentData.lastName",
        },
        subject: {
          _id: "$subjectData._id",
          subjectName: "$subjectData.subjectName",
          subjectCode: "$subjectData.subjectCode",
        },
        classId: {
          _id: "$classData._id",
          className: "$classData.className",
        },
        examScore: 1,
        testsScore: 1,
        markObtained: 1,
        percentageScore: 1,
        markObtainable: 1,
        position: 1,
        grade: 1,
      },
    });

    // Execute the aggregation pipeline
    const grades = await Grade.aggregate(pipeline);

    // Count total matching documents for pagination.
    // We use a similar pipeline without $skip, $limit, $sort, and $project.
    const countPipeline = pipeline.filter(
      (stage) =>
        !(
          "$skip" in stage ||
          "$limit" in stage ||
          "$sort" in stage ||
          "$project" in stage
        ),
    );
    countPipeline.push({ $count: "total" });
    const countResult = await Grade.aggregate(countPipeline);
    const totalGrades = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalGrades / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalGrades,
      numOfPages,
      currentPage: pageNumber,
      grades,
    });
  } catch (error) {
    console.log("Error getting grade:", error);
    next(new InternalServerError(error.message));
  }
};

// Get all grades for a specific student
export const getGradesForStudent = async (req, res, next) => {
  try {
    const grades = await Grade.find({ student: req.params.studentId }).populate(
      "student subject teacher",
    );
    res.status(StatusCodes.OK).json(grades);
  } catch (error) {
    console.log("Error getting grades for student:", error);
    next(new InternalServerError(error.message));
  }
};

// Get a grade by ID
export const getGradeById = async (req, res, next) => {
  try {
    const grade = await Grade.findById(req.params.id).populate(
      "student subject teacher",
    );
    if (!grade) {
      throw new NotFoundError("Grade not found");
    }
    res.status(StatusCodes.OK).json(grade);
  } catch (error) {
    console.log("Error getting grade by ID:", error);
    next(new InternalServerError(error.message));
  }
};

// Update a grade
export const updateGrade = async (req, res, next) => {
  try {
    const updatedGrade = await Grade.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    res
      .status(StatusCodes.OK)
      .json({ message: "Grade updated successfully.", updatedGrade });
  } catch (error) {
    console.error("Error updating grade:", error);
    next(new BadRequestError(error.message));
  }
};

// Delete a grade
export const deleteGrade = async (req, res, next) => {
  try {
    const grade = await Grade.findByIdAndDelete(req.params.id);
    if (!grade) {
      throw new NotFoundError("Grade not found");
    }

    res.status(StatusCodes.OK).json({ message: "Grade deleted successfully" });
  } catch (error) {
    console.log("Error deleting grade:", error);
    next(new InternalServerError(error.message));
  }
};

export const downloadStudentGrades = async (req, res, next) => {
  try {
    const { id } = req.params;

    const grade = await Grade.findById(id).populate([
      { path: "student", select: "_id firstName middleName lastName" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName subjectCode" },
      { path: "teacher", select: "_id firstName lastName" },
    ]);

    if (!grade) {
      return next(new NotFoundError("Grade report not found."));
    }

    const doc = new PDFDocument({ margin: 50 });

    const fileName = `${grade.student.firstName}_${grade.student.lastName}_${grade.subject.subjectName}_Grade_Report.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);

    // Color palette
    const colors = {
      primary: "#2563eb",
      secondary: "#1e40af",
      success: "#16a34a",
      danger: "#dc2626",
      text: "#1f2937",
      textLight: "#6b7280",
      border: "#e5e7eb",
      cardBg: "#f9fafb",
      accent: "#8b5cf6",
    };

    // Utility — Modern section header
    const sectionHeader = (title) => {
      doc.moveDown(0.8);

      const headerY = doc.y;

      // Background bar
      doc
        .rect(40, headerY, 520, 28)
        .fillAndStroke(colors.primary, colors.secondary);

      // Title text
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(title, 55, headerY + 8);

      doc.y = headerY + 28;
      doc.moveDown(1);
    };

    // Utility — Info box
    const infoBox = (label, value) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(colors.textLight)
        .text(`${label}:`, { continued: true });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(colors.text)
        .text(` ${value || "N/A"}`);

      doc.moveDown(0.3);
    };

    // HEADER WITH SCHOOL BRANDING
    // Top accent bar
    doc.rect(0, 0, 612, 8).fillAndStroke(colors.primary, colors.secondary);

    doc.y = 30;

    // School name
    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor(colors.primary)
      .text("SHEPHERD NURSERY & PRIMARY SCHOOL", { align: "center" });

    doc.moveDown(0.4);

    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor(colors.textLight)
      .text("Student Subject Grade Report", { align: "center" });

    doc.moveDown(0.8);

    // Decorative divider
    const dividerY = doc.y;
    doc
      .moveTo(150, dividerY)
      .lineTo(462, dividerY)
      .strokeColor(colors.primary)
      .lineWidth(2)
      .stroke();

    doc.circle(150, dividerY, 4).fillAndStroke(colors.accent, colors.accent);
    doc.circle(462, dividerY, 4).fillAndStroke(colors.accent, colors.accent);

    doc.moveDown(1.5);

    // STUDENT & SUBJECT INFO CARD
    const cardY = doc.y;
    const cardHeight = 125;

    // Shadow
    doc
      .rect(53, cardY + 3, 506, cardHeight)
      .fillOpacity(0.1)
      .fill("#000000")
      .fillOpacity(1);

    // Main card
    doc
      .roundedRect(50, cardY, 506, cardHeight, 8)
      .fillAndStroke(colors.cardBg, colors.border);

    doc.y = cardY + 10;
    sectionHeader("Student & Subject Information");

    // Split info into two columns
    const col1X = 55;
    const col2X = 300;

    doc.y = cardY + 50;
    const infoStartY = doc.y;

    // Column 1
    doc.x = col1X;
    infoBox("Name", `${grade.student.firstName} ${grade.student.lastName}`);
    infoBox("Class", grade.classId?.className);
    infoBox("Subject", grade.subject?.subjectName);

    // Column 2
    doc.y = infoStartY;
    doc.x = col2X;
    infoBox("Term", grade.term);
    doc.x = col2X;
    infoBox("Session", grade.session);
    doc.x = col2X;
    if (grade.teacher) {
      infoBox(
        "Subject Teacher",
        `${grade.teacher.firstName} ${grade.teacher.lastName}`,
      );
    } else {
      infoBox("Subject Teacher", "N/A");
    }

    // Reset X for main flow
    doc.x = 50;
    doc.y = cardY + cardHeight + 20;

    // PERFORMANCE SUMMARY LOGIC
    sectionHeader("Performance Summary");

    const evalCardY = doc.y;
    const evalHeight = 150;

    // Shadow
    doc
      .rect(53, evalCardY + 3, 506, evalHeight)
      .fillOpacity(0.1)
      .fill("#000000")
      .fillOpacity(1);

    // Main card
    doc
      .roundedRect(50, evalCardY, 506, evalHeight, 8)
      .fillAndStroke(colors.cardBg, colors.border);

    doc.y = evalCardY + 15;

    // Test & Exam Details (Left Col)
    doc.x = 70;
    infoBox("Tests Score", `${grade.testsScore || 0}`);
    doc.x = 70;
    infoBox("Exam Score", `${grade.examScore || 0}`);
    doc.moveDown(0.5);
    doc.x = 70;
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(colors.text)
      .text(
        `Overall Mark: ${grade.markObtained || 0} / ${grade.markObtainable || 0}`,
      );

    // Vertical Divider
    doc
      .moveTo(280, evalCardY + 15)
      .lineTo(280, evalCardY + evalHeight - 15)
      .strokeColor(colors.border)
      .lineWidth(2)
      .stroke();

    // Grades & Position (Right Col)
    doc.y = evalCardY + 15;
    doc.x = 310;
    infoBox("Percentage", `${grade.percentageScore || 0}%`);
    doc.x = 310;
    infoBox("Class Position", grade.position || "N/A");

    // Grade Badge
    doc.y = evalCardY + 70;
    doc.x = 310;
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(colors.textLight)
      .text("Grade Achieved:");

    // Determine Color
    let badgeColor = colors.primary;
    if (grade.grade === "A" || grade.grade === "B") badgeColor = colors.success;
    else if (grade.grade === "C" || grade.grade === "D")
      badgeColor = colors.secondary;
    else if (grade.grade === "E" || grade.grade === "F")
      badgeColor = colors.danger;

    doc
      .roundedRect(310, doc.y + 5, 100, 32, 6)
      .fillAndStroke(badgeColor, badgeColor);

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#ffffff")
      .text(grade.grade || "N/A", 310, doc.y + 12, {
        width: 100,
        align: "center",
      });

    doc.x = 50;
    doc.y = evalCardY + evalHeight + 25;

    // REMARKS
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(colors.primary)
      .text("Teacher's Remark:");
    doc.moveDown(0.3);

    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor(colors.text)
      .text(grade.remark || "No remarks provided.");

    // FOOTER
    doc.moveDown(2.5);

    doc
      .moveTo(50, doc.y)
      .lineTo(556, doc.y)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Oblique")
      .fontSize(8)
      .fillColor(colors.textLight)
      .text(
        `Generated on ${new Date().toLocaleString("en-US", {
          dateStyle: "long",
          timeStyle: "short",
        })}`,
        { align: "center" },
      );

    // Bottom accent bar
    const pageHeight = doc.page.height;
    doc
      .rect(0, pageHeight - 8, 612, 8)
      .fillAndStroke(colors.primary, colors.secondary);

    doc.end();
  } catch (err) {
    console.log("Grade PDF generation failed:", err);
    next(new InternalServerError("Failed to generate PDF."));
  }
};

/*
const transitionToNewTermOrSession = async (startDate, holidayDurations) => {
  try {
    // Get the current term details
    const {
      term: currentTerm,
      nextTermStartDate,
      session: currentSession,
      isHoliday,
    } = getCurrentTermDetails(startDate, holidayDurations);

    console.log(`Current term: ${currentTerm}, Is holiday: ${isHoliday}`);

    // Determine the next term/session
    const terms = ["first", "second", "third"];
    const nextTermIndex = (terms.indexOf(currentTerm) + 1) % terms.length;
    const nextTerm = terms[nextTermIndex];
    const isNewSession = nextTerm === "first"; // New session begins with the first term

    const newSession = isNewSession
      ? `${parseInt(currentSession.split("/")[0], 10) + 1}/${parseInt(currentSession.split("/")[1], 10) + 1}`
      : currentSession;

    console.log(`Transitioning to ${nextTerm} term in session ${newSession}`);

    // Create new records for the next term/session
    const classes = await Class.find({ session: currentSession, term: currentTerm });

    for (const classDoc of classes) {
      const newClass = new Class({
        ...classDoc.toObject(),
        term: nextTerm,
        session: newSession,
      });
      await newClass.save();
    }

    console.log(`Created new classes for term: ${nextTerm}, session: ${newSession}`);

    // Reset attendance records
    const attendances = await Attendance.find({ session: currentSession, term: currentTerm });

    for (const attendanceDoc of attendances) {
      const newAttendance = new Attendance({
        ...attendanceDoc.toObject(),
        term: nextTerm,
        session: newSession,
        date: undefined, // Clear the date for new attendance records
      });
      await newAttendance.save();
    }

    console.log(`Attendance reset for term: ${nextTerm}, session: ${newSession}`);

    // Optionally notify stakeholders
    await notifyUsers(nextTerm, newSession, isHoliday);

    console.log("Transition completed successfully.");
  } catch (error) {
    console.error("Error transitioning to new term/session:", error);
  }
};
*/
