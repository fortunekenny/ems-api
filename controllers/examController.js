// Create an exam
import { StatusCodes } from "http-status-codes";
import Exam from "../models/ExamModel.js";
import Staff from "../models/StaffModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";

export const createExam = async (req, res, next) => {
  try {
    const { classId, subject, questions, date, startTime, durationTime } =
      req.body;

    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    // Validate required fields
    if (
      !classId ||
      !subject ||
      !questions ||
      !date ||
      !startTime ||
      !durationTime
    ) {
      throw new BadRequestError("All required fields must be provided.");
    }

    let subjectTeacherId;
    let isAuthorized = false;

    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
      subjectTeacherId = req.body.subjectTeacher;

      // Ensure 'subjectTeacher' field is provided
      if (!subjectTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'subjectTeacher' field must be provided.",
        );
      }

      // Validate that the subjectTeacher exists and is valid
      const teacher = await Staff.findById(subjectTeacherId).populate(
        "subjects",
      );
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

      const isAssignedSubject = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified subjectTeacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      // Validate that the teacher is assigned the subject
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create an exam for the selected subject.",
        );
      }

      subjectTeacherId = userId; // Assign the current teacher as the subjectTeacher
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to create this exam.");
    }

    // Create the exam
    const exam = new Exam({
      subjectTeacher: subjectTeacherId,
      classId,
      subject,
      questions,
      date,
      startTime,
      durationTime,
    });

    await exam.save();

    res.status(StatusCodes.CREATED).json({
      message: "Exam created successfully.",
      exam,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get all exams
export const getExams = async (req, res, next) => {
  try {
    const exams = await Exam.find().populate("questions class subjects");
    res.status(StatusCodes.OK).json(exams);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get exam by ID
export const getExamById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id).populate("questions class subjects");
    if (!exam) {
      throw new NotFoundError("ClassWork not found.");
    }
    res.status(StatusCodes.OK).json(exam);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Update an exam
export const updateExam = async (req, res, next) => {
  try {
    const { id } = req.params; // Exam ID from request params
    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    // Find the exam to be updated
    const exam = await Exam.findById(id).populate("subjectTeacher");
    if (!exam) {
      throw new NotFoundError("Exam not found.");
    }

    // Authorization check
    let isAuthorized = false;

    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
    } else if (userRole === "teacher") {
      // Teachers can only update their own assigned exams
      isAuthorized = exam.subjectTeacher._id.toString() === userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to update this exam.");
    }

    // Update the exam
    const updatedExam = await Exam.findByIdAndUpdate(id, req.body, {
      new: true, // Return the updated document
      runValidators: true, // Validate the update against the schema
    });

    res.status(StatusCodes.OK).json({
      message: "Exam updated successfully.",
      updatedExam,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Delete an exam
export const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    res.status(200).json({ message: "Exam deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/*
Example Payload for Admin/Proprietor
{
  "classId": "class_id_here",
  "subject": "subject_id_here",
  "questions": ["question_id_1", "question_id_2"],
  "date": "2024-11-20",
  "startTime": "10:00 AM",
  "durationTime": 90,
  "session": "2023/2024",
  "term": "First",
  "subjectTeacher": "teacher_id_here"
}
*/

/*
Example Payload for Teacher
The subjectTeacher field is not required for teacher users:
{
  "classId": "class_id_here",
  "subject": "subject_id_here",
  "questions": ["question_id_1", "question_id_2"],
  "date": "2024-11-20",
  "startTime": "10:00 AM",
  "durationTime": 90,
  "session": "2023/2024",
  "term": "First"
}
*/
