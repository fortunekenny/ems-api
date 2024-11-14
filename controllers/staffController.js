import Staff from "../models/StaffModel.js"; // Ensure to import the Staff model
import Class from "../models/ClassModel.js"; // Import the Class model
import Subject from "../models/SubjectModel.js"; // Import the Subject model
import Attendance from "../models/AttendanceModel.js"; // Ensure Attendance model is imported
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import { StatusCodes } from "http-status-codes";
import checkPermissions from "../utils/checkPermissions.js";
import {
  generateCurrentTerm,
  startTermGenerationDate,
  holidayDurationForEachTerm,
  getCurrentSession,
} from "../utils/termGenerator.js"; // Import the term generation function

/* Helper Functions */

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

// Remove all subjects associated with the previous teacher
const removeTeacherSubjects = async (staff, term) => {
  const previousSubjects = await Subject.find({
    _id: { $in: staff.subjects },
    term,
  });
  for (const subject of previousSubjects) {
    await removeSubjectFromPreviousTeacher(subject, staff._id);
  }
};

// Assign all subjects of a class to a new class teacher
const assignNewTeacherSubjects = async (staff, newClass, term) => {
  const classSubjects = await Subject.find({ classId: newClass._id, term });
  for (const subject of classSubjects) {
    subject.subjectTeachers = [staff._id];
    await subject.save();
  }
  staff.subjects = classSubjects.map((subj) => subj._id);
};

