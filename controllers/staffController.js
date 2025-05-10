import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import Attendance from "../models/AttendanceModel.js"; // Ensure Attendance model is imported
import Class from "../models/ClassModel.js"; // Import the Class model
import Staff from "../models/StaffModel.js"; // Ensure to import the Staff model
import Subject from "../models/SubjectModel.js"; // Import the Subject model
import calculateAge from "../utils/ageCalculate.js";
import InternalServerError from "../errors/internal-server-error.js";

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

export const getStaff = async (req, res, next) => {
  try {
    // Define allowed query parameters
    const allowedFilters = [
      "staff", // combined filter for firstName, middleName, lastName, employeeId
      "term",
      "session",
      "status",
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

    const { staff, status, term, session, sort, page, limit } = req.query;

    // Build an initial match stage for fields stored directly on Assignment
    const matchStage = {};

    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;
    if (status) matchStage.status = status;

    // Here we use $or on firstName, middleName, lastName, and employeeId if the 'staff' parameter is provided.
    if (staff) {
      matchStage.$or = [
        { firstName: { $regex: staff, $options: "i" } },
        { middleName: { $regex: staff, $options: "i" } },
        { lastName: { $regex: staff, $options: "i" } },
        { employeeId: { $regex: staff, $options: "i" } },
      ];
    }

    const pipeline = [];
    pipeline.push({ $match: matchStage });

    // Build additional matching criteria based on joined fields.
    const joinMatch = {};

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
        firstName: 1,
        middleName: 1,
        lastName: 1,
        employeeId: 1,
        status: 1,
        term: 1,
        session: 1,
        createdAt: 1,
        // Include other fields from Assignment if needed.
      },
    });

    // Execute the aggregation pipeline
    const staffs = await Staff.aggregate(pipeline);

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
    const countResult = await Staff.aggregate(countPipeline);
    const totalStaffs = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalStaffs / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalStaffs,
      numOfPages,
      currentPage: pageNumber,
      staffs,
    });
  } catch (error) {
    console.error("Error getting all staff:", error);
    next(new InternalServerError(error.message));
  }
};

