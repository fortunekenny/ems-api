import Grade from "../models/GradeModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import StudentAnswer from "../models/StudentAnswerModel.js";
import Staff from "../models/StaffModel.js";
import InternalServerError from "../errors/internal-server-error.js";

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
      markObtainable,
    } = req.body;

    if (
      !student ||
      !subject ||
      !classId ||
      !session ||
      !term ||
      !markObtainable
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
        { path: "subjects", select: "_id subjectName" },
      ]);
      if (!teacherData) {
        throw new NotFoundError("Provided teacher not found.");
      }

      const isAssignedSubject = teacherData.subjects.some(
        (subjectItem) => subjectItem && subjectItem.equals(subject),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified teacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      const teacherData = await Staff.findById(userId).populate("subjects");
      if (!teacherData) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = teacherData.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
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

    const evaluationData = await StudentAnswer.find({
      student: student,
      classId: classId,
      subject: subject,
      term: term,
      session: session,
    });

    if (evaluationData.length === 0) {
      throw new NotFoundError("Evaluation not found.");
    }

    let exam = null;
    let examScore = 0;
    const tests = [];
    let testsScore = 0;

    for (const studentAnswer of evaluationData) {
      if (studentAnswer.evaluationType === "Exam") {
        // Update exam-related fields
        exam = studentAnswer._id;
        examScore = Number(studentAnswer.markObtained);
      } else if (studentAnswer.evaluationType === "Test") {
        // Update test-related fields
        tests.push(studentAnswer._id);
        testsScore += studentAnswer.markObtained;
      }
    }

    const markObtained = examScore + testsScore;

    const percentageScore = (markObtained / Number(markObtainable)) * 100;

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

    const allGrades = await Grade.find({
      classId,
      term,
      session,
    }).sort({ percentageScore: -1 });

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
      if (g._id.equals(grade._id)) {
        // Update the newly created report card's position in the database.
        await Grade.findByIdAndUpdate(grade._id, {
          position: currentRank,
        });
        grade.position = currentRank;
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
    console.error("Error getting grades for student:", error);
    next(new InternalServerError(error.message));
  }
};

// Get a grade by ID
export const getGradeById = async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.id).populate(
      "student subject teacher",
    );
    if (!grade) return res.status(404).json({ error: "Grade not found" });
    res.status(200).json(grade);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