// Update staff's subjects if a `subjects` array is provided
const updateStaffSubjects = async (staff, newSubjects, term) => {
  const previousSubjects = await Subject.find({ _id: { $in: staff.subjects } });
  for (const subject of previousSubjects) {
    await removeSubjectFromPreviousTeacher(subject, staff._id);
  }

  // Clear the staff's subjects list and add new subjects
  staff.subjects = [];
  for (const subjectId of newSubjects) {
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
};

// Update staff’s assigned classes if a `classes` array is provided
const updateStaffClasses = async (staff, newClasses) => {
  const previousClasses = await Class.find({ _id: { $in: staff.classes } });
  for (const oldClass of previousClasses) {
    oldClass.teachers.pull(staff._id); // Remove staff from teachers list
    await oldClass.save();
  }

  for (const classId of newClasses) {
    const newAssignedClass = await Class.findById(classId);
    if (newAssignedClass) {
      newAssignedClass.teachers.push(staff._id); // Add staff to new class
      await newAssignedClass.save();
      if (!staff.classes.includes(classId)) {
        staff.classes.push(classId); // Ensure class is in the staff's classes list
      }
    }
  }
};

// Update attendance records to reflect new class teacher if changed
const updateAttendanceClassTeacher = async (staff) => {
  const attendanceUpdateResult = await Attendance.updateMany(
    { classId: staff.isClassTeacher, date: { $gte: new Date() } },
    { $set: { classTeacher: staff._id } },
  );
  console.log(
    `Updated ${attendanceUpdateResult.modifiedCount} attendance records to new classTeacher.`,
  );
};

// Remove subject from previous teacher’s lists and update related classes
const removeSubjectFromPreviousTeacher = async (subject, previousTeacherId) => {
  const previousTeacher = await Staff.findById(previousTeacherId);
  if (previousTeacher) {
    previousTeacher.subjects = previousTeacher.subjects.filter(
      (subjId) => subjId.toString() !== subject._id.toString(),
    );

    const otherSubjects = await Subject.find({
      classId: subject.classId,
      subjectTeachers: previousTeacherId,
      _id: { $ne: subject._id },
    });

    if (otherSubjects.length === 0) {
      previousTeacher.classes = previousTeacher.classes.filter(
        (clsId) => clsId.toString() !== subject.classId.toString(),
      );
    }

    await previousTeacher.save();

    const assignedClass = await Class.findById(subject.classId);
    if (assignedClass) {
      assignedClass.subjectTeachers = assignedClass.subjectTeachers.filter(
        (teacherId) => teacherId.toString() !== previousTeacherId.toString(),
      );
      await assignedClass.save();
    }
  }
};

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

export const getStaffById = async (req, res) => {
  try {
    const { id: staffId } = req.params;
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

    if (!staff)
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    res.status(StatusCodes.OK).json(staff);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

export const updateStaff = async (req, res) => {
  try {
    console.log("Starting staff update process.");

    // Extract staff ID from request parameters and relevant fields from request body
    const { id: staffId } = req.params;
    const { name, email, role, department, subjects, isClassTeacher } =
      req.body;
    console.log(`Received update request for staff ID: ${staffId}`);
    console.log("Request Body:", req.body);

    // Find the staff member in the database by their ID
    const staff = await Staff.findOne({ _id: staffId });
    if (!staff) {
      console.log(`No staff member found with ID ${staffId}`);
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }
    console.log("Staff found:", staff);

    // Determine current term and session based on predefined date functions
    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );
    const session = getCurrentSession();
    console.log(`Current term: ${term}, Current session: ${session}`);

    // Verify that the requesting user has the appropriate permissions for this action
    console.log(`Checking permissions for user ${req.user._id}`);
    checkPermissions(req.user, staff.user);
    console.log("Permissions check passed");

    if ((isClassTeacher && subjects) || isClassTeacher) {
      if (
        isClassTeacher &&
        isClassTeacher !== staff.isClassTeacher?.toString()
      ) {
        // Handle class teacher reassignment if `isClassTeacher` is different from the current assignment
        console.log(`Updating class teacher status for staff ID ${staffId}`);

        // Locate the class to which the staff is being assigned as class teacher
        const newClass = await Class.findById(isClassTeacher);
        if (!newClass) {
          console.log("Assigned class not found for class teacher");
          throw new NotFoundError("Assigned class not found for class teacher");
        }
        console.log(`Assigned class found: ${newClass._id}`);

        // Clear previous class teacher assignment if the staff was assigned to another class
        if (staff.isClassTeacher) {
          console.log(
            `Clearing previous class teacher assignment for class ID ${staff.isClassTeacher}`,
          );
          const oldClass = await Class.findById(staff.isClassTeacher);
          if (oldClass) {
            oldClass.classTeacher = null;
            await oldClass.save();
            console.log(
              `Cleared previous class teacher for class ID ${oldClass._id}`,
            );

            // Update attendance records to remove the previous class teacher's reference
            await Attendance.updateMany(
              {
                classId: oldClass._id,
                classTeacher: staff._id,
                term,
                session: oldClass.session,
              },
              { $set: { classTeacher: null } },
            );
            console.log(
              `Updated attendance records for old class ID ${oldClass._id}`,
            );

            // Remove only the specified subjects from the previous teacher if subjects are provided
            if (subjects && subjects.length > 0) {
              staff.subjects = staff.subjects.filter(
                (subjectId) => !subjects.includes(subjectId.toString()),
              );
              console.log(
                "Updated staff subjects after removing specified subjects:",
                staff.subjects,
              );
            } else {
              const oldClassSubjects = await Subject.find({
                classId: oldClass._id,
                term,
                session: oldClass.session,
              });
              staff.subjects = staff.subjects.filter(
                (subjectId) =>
                  !oldClassSubjects.some((subj) => subj._id.equals(subjectId)),
              );
              console.log(
                "Removed all old class subjects from staff subjects:",
                staff.subjects,
              );
            }

            // Remove the class from `staff.classes` if no relevant subjects remain for this staff
            const remainingSubjects = await Subject.find({
              classId: oldClass._id,
              _id: { $in: staff.subjects },
              term,
              session: oldClass.session,
            });
            if (remainingSubjects.length === 0) {
              staff.classes = staff.classes.filter(
                (classId) => classId.toString() !== oldClass._id.toString(),
              );
              console.log(
                `Removed class ID ${oldClass._id} from staff classes as no relevant subjects remain`,
              );
            }
          }
        }

        // Reassign class teacher if another teacher was previously assigned to this class
        const previousTeacherId = newClass.classTeacher;
        if (
          previousTeacherId &&
          previousTeacherId.toString() !== staff._id.toString()
        ) {
          const previousTeacher = await Staff.findById(previousTeacherId);
          if (previousTeacher) {
            previousTeacher.isClassTeacher = null;

            // Remove only the specified subjects, if any, from the previous teacher
            if (subjects && subjects.length > 0) {
              previousTeacher.subjects = previousTeacher.subjects.filter(
                (subjId) => !subjects.includes(subjId.toString()),
              );
            } else {
              const newClassSubjects = await Subject.find({
                classId: newClass._id,
                term,
                session: newClass.session,
              });
              previousTeacher.subjects = previousTeacher.subjects.filter(
                (subjId) =>
                  !newClassSubjects.some((subj) => subj._id.equals(subjId)),
              );
            }

            // Remove the class from previous teacher's `classes` if no relevant subjects remain
            const remainingSubjects = await Subject.find({
              classId: newClass._id,
              _id: { $in: previousTeacher.subjects },
              term,
              session: newClass.session,
            });
            if (remainingSubjects.length === 0) {
              previousTeacher.classes = previousTeacher.classes.filter(
                (classId) => classId.toString() !== newClass._id.toString(),
              );
            }

            // Update attendance records to remove the previous teacher's reference
            await Attendance.updateMany(
              {
                classId: newClass._id,
                classTeacher: previousTeacherId,
                term,
                session: newClass.session,
              },
              { $set: { classTeacher: null } },
            );
            await previousTeacher.save();
            console.log(
              `Cleared previous class teacher (ID ${previousTeacherId}) for new class ID ${newClass._id}`,
            );
          }
        }

        // Assign current staff as the new class teacher and update relevant assignments
        newClass.classTeacher = staff._id;
        staff.isClassTeacher = newClass._id;

        if (!staff.classes.includes(newClass._id.toString())) {
          staff.classes.push(newClass._id.toString());
        }

        await newClass.save();
        console.log(`Assigned new class teacher to class ID ${newClass._id}`);

        // Retrieve all subjects for the specified class, term, and session
        const classSubjects = await Subject.find({
          classId: newClass._id,
          term,
          session,
        });
        console.log(
          "All subjects found for the class:",
          classSubjects.map((s) => s._id),
        );
        // Filter class subjects to include only those specified in the subjects list from req.body
        const specifiedSubjects = classSubjects.filter((subject) =>
          req.body.subjects.includes(subject._id.toString()),
        );
        console.log(
          "Specified subjects to assign:",
          specifiedSubjects.map((s) => s._id),
        );
        // Assign the staff member to each specified subject
        for (const subject of specifiedSubjects) {
          subject.subjectTeachers = [staff._id];
          await subject.save();
          console.log(
            `Assigned staff ID ${staff._id} to subject ID ${subject._id}`,
          );
        }

        // Update the staff's subjects to include only the specified subjects
        staff.subjects = specifiedSubjects.map((subj) => subj._id);
        console.log("Updated staff's subjects list:", staff.subjects);

        // Update attendance records with new class teacher ID if isClassTeacher changes
        await Attendance.updateMany(
          { classId: staff.isClassTeacher, date: { $gte: new Date() } },
          { $set: { classTeacher: staff._id } },
        );
        console.log(
          `Updated attendance records with new class teacher ID ${staff._id}`,
        );
      }
    }

    // Check if specific subjects were provided in the request to update subject assignments
    if (subjects && subjects.length > 0 && !isClassTeacher) {
      console.log(`Updating subject assignments for staff ID ${staffId}`);

      // Loop through each specified subject to manage reassignment
      for (const subjectId of subjects) {
        const subject = await Subject.findById(subjectId);

        if (!subject) {
          console.log(
            `Subject ID ${subjectId} not found, skipping assignment.`,
          );
          continue;
        }

        // Get the previous teachers for this subject
        const previousTeachers = await Staff.find({ subjects: subjectId });

        for (const previousTeacher of previousTeachers) {
          // Remove subject from previous teacher's subjects list
          previousTeacher.subjects = previousTeacher.subjects.filter(
            (subjId) => subjId.toString() !== subjectId,
          );

          console.log(
            `Removed subject ID ${subjectId} from previous teacher ID ${previousTeacher._id}`,
          );

          // Check if the previous teacher has any other subjects in the same class
          const hasOtherClassSubjects = previousTeacher.subjects.some(
            async (subj) =>
              (await Subject.findById(subj)).classId.toString() ===
              subject.classId.toString(),
          );

          if (!hasOtherClassSubjects) {
            // If no other subjects from the same class, remove the class from staff's classes
            previousTeacher.classes = previousTeacher.classes.filter(
              (classId) => classId.toString() !== subject.classId.toString(),
            );
            console.log(
              `Removed class ID ${subject.classId} from previous teacher ID ${previousTeacher._id}'s class list`,
            );
          }

          // Save the updated previous teacher information
          await previousTeacher.save();
        }

        // Assign the new teacher to this subject
        subject.subjectTeachers = [staff._id];
        await subject.save();
        console.log(
          `Assigned subject ID ${subjectId} to new teacher ID ${staff._id}`,
        );

        // Add the subject to the new teacher's subjects list if not already included
        if (!staff.subjects.includes(subject._id)) {
          staff.subjects.push(subject._id);
          console.log(
            `Added subject ID ${subjectId} to new teacher ID ${staff._id}'s subjects list`,
          );
        }

        // Ensure the class is in the new teacher's classes list if not already present
        if (!staff.classes.includes(subject.classId.toString())) {
          staff.classes.push(subject.classId.toString());
          console.log(
            `Added class ID ${subject.classId} to new teacher ID ${staff._id}'s class list`,
          );
        }
      }

      // Finalize and save the new teacher's updated information
      await staff.save();
      console.log("Finalized subject and class assignments for new teacher:", {
        subjects: staff.subjects,
        classes: staff.classes,
      });
    }

    // Verify term and session values and filter classes with active subjects for the current term and session
    const validClasses = [];
    for (const classId of staff.classes) {
      const classSubjects = await Subject.find({
        classId,
        _id: { $in: staff.subjects },
        term,
        session,
      });
      if (classSubjects.length > 0) {
        validClasses.push(classId);
      }
      console.log(
        `Class ID ${classId} checked: ${
          classSubjects.length > 0 ? "valid" : "not valid"
        }`,
      );
    }

    // Assign filtered classes back to staff and update other fields if provided
    staff.classes = validClasses;
    console.log("Valid classes after filtering:", validClasses);
    if (name) staff.name = name;
    if (email) staff.email = email;
    if (role) staff.role = role;
    if (department) staff.department = department;

    await staff.save();
    console.log(`Successfully updated staff ID ${staffId}`);
    res.status(StatusCodes.OK).json({ staff });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
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

    // Find any class where the staff member is a class teacher
    const classTeacher = await Class.findOne({ classTeacher: staffId });

    // If found, remove the staff from being the class teacher
    if (classTeacher) {
      classTeacher.classTeacher = null; // Remove the staff from being the class teacher
      await classTeacher.save();

      // If staff is a class teacher, remove their attendance records for this class
      if (staff.isClassTeacher) {
        const { term, session } = req.body; // Expect term and session to be provided in the request

        // Find and remove all attendance records for the class where the staff is a class teacher
        const attendances = await Attendance.find({
          classId: classTeacher._id,
          term,
          session,
        });

        // Remove staff from each attendance record
        for (const attendance of attendances) {
          attendance.staff = attendance.staff.filter(
            (attendeeId) => attendeeId.toString() !== staffId.toString(),
          );
          await attendance.save();
        }
        console.log(`Removed staff ID ${staffId} from attendance records`);
      }
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