export const getStaffById = async (req, res) => {
  try {
    const { id: staffId } = req.params;
    const staff = await Staff.findOne({ _id: staffId })
      .select("-password")
      .populate([
        {
          path: "subjects",
          select: "_id subjectName subjectCode",
        },
        {
          path: "classes",
          select: "_id className students",
          populate: [{ path: "students", select: "_id firstName" }],
        },
        {
          path: "isClassTeacher",
          select: "_id className students",
          populate: [{ path: "students", select: "_id firstName" }],
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

export const updateStaff = async (req, res, next) => {
  try {
    const { id: staffId } = req.params;

    const {
      firstName,
      middleName,
      lastName,
      houseNumber,
      streetName,
      townOrCity,
      phoneNumber,
      dateOfBirth,
      // age,
      gender,
      email,
      role,
      department,
      subjects,
      classes,
      term,
      session,
      isClassTeacher,
    } = req.body;

    // Find the staff member in the database by their ID
    const staff = await Staff.findOne({ _id: staffId }).select("-password");
    if (!staff) {
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }
    // Determine current term and session based on predefined date functions

    // const { term, session, startDate, endDate } = getCurrentTermDetails(
    //   startTermGenerationDate,
    //   holidayDurationForEachTerm,
    // );
    // const term = generateCurrentTerm(
    //   startTermGenerationDate,
    //   holidayDurationForEachTerm,
    // );
    // const session = getCurrentSession();
    // console.log(`Current term: ${term}, Current session: ${session}`);

    // Verify that the requesting user has the appropriate permissions for this action
    // console.log(`Checking permissions for user ${req.user._id}`);
    // checkPermissions(req.user, staff.user);
    // console.log("Permissions check passed");

    if ((isClassTeacher && subjects) || isClassTeacher) {
      if (
        isClassTeacher &&
        isClassTeacher !== staff.isClassTeacher?.toString()
      ) {
        // Handle class teacher reassignment if `isClassTeacher` is different from the current assignment

        // Locate the class to which the staff is being assigned as class teacher
        const newClass = await Class.findById(isClassTeacher);
        if (!newClass) {
          throw new NotFoundError("Assigned class not found for class teacher");
        }

        // Clear previous class teacher assignment if the staff was assigned to another class
        if (staff.isClassTeacher) {
          const oldClass = await Class.findById(staff.isClassTeacher);
          if (oldClass) {
            oldClass.classTeacher = null;
            await oldClass.save();

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

            // Remove only the specified subjects from the previous teacher if subjects are provided
            if (subjects && subjects.length > 0) {
              staff.subjects = staff.subjects.filter(
                (subjectId) => !subjects.includes(subjectId.toString()),
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
          }
        }

        // Assign current staff as the new class teacher and update relevant assignments
        newClass.classTeacher = staff._id;
        staff.isClassTeacher = newClass._id;

        if (!staff.classes.includes(newClass._id.toString())) {
          staff.classes.push(newClass._id.toString());
        }

        await newClass.save();

        // Retrieve all subjects for the specified class, term, and session
        const classSubjects = await Subject.find({
          classId: newClass._id,
          term,
          session,
        });

        // Filter class subjects to include only those specified in the subjects list from req.body

        const specifiedSubjects = classSubjects.filter((subject) =>
          req.body.subjects.includes(subject._id.toString()),
        );

        // Assign the staff member to each specified subject
        for (const subject of specifiedSubjects) {
          subject.subjectTeachers = [staff._id];
          await subject.save();
        }

        // Update the staff's subjects to include only the specified subjects
        staff.subjects = specifiedSubjects.map((subj) => subj._id);

        // Update attendance records with new class teacher ID if isClassTeacher changes
        await Attendance.updateMany(
          { classId: staff.isClassTeacher, date: { $gte: new Date() } },
          { $set: { classTeacher: staff._id } },
        );
      }
    }

    // Check if specific subjects were provided in the request to update subject assignments
    if (subjects && subjects.length > 0 && !isClassTeacher) {
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
          }

          // Save the updated previous teacher information
          await previousTeacher.save();
        }

        // Assign the new teacher to this subject
        subject.subjectTeachers = [staff._id];
        await subject.save();

        // Add the subject to the new teacher's subjects list if not already included
        if (!staff.subjects.includes(subject._id)) {
          staff.subjects.push(subject._id);
        }

        // Ensure the class is in the new teacher's classes list if not already present
        if (!staff.classes.includes(subject.classId.toString())) {
          staff.classes.push(subject.classId.toString());
        }
      }

      // Finalize and save the new teacher's updated information
      await staff.save();
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
    }

    // Assign filtered classes back to staff and update other fields if provided
    staff.classes = validClasses;
    // console.log("Valid classes after filtering:", validClasses);
    // if (name) staff.name = name;
    staff.age = calculateAge(dateOfBirth);
    if (email) staff.email = email;
    if (role) staff.role = role;
    if (firstName) staff.firstName = firstName;
    if (middleName) staff.middleName = middleName;
    if (lastName) staff.lastName = lastName;
    if (houseNumber) staff.houseNumber = houseNumber;
    if (department) staff.department = department;
    if (streetName) staff.streetName = streetName;
    if (townOrCity) staff.townOrCity = townOrCity;
    if (phoneNumber) staff.phoneNumber = phoneNumber;
    if (dateOfBirth) staff.dateOfBirth = dateOfBirth;
    if (gender) staff.gender = gender;
    if (subjects) staff.subjects = subjects;
    if (classes) staff.classes = classes;
    if (isClassTeacher) staff.isClassTeacher = isClassTeacher;

    await staff.save();

    const populatedStaffUpdate = await Staff.findById(staff._id)
      .select("-password")
      .populate([
        {
          path: "subjects",
          select: "_id subjectName subjectCode",
        },
        {
          path: "classes",
          select: "_id className",
          populate: [{ path: "students", select: "_id firstName" }],
        },
        {
          path: "isClassTeacher",
          select: "_id className students",
          populate: [{ path: "students", select: "_id firstName" }],
        },
      ]);

    res
      .status(StatusCodes.OK)
      .json({ message: "Staff updated successfully", populatedStaffUpdate });
  } catch (error) {
    console.error("Error updating staff: ", error);
    next(new BadRequestError(error.message));
  }
};

// Update staff status
export const updateStaffStatus = async (req, res, next) => {
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
    console.error("Error updating staff status:", error);
    next(new BadRequestError(error.message));
  }
};

export const updateStaffVerification = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const { isVerified } = req.body;
    const { role } = req.user;

    // Only admin or proprietor allowed
    if (role !== "admin" && role !== "proprietor") {
      throw new UnauthorizedError(
        "Only admin or proprietor can update student verification status",
      );
    }

    if (typeof isVerified !== "boolean") {
      throw new BadRequestError("isVerified must be a boolean");
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      throw new NotFoundError(`Staff not found`);
    }

    if (staff.isVerified === isVerified) {
      throw new BadRequestError(
        `Staff verification status is already '${isVerified}'`,
      );
    }

    staff.isVerified = isVerified;
    await staff.save();

    res.status(StatusCodes.OK).json({
      message: `Staff verification status updated to '${isVerified}'`,
    });
  } catch (error) {
    console.error("Error updating staff verification:", error);
    next(new InternalServerError(error.message));
  }
};

export const deleteStaff = async (req, res, next) => {
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
        // console.log(`Removed staff ID ${staffId} from attendance records`);
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
    console.error("Error deleting staff:", error);
    next(new BadRequestError(error.message));
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
