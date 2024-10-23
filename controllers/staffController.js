import Staff from "../models/StaffModel.js"; // Ensure to import the Staff model
import Class from "../models/ClassModel.js"; // Import the Class model
import Subject from "../models/SubjectModel.js"; // Import the Subject model
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import { StatusCodes } from "http-status-codes";
import checkPermissions from "../utils/checkPermissions.js";
import {
  generateCurrentTerm,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js"; // Import the term generation function

// Helper function to validate the term and session
const isValidTermAndSession = (subject, term, session) => {
  return subject.term === term && subject.session === session;
};

// Helper function to update subject teachers and staff's classes
const assignSubjectTeacherAndUpdateClass = async (
  subject,
  staff,
  term,
  session,
) => {
  if (isValidTermAndSession(subject, term, session)) {
    // Remove previous teacher if any
    const previousTeacherId = subject.subjectTeachers?.[0];
    if (
      previousTeacherId &&
      previousTeacherId.toString() !== staff?._id?.toString()
    ) {
      const previousTeacher = await Staff.findById(previousTeacherId);
      if (previousTeacher) {
        previousTeacher.subjects = previousTeacher.subjects.filter(
          (subj) => subj.toString() !== subject._id?.toString(),
        );
        await previousTeacher.save();
      }
    }

    // Assign the current staff as the subject teacher
    subject.subjectTeachers = [staff._id];
    await subject.save();

    // Add the subject to the staff's subjects list if not already there
    if (!staff.subjects.includes(subject._id)) {
      staff.subjects.push(subject._id);
    }

    // Append the class to staff's classes if not already there
    if (!staff.classes.includes(subject.class?.toString())) {
      staff.classes.push(subject.class?.toString());
    }
  }
};

// Controller to get all staff members
export const getStaff = async (req, res) => {
  try {
    const staff = await Staff.find().select("-password");
    res.status(StatusCodes.OK).json({ count: staff.length, staff });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Controller to get a staff member by ID
export const getStaffById = async (req, res) => {
  try {
    const { id: staffId } = req.params;

    // Find the staff member by ID
    const staff = await Staff.findOne({ _id: staffId })
      .select("-password")
      .populate([
        {
          path: "classes",
          select: "_id className students subjects classTeacher",
        },
        {
          path: "subjects",
          select: "_id subjectName subjectCode",
        },
      ]);

    if (!staff) {
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }

    res.status(StatusCodes.OK).json(staff);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Controller to update a staff member
/*export const updateStaff = async (req, res) => {
  try {
    const { id: staffId } = req.params;
    const { name, email, role, department, subjects, classes, isClassTeacher } =
      req.body;

    // Find the staff member by ID
    const staff = await Staff.findOne({ _id: staffId });

    if (!staff) {
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }

    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Check if the current user has permission to update this staff member
    checkPermissions(req.user, staff.user);

    // Update staff member fields
    if (name) staff.name = name;
    if (email) staff.email = email;
    if (role) staff.role = role;
    if (department) staff.department = department;
    if (subjects) staff.subjects = subjects;
    if (classes) staff.classes = classes;
    if (term) staff.term = term;
    if (isClassTeacher) staff.isClassTeacher = isClassTeacher;

    // Save the updated staff member to the database
    await staff.save();

    res.status(StatusCodes.OK).json({ staff });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};*/

export const updateStaff = async (req, res) => {
  try {
    const { id: staffId } = req.params;
    const { name, email, role, department, subjects, classes, isClassTeacher } =
      req.body;

    // Find the staff member by ID
    const staff = await Staff.findOne({ _id: staffId });
    if (!staff) {
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }

    // Generate the current term and session
    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Check if the current user has permission to update this staff member
    checkPermissions(req.user, staff.user);

    // Step 1: Handle class teacher assignment changes
    if (isClassTeacher && isClassTeacher !== staff.isClassTeacher?.toString()) {
      // Remove the staff from the previous class (if any)
      if (staff.isClassTeacher) {
        const previousClass = await Class.findById(staff.isClassTeacher);
        if (previousClass) {
          previousClass.classTeacher = null; // Unassign the previous class teacher
          await previousClass.save();
        }
      }

      // Assign the staff as class teacher for the new class
      const newClass = await Class.findById(isClassTeacher);
      if (!newClass) {
        throw new NotFoundError("Assigned class not found for class teacher");
      }

      newClass.classTeacher = staff._id; // Assign the new class teacher
      staff.isClassTeacher = newClass._id; // Update staff's isClassTeacher field

      // Add the classId to staff.classes if not already present
      const classId = newClass._id.toString();
      if (!staff.classes.includes(classId)) {
        staff.classes.push(classId);
      }

      await newClass.save();
    }

    // Step 2: Handle subject updates (remove staff from old subjects and assign new subjects)
    if (subjects && subjects.length > 0) {
      // Remove the staff from previous subjects
      const previousSubjects = await Subject.find({
        _id: { $in: staff.subjects },
      });
      for (const subject of previousSubjects) {
        await removeSubjectFromPreviousTeacher(subject, staff._id); // Custom function to handle reassignment logic
      }

      // Reset the staff's subjects and classes
      staff.subjects = [];
      staff.classes = staff.isClassTeacher
        ? [staff.isClassTeacher.toString()]
        : [];

      // Assign the staff to the new subjects
      for (const subjectId of subjects) {
        const assignedSubject = await Subject.findById(subjectId);
        if (assignedSubject) {
          await assignSubjectTeacherAndUpdateClass(
            assignedSubject,
            staff,
            term,
            staff.session,
          );
        }
      }
    }

    // Step 3: Handle class updates (remove staff from previous classes and assign new classes)
    if (classes && classes.length > 0) {
      // Remove the staff from previous classes
      const previousClasses = await Class.find({ _id: { $in: staff.classes } });
      for (const oldClass of previousClasses) {
        oldClass.teachers.pull(staff._id);
        await oldClass.save();
      }

      // Assign the staff to the new classes
      for (const classId of classes) {
        const newAssignedClass = await Class.findById(classId);
        if (newAssignedClass) {
          newAssignedClass.teachers.push(staff._id);
          await newAssignedClass.save();

          // Add the classId to staff.classes if not already there
          if (!staff.classes.includes(classId)) {
            staff.classes.push(classId);
          }
        }
      }
    }

    // Step 4: Update staff details (name, email, role, department)
    if (name) staff.name = name;
    if (email) staff.email = email;
    if (role) staff.role = role;
    if (department) staff.department = department;
    if (subjects) staff.subjects = subjects;
    if (classes) staff.classes = classes;
    if (isClassTeacher) staff.isClassTeacher = isClassTeacher;

    // Save the updated staff member
    await staff.save();

    // Respond with the updated staff data
    res.status(StatusCodes.OK).json({ staff });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Helper function to remove subject from the previous teacher's lists
const removeSubjectFromPreviousTeacher = async (subject, previousTeacherId) => {
  const previousTeacher = await Staff.findById(previousTeacherId);
  if (previousTeacher) {
    // Remove the subject from the previous teacher's subjects list
    previousTeacher.subjects = previousTeacher.subjects.filter(
      (subjId) => subjId.toString() !== subject._id.toString(),
    );

    // Check if the previous teacher is still assigned to other subjects for this class
    const otherSubjects = await Subject.find({
      classId: subject.classId,
      subjectTeachers: previousTeacherId,
      _id: { $ne: subject._id }, // Exclude the current subject
    });

    // If the previous teacher is not teaching any other subjects for this class, remove the class from their classes list
    if (otherSubjects.length === 0) {
      previousTeacher.classes = previousTeacher.classes.filter(
        (clsId) => clsId.toString() !== subject.classId.toString(),
      );
    }

    await previousTeacher.save();

    // Now, handle class.subjectTeachers
    const assignedClass = await Class.findById(subject.classId);
    if (assignedClass) {
      // Remove the teacher from the class's subjectTeachers list if they are not teaching any other subjects for that class
      assignedClass.subjectTeachers = assignedClass.subjectTeachers.filter(
        (teacherId) => teacherId.toString() !== previousTeacherId.toString(),
      );

      await assignedClass.save();
    }
  }
};

// Update staff status
export const updateStaffStatus = async (req, res) => {
  try {
    const { id: staffId } = req.params;
    const { status } = req.body; // Status to update (active or inactive)

    // Ensure status is valid
    if (!["active", "inactive"].includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Invalid status. Allowed values are 'active' or 'inactive'.",
      });
    }

    // Find the staff member
    const staff = await Staff.findById(staffId);

    if (!staff) {
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }

    // Update the staff status
    staff.status = status;
    await staff.save();

    res.status(StatusCodes.OK).json({
      message: `Staff status updated to '${status}'.`,
      staff,
    });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Controller to delete a staff member (Only admin can delete staff members)
export const deleteStaff = async (req, res) => {
  try {
    const { id: staffId } = req.params;

    // Find the staff member by ID
    const staff = await Staff.findOne({ _id: staffId });
    if (!staff) {
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }

    // Ensure only admins can delete a staff member
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can delete staff members.");
    }

    // Find any classes where the staff member is a class teacher
    const classTeacher = await Class.findOne({ classTeacher: staffId });

    // If found, remove the staff from being the class teacher
    if (classTeacher) {
      classTeacher.classTeacher = null; // Remove the staff from being the class teacher
      await classTeacher.save();
    }

    // Find all subjects where the staff member is a subject teacher
    const subjects = await Subject.find({ subjectTeachers: staffId });

    // Remove the staff from being a subject teacher in each subject
    await Promise.all(
      subjects.map(async (subject) => {
        // Remove staffId from subjectTeachers
        subject.subjectTeachers = subject.subjectTeachers.filter(
          (teacherId) => teacherId.toString() !== staffId.toString(),
        );

        // Find the class for the subject and remove the staff from class.subjectTeachers
        const classId = subject.classId; // Assuming classId is stored in the subject
        const subjectClass = await Class.findById(classId);

        if (subjectClass) {
          subjectClass.subjectTeachers = subjectClass.subjectTeachers.filter(
            (teacherId) => teacherId.toString() !== staffId.toString(),
          );
          await subjectClass.save(); // Save the updated class
        }

        return subject.save(); // Save the updated subject
      }),
    );

    // Now delete the staff member
    await staff.deleteOne();

    res.status(StatusCodes.OK).json({
      msg: "Staff member deleted successfully and references updated",
    });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

/*export const deleteAllStaff = async (req, res) => {
  try {
    // Step 1: Find all staff members
    const staffMembers = await Staff.find();

    // Step 2: Loop through each staff member and clean up references
    for (const staff of staffMembers) {
      // Remove from classTeacher field in Class model
      const classTeacher = await Class.findOne({ classTeacher: staff._id });
      if (classTeacher) {
        classTeacher.classTeacher = null;
        await classTeacher.save();
      }

      // Remove from subjectTeachers array in Subject model
      const subjects = await Subject.find({ subjectTeachers: staff._id });
      for (const subject of subjects) {
        subject.subjectTeachers = subject.subjectTeachers.filter(
          (teacherId) => teacherId.toString() !== staff._id.toString(),
        );
        await subject.save();
      }
    }

    // Step 3: Delete all staff members
    await Staff.deleteMany();

    // Step 4: Return success response
    res.status(StatusCodes.OK).json({
      msg: "All staff members deleted successfully and references cleaned up",
    });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};*/

/*export const deleteAllStaff = async (req, res) => {
  try {
    // Step 1: Find all staff members
    const staffMembers = await Staff.find();

    // Step 2: Loop through each staff member and clean up references
    for (const staff of staffMembers) {
      // Remove from classTeacher field in Class model
      const classTeacher = await Class.findOne({ classTeacher: staff._id });
      if (classTeacher) {
        classTeacher.classTeacher = undefined; // Change to undefined or another appropriate value
        await classTeacher.save();
      }

      // Remove from subjectTeachers array in Subject model
      const subjects = await Subject.find({ subjectTeachers: staff._id });
      for (const subject of subjects) {
        subject.subjectTeachers = subject.subjectTeachers.filter(
          (teacherId) => teacherId.toString() !== staff._id.toString(),
        );
        await subject.save();
      }
    }

    // Step 3: Delete all staff members
    await Staff.deleteMany();

    // Step 4: Return success response
    res.status(StatusCodes.OK).json({
      msg: "All staff members deleted successfully and references cleaned up",
    });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};*/

// Controller to delete all staff members (Only admin can delete all staff)
export const deleteAllStaff = async (req, res) => {
  try {
    // Ensure only admins can delete all staff members
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can delete all staff members.");
    }

    // Delete all staff records
    await Staff.deleteMany({}); // This will delete all staff members from the database

    res.status(StatusCodes.OK).json({
      msg: "All staff members deleted successfully.",
    });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};
