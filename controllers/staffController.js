import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import Attendance from "../models/AttendanceModel.js"; // Ensure Attendance model is imported
import Class from "../models/ClassModel.js"; // Import the Class model
import Staff from "../models/StaffModel.js"; // Ensure to import the Staff model
import Student from "../models/StudentModel.js";
import Subject from "../models/SubjectModel.js"; // Import the Subject model
import calculateAge from "../utils/ageCalculate.js";
import {
  getCurrentTermDetails,
  holidayDurationForEachTerm,
  startTermGenerationDate,
} from "../utils/termGenerator.js";

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

    // Build the query for Staff root fields
    const staffQuery = {};
    if (status) staffQuery.status = status;
    if (staff) {
      staffQuery.$or = [
        { firstName: { $regex: staff, $options: "i" } },
        { middleName: { $regex: staff, $options: "i" } },
        { lastName: { $regex: staff, $options: "i" } },
        { employeeId: { $regex: staff, $options: "i" } },
      ];
    }

    // Pagination and sorting
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "a-z": { firstName: 1 },
      "z-a": { firstName: -1 },
    };
    const sortKey = sortOptions[sort] || sortOptions.newest;

    // Query staff and filter teacherRcords for the requested term/session
    const staffs = await Staff.find(staffQuery)
      .select("-password")
      .sort(sortKey)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .lean();

    // Filter teacherRcords for each staff for the requested term/session
    const filteredStaffs = await Promise.all(
      staffs.map(async (staff) => {
        let filteredTeacherRcords = staff.teacherRcords || [];
        if (term || session) {
          filteredTeacherRcords = filteredTeacherRcords.filter((rec) => {
            const termMatch = term ? rec.term === term : true;
            const sessionMatch = session ? rec.session === session : true;
            return termMatch && sessionMatch;
          });
        }
        // Populate subject and class details for each teacherRecord
        const populatedTeacherRcords = await Promise.all(
          filteredTeacherRcords.map(async (rec) => {
            // Populate subjects
            let subjects = [];
            if (Array.isArray(rec.subjects) && rec.subjects.length > 0) {
              subjects = await Subject.find({
                _id: { $in: rec.subjects },
              }).select("_id subjectName subjectCode");
            }
            // Populate classes
            let classes = [];
            if (Array.isArray(rec.classes) && rec.classes.length > 0) {
              classes = await Class.find({ _id: { $in: rec.classes } }).select(
                "_id className",
              );
            }
            const classDetails = classes.map((cls) => ({
              _id: cls._id,
              className: cls.className,
            }));
            // Populate students for teacherRecord.students
            let students = [];
            if (Array.isArray(rec.students) && rec.students.length > 0) {
              students = await Student.find({
                _id: { $in: rec.students },
              }).select("_id firstName lastName");
            }
            return {
              ...rec,
              subjects: subjects.map((subj) => ({
                _id: subj._id,
                subjectName: subj.subjectName,
                subjectCode: subj.subjectCode,
              })),
              classes: classDetails,
              students: students.map((stu) => ({
                _id: stu._id,
                firstName: stu.firstName,
                lastName: stu.lastName,
              })),
            };
          }),
        );
        return {
          _id: staff._id,
          firstName: staff.firstName,
          middleName: staff.middleName,
          lastName: staff.lastName,
          employeeId: staff.employeeID,
          role: staff.role,
          status: staff.status,
          createdAt: staff.createdAt,
          teacherRcords: populatedTeacherRcords,
        };
      }),
    );

    // Count total matching documents for pagination
    const totalStaffs = await Staff.countDocuments(staffQuery);
    const numOfPages = Math.ceil(totalStaffs / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalStaffs,
      numOfPages,
      currentPage: pageNumber,
      staffs: filteredStaffs,
    });
  } catch (error) {
    console.log("Error getting all staff:", error);
    next(new InternalServerError(error.message));
  }
};

export const getStaffById = async (req, res, next) => {
  try {
    const { staffId } = req.params;

    const staff = await Staff.findOne({ _id: staffId }).select("-password");
    /*       .populate([
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
      ]); */

    if (!staff) throw new NotFoundError(`Staff member not found`);
    res.status(StatusCodes.OK).json(staff);
  } catch (error) {
    console.log("Error getting staff by ID:", error);
    next(new BadRequestError(error.message));
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const {
      firstName,
      middleName,
      lastName,
      houseNumber,
      streetName,
      townOrCity,
      phoneNumber,
      dateOfBirth,
      gender,
      email,
      role,
      department,
      // Note: subjects, classes, and students are not root-level fields in Staff; they are part of teacherRcords (see staffSchema)
      subjects,
      classes,
      students,
      term,
      session,
      isClassTeacher,
    } = req.body;

    // Find the staff member in the database by their ID
    const staff = await Staff.findOne({ _id: staffId }).select("-password");
    if (!staff) {
      throw new NotFoundError(`Staff member not found`);
    }

    // Ensure term and session are set, fallback to current if missing
    let effectiveTerm = term;
    let effectiveSession = session;
    if (!effectiveTerm || !effectiveSession) {
      const termDetails = getCurrentTermDetails(
        startTermGenerationDate,
        holidayDurationForEachTerm,
      );
      effectiveTerm = term || termDetails.term;
      effectiveSession = session || termDetails.session;
    }

    // Find the teacherRcords entry for this term/session
    let teacherRecord = staff.teacherRcords.find(
      (rec) => rec.term === effectiveTerm && rec.session === effectiveSession,
    );
    if (!teacherRecord) {
      throw new NotFoundError(
        `No teacher record found for ${effectiveTerm} term, ${effectiveSession} session`,
      );
    }

    // --- Handle class teacher assignment (term/session-specific) ---
    if (isClassTeacher) {
      const newClass = await Class.findById(isClassTeacher);
      if (!newClass) {
        throw new NotFoundError("Assigned class not found for class teacher");
      }
      // Remove previous class teacher assignment for this term/session
      if (
        teacherRecord.isClassTeacher &&
        teacherRecord.isClassTeacher.toString() !== isClassTeacher.toString()
      ) {
        const oldClass = await Class.findById(teacherRecord.isClassTeacher);
        if (oldClass) {
          oldClass.classTeacher = null;
          await oldClass.save();
        }
        teacherRecord.isClassTeacher = undefined;
      }
      // Reassign class teacher if another teacher was previously assigned to this class
      const previousTeacherId = newClass.classTeacher;
      if (
        previousTeacherId &&
        previousTeacherId.toString() !== staff._id.toString()
      ) {
        const previousTeacher = await Staff.findById(previousTeacherId);
        if (previousTeacher) {
          // Remove class teacher assignment for this term/session from previous teacher
          const prevRec = previousTeacher.teacherRcords.find(
            (rec) => rec.term === term && rec.session === session,
          );
          if (prevRec) {
            prevRec.isClassTeacher = undefined;
            // Remove class from classes array if present
            prevRec.classes =
              prevRec.classes?.filter(
                (cid) => cid.toString() !== newClass._id.toString(),
              ) || [];
            // Remove subjects for this class from previous teacher for this term/session
            if (prevRec.subjects && prevRec.subjects.length > 0) {
              const classSubjects = await Subject.find({
                classId: newClass._id,
                term,
                session,
              });
              prevRec.subjects = prevRec.subjects.filter(
                (subjId) =>
                  !classSubjects.some((subj) => subj._id.equals(subjId)),
              );
            }
          }
          await previousTeacher.save();
        }
      }
      // Assign current staff as the new class teacher for this term/session
      newClass.classTeacher = staff._id;
      await newClass.save();
      teacherRecord.isClassTeacher = newClass._id;
      // Add class to classes array if not present
      if (
        !teacherRecord.classes.some(
          (cid) => cid.toString() === newClass._id.toString(),
        )
      ) {
        teacherRecord.classes.push(newClass._id);
      }
      // Assign subjects for this class (if provided)
      if (Array.isArray(subjects) && subjects.length > 0) {
        const classSubjects = await Subject.find({
          classId: newClass._id,
          term,
          session,
        });
        const specifiedSubjects = classSubjects.filter((subject) =>
          subjects.includes(subject._id.toString()),
        );
        // Assign the staff member to each specified subject
        for (const subject of specifiedSubjects) {
          subject.subjectTeachers = [staff._id];
          await subject.save();
        }
        teacherRecord.subjects = specifiedSubjects.map((subj) => subj._id);
        staff.markModified("teacherRcords");
      }
      // Update attendance records with new class teacher ID if isClassTeacher changes
      await Attendance.updateMany(
        { classId: newClass._id, date: { $gte: new Date() } },
        { $set: { classTeacher: staff._id } },
      );
    }

    // --- Handle subject/class assignments for subject teachers (term/session-specific) ---
    if (Array.isArray(subjects) && subjects.length > 0 && !isClassTeacher) {
      for (const subjectId of subjects) {
        const subject = await Subject.findById(subjectId);
        if (!subject) {
          throw new NotFoundError("Subject not found");
        }
        // Remove this subject from all other teachers' teacherRcords for this term/session
        const previousTeachers = await Staff.find({
          "teacherRcords.subjects": subjectId,
          "teacherRcords.term": term,
          "teacherRcords.session": session,
        });
        for (const previousTeacher of previousTeachers) {
          const prevRec = previousTeacher.teacherRcords.find(
            (rec) => rec.term === term && rec.session === session,
          );
          if (prevRec) {
            // Ensure prevRec.subjects is always an array
            prevRec.subjects = Array.isArray(prevRec.subjects)
              ? prevRec.subjects.filter(
                  (subjId) => subjId.toString() !== subjectId.toString(),
                )
              : [];
            // Remove class if no more subjects for this class
            const classSubjects = await Subject.find({
              classId: subject.classId,
              _id: { $in: prevRec.subjects },
              term,
              session,
            });
            if (classSubjects.length === 0) {
              prevRec.classes = Array.isArray(prevRec.classes)
                ? prevRec.classes.filter(
                    (cid) => cid.toString() !== subject.classId.toString(),
                  )
                : [];
            }
          }
          await previousTeacher.save();
        }
        // Assign the new teacher to this subject
        subject.subjectTeachers = [staff._id];
        await subject.save();
        // Add the subject to the teacherRecord if not already included
        if (
          !Array.isArray(teacherRecord.subjects) ||
          !teacherRecord.subjects.some(
            (sid) => sid.toString() === subject._id.toString(),
          )
        ) {
          teacherRecord.subjects = Array.isArray(teacherRecord.subjects)
            ? [...teacherRecord.subjects, subject._id]
            : [subject._id];
          staff.markModified("teacherRcords");
        }
        // Add the class to the teacherRecord if not already present
        if (
          !Array.isArray(teacherRecord.classes) ||
          !teacherRecord.classes.some(
            (cid) => cid.toString() === subject.classId.toString(),
          )
        ) {
          teacherRecord.classes = Array.isArray(teacherRecord.classes)
            ? [...teacherRecord.classes, subject.classId]
            : [subject.classId];
        }
      }
    }

    // Optionally update classes and students if provided (and not handled above)
    // Only update teacherRecord.classes if classes is present and is an array
    if (Array.isArray(classes) && classes.length > 0) {
      teacherRecord.classes = classes;
      staff.markModified("teacherRcords");
    }
    // Only update teacherRecord.students if students is present and is an array
    if (Array.isArray(students) && students.length > 0) {
      teacherRecord.students = students;
      staff.markModified("teacherRcords");
    }

    // Filter classes with active subjects for the current term/session
    const validClasses = [];
    for (const classId of teacherRecord.classes) {
      const classSubjects = await Subject.find({
        classId,
        _id: { $in: teacherRecord.subjects },
        term,
        session,
      });
      if (classSubjects.length > 0) {
        validClasses.push(classId);
      }
    }
    teacherRecord.classes = validClasses;

    // If teacherRcords is provided in the request body, update the nested array directly
    if (Array.isArray(req.body.teacherRcords)) {
      // Ensure every record in the incoming array has term and session
      for (const rec of req.body.teacherRcords) {
        if (!rec.term || !rec.session) {
          throw new BadRequestError(
            "Each teacherRcords entry must include term and session",
          );
        }
      }
      // For each incoming record, preserve all existing fields for the same term/session if not set in the incoming data
      const incomingRecords = req.body.teacherRcords.map((rec) => {
        const existingRec = staff.teacherRcords.find(
          (r) => r.term === rec.term && r.session === rec.session,
        );
        if (existingRec) {
          // For each field in the existing record, if not set in incoming, copy it
          const merged = { ...existingRec, ...rec };
          for (const key of Object.keys(existingRec)) {
            if (rec[key] === undefined) {
              merged[key] = existingRec[key];
            }
          }
          return merged;
        }
        return rec;
      });
      staff.teacherRcords = incomingRecords;
      staff.markModified("teacherRcords");
      // Optionally update root-level fields if provided
      if (firstName) staff.firstName = firstName;
      if (middleName) staff.middleName = middleName;
      if (lastName) staff.lastName = lastName;
      if (houseNumber) staff.houseNumber = houseNumber;
      if (streetName) staff.streetName = streetName;
      if (townOrCity) staff.townOrCity = townOrCity;
      if (phoneNumber) staff.phoneNumber = phoneNumber;
      if (dateOfBirth) {
        staff.dateOfBirth = dateOfBirth;
        staff.age = calculateAge(dateOfBirth);
      }
      if (gender) staff.gender = gender;
      if (email) staff.email = email;
      if (role) staff.role = role;
      if (department) staff.department = department;
      await staff.save();
      const populatedStaffUpdate = await Staff.findById(staff._id)
        .select("-password")
        .populate({
          path: "teacherRcords.subjects",
          select: "_id subjectName subjectCode",
        })
        .populate({
          path: "teacherRcords.classes",
          select: "_id className",
          populate: { path: "students", select: "_id firstName" },
        })
        .populate({
          path: "teacherRcords.isClassTeacher",
          select: "_id className students",
          populate: { path: "students", select: "_id firstName" },
        });
      return res
        .status(StatusCodes.OK)
        .json({ message: "Staff updated successfully", populatedStaffUpdate });
    }

    // PATCH a single teacherRcords entry if teacherRcordsPatch is provided
    if (
      req.body.teacherRcordsPatch &&
      typeof req.body.teacherRcordsPatch === "object"
    ) {
      const {
        term: patchTerm,
        session: patchSession,
        ...patchFields
      } = req.body.teacherRcordsPatch;
      if (!patchTerm || !patchSession) {
        throw new BadRequestError(
          "teacherRcordsPatch must include term and session",
        );
      }
      const recordToPatch = staff.teacherRcords.find(
        (rec) => rec.term === patchTerm && rec.session === patchSession,
      );
      if (!recordToPatch) {
        throw new NotFoundError(
          `No teacher record found for ${patchTerm} term, ${patchSession} session`,
        );
      }
      // Only update fields present in patchFields
      for (const [key, value] of Object.entries(patchFields)) {
        if (Array.isArray(recordToPatch[key]) && Array.isArray(value)) {
          recordToPatch[key] = value;
        } else if (value !== undefined) {
          recordToPatch[key] = value;
        }
      }
      staff.markModified("teacherRcords");
      await staff.save();
      const populatedStaffUpdate = await Staff.findById(staff._id)
        .select("-password")
        .populate({
          path: "teacherRcords.subjects",
          select: "_id subjectName subjectCode",
        })
        .populate({
          path: "teacherRcords.classes",
          select: "_id className",
          populate: { path: "students", select: "_id firstName" },
        })
        .populate({
          path: "teacherRcords.isClassTeacher",
          select: "_id className students",
          populate: { path: "students", select: "_id firstName" },
        });
      return res
        .status(StatusCodes.OK)
        .json({ message: "Staff updated successfully", populatedStaffUpdate });
    }

    // Update non-teaching root-level fields only
    // Defensive: ensure dateOfBirth is defined before using calculateAge
    if (dateOfBirth) {
      staff.age = calculateAge(dateOfBirth);
    }
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
    // Do not update root-level teaching assignments (subjects, classes, isClassTeacher)

    await staff.save();

    // Populate the updated teacherRecord for response
    const populatedStaffUpdate = await Staff.findById(staff._id)
      .select("-password")
      .populate({
        path: "teacherRcords.subjects",
        select: "_id subjectName subjectCode",
      })
      .populate({
        path: "teacherRcords.classes",
        select: "_id className",
        populate: { path: "students", select: "_id firstName" },
      })
      .populate({
        path: "teacherRcords.isClassTeacher",
        select: "_id className students",
        populate: { path: "students", select: "_id firstName" },
      });

    res
      .status(StatusCodes.OK)
      .json({ message: "Staff updated successfully", populatedStaffUpdate });
  } catch (error) {
    console.log("Error updating staff: ", error);
    next(new BadRequestError(error.message));
  }
};

// Update staff status
export const updateStaffStatus = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const { status } = req.body; // Status to update (active or inactive)

    // Ensure status is valid
    if (!["active", "inactive"].includes(status)) {
      throw new BadRequestError(
        "Invalid status. Allowed values are 'active' or 'inactive'.",
      );
    }

    // Find the staff member
    const staff = await Staff.findById(staffId);

    if (!staff) {
      throw new NotFoundError(`Staff member not found`);
    }

    // Update the staff status
    staff.status = status;
    await staff.save();

    res.status(StatusCodes.OK).json({
      message: `Staff status updated to '${status}'.`,
      staff,
    });
  } catch (error) {
    console.log("Error updating staff status:", error);
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
        "Only admin or proprietor can update staff verification status",
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
    console.log("Error updating staff verification:", error);
    next(new InternalServerError(error.message));
  }
};

export const deleteStaff = async (req, res, next) => {
  try {
    const { staffId } = req.params;

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
    console.log("Error deleting staff:", error);
    next(new BadRequestError(error.message));
  }
};

// Controller to delete all staff members (Only admin can delete all staff)
export const deleteAllStaff = async (req, res, next) => {
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
    console.log("Error deleting all staff:", error);
    next(new BadRequestError(error.message));
  }
};

export const changeClassTeacher = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const { isClassTeacher, subjects } = req.body;

    // Always use current term/session
    const termDetails = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );
    const term = termDetails.term;
    const session = termDetails.session;

    // Find the staff member in the database by their ID
    const staff = await Staff.findOne({ _id: staffId }).select("-password");
    if (!staff) {
      throw new NotFoundError(`Staff member not found`);
    }

    // Find the teacherRcords entry for this term/session
    let teacherRecord = staff.teacherRcords.find(
      (rec) => rec.term === term && rec.session === session,
    );
    if (!teacherRecord) {
      throw new NotFoundError(
        `No teacher record found for ${term} term, ${session} session`,
      );
    }

    if ((isClassTeacher && subjects) || isClassTeacher) {
      if (
        isClassTeacher &&
        (!teacherRecord.isClassTeacher ||
          isClassTeacher.toString() !== teacherRecord.isClassTeacher.toString())
      ) {
        // Handle class teacher reassignment if `isClassTeacher` is different from the current assignment
        const newClass = await Class.findById(isClassTeacher);
        if (!newClass) {
          throw new NotFoundError("Assigned class not found for class teacher");
        }
        // Clear previous class teacher assignment if the staff was assigned to another class in this term/session
        if (teacherRecord.isClassTeacher) {
          const oldClass = await Class.findById(teacherRecord.isClassTeacher);
          if (oldClass) {
            oldClass.classTeacher = null;
            await oldClass.save();
            // Remove subjects for old class from this teacherRecord
            if (subjects && subjects.length > 0) {
              teacherRecord.subjects = teacherRecord.subjects.filter(
                (subjectId) => !subjects.includes(subjectId.toString()),
              );
            } else {
              const oldClassSubjects = await Subject.find({
                classId: oldClass._id,
                term,
                session,
              });
              teacherRecord.subjects = teacherRecord.subjects.filter(
                (subjectId) =>
                  !oldClassSubjects.some((subj) => subj._id.equals(subjectId)),
              );
            }
            // Remove class from teacherRecord.classes if no relevant subjects remain
            const remainingSubjects = await Subject.find({
              classId: oldClass._id,
              _id: { $in: teacherRecord.subjects },
              term,
              session,
            });
            if (remainingSubjects.length === 0) {
              teacherRecord.classes = teacherRecord.classes.filter(
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
            // Remove isClassTeacher for this term/session in previous teacher's teacherRcords
            let prevTeacherRecord = previousTeacher.teacherRcords.find(
              (rec) => rec.term === term && rec.session === session,
            );
            if (prevTeacherRecord) {
              prevTeacherRecord.isClassTeacher = null;
              if (subjects && subjects.length > 0) {
                prevTeacherRecord.subjects = prevTeacherRecord.subjects.filter(
                  (subjId) => !subjects.includes(subjId.toString()),
                );
              } else {
                const newClassSubjects = await Subject.find({
                  classId: newClass._id,
                  term,
                  session,
                });
                prevTeacherRecord.subjects = prevTeacherRecord.subjects.filter(
                  (subjId) =>
                    !newClassSubjects.some((subj) => subj._id.equals(subjId)),
                );
              }
              // Remove class from previous teacher's teacherRecord.classes if no relevant subjects remain
              const remainingSubjects = await Subject.find({
                classId: newClass._id,
                _id: { $in: prevTeacherRecord.subjects },
                term,
                session,
              });
              if (remainingSubjects.length === 0) {
                prevTeacherRecord.classes = prevTeacherRecord.classes.filter(
                  (classId) => classId.toString() !== newClass._id.toString(),
                );
              }
            }
            await previousTeacher.save();
          }
        }
        // Assign current staff as the new class teacher and update relevant assignments
        newClass.classTeacher = staff._id;
        teacherRecord.isClassTeacher = newClass._id;
        if (!teacherRecord.classes.includes(newClass._id.toString())) {
          teacherRecord.classes.push(newClass._id.toString());
        }
        await newClass.save();
        const classSubjects = await Subject.find({
          classId: newClass._id,
          term,
          session,
        });
        const specifiedSubjects = classSubjects.filter((subject) =>
          subjects.includes(subject._id.toString()),
        );
        for (const subject of specifiedSubjects) {
          subject.subjectTeachers = [staff._id];
          await subject.save();
        }
        teacherRecord.subjects = specifiedSubjects.map((subj) => subj._id);
        await Attendance.updateMany(
          { classId: teacherRecord.isClassTeacher, date: { $gte: new Date() } },
          { $set: { classTeacher: staff._id } },
        );
      }
    }
    await staff.save();
    const populatedStaffUpdate = await Staff.findById(staff._id)
      .select("-password")
      .populate([
        { path: "subjects", select: "_id subjectName subjectCode" },
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
    res.status(StatusCodes.OK).json({
      message: "Class teacher changed successfully",
      populatedStaffUpdate,
    });
  } catch (error) {
    console.log("Error changing class teacher: ", error);
    next(new BadRequestError(error.message));
  }
};

// Controller to roll over teacherRecords for new term/session
export const rolloverTeacherRecords = async (req, res, next) => {
  try {
    // Get new term/session details
    const termDetails = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );
    let newTerm, newSession;
    if (termDetails.isHoliday) {
      newTerm = termDetails.nextTerm;
      if (newTerm === "first") {
        newSession = termDetails.nextSession;
      } else {
        newSession = termDetails.session;
      }
    } else {
      newTerm = termDetails.term;
      if (newTerm === "first") {
        newSession = termDetails.nextSession;
      } else {
        newSession = termDetails.session;
      }
    }

    // Only allow rollover if current term is over (today > endDate) or if no teacher has a record for the new term/session
    const now = new Date();
    const currentTermIsOver = now > new Date(termDetails.endDate);
    const teachersWithNewRecord = await Staff.exists({
      role: "teacher",
      status: "active",
      "teacherRcords.term": newTerm,
      "teacherRcords.session": newSession,
    });
    if (!currentTermIsOver && teachersWithNewRecord) {
      throw new BadRequestError(
        `Rollover not allowed: current term is not over and records for the new term/session already exist.`,
      );
    }

    // Find all active teachers
    const teachers = await Staff.find({ role: "teacher", status: "active" });
    let updated = 0;
    for (const teacher of teachers) {
      // Check if teacherRecord for this term/session already exists
      const alreadyExists =
        teacher.teacherRcords &&
        teacher.teacherRcords.some(
          (rec) => rec.term === newTerm && rec.session === newSession,
        );
      if (alreadyExists) continue;
      let students = [];
      let isClassTeacher = null;
      // If not first term, try to copy students and isClassTeacher from previous term
      if (newTerm !== "first") {
        // Find previous term name
        const prevTerm = newTerm === "second" ? "first" : "second";
        const prevRecord =
          teacher.teacherRcords &&
          teacher.teacherRcords.find(
            (rec) => rec.term === prevTerm && rec.session === newSession,
          );
        if (prevRecord) {
          // Only copy students with status active
          if (prevRecord.students && prevRecord.students.length > 0) {
            const activeStudents = await Student.find({
              _id: { $in: prevRecord.students },
              status: "active",
            }).select("_id");
            students = activeStudents.map((s) => s._id);
          }
          // Only copy isClassTeacher if staff is still active
          if (teacher.status === "active" && prevRecord.isClassTeacher) {
            isClassTeacher = prevRecord.isClassTeacher;
          }
        }
      }
      // Add new teacherRecord for this term/session
      teacher.teacherRcords.push({
        session: newSession,
        term: newTerm,
        isClassTeacher: isClassTeacher || undefined,
        subjects: [],
        classes: [],
        students,
      });
      await teacher.save();
      updated++;
    }
    res.status(StatusCodes.OK).json({
      message: `Teacher records rolled over for new term/session`,
      updated,
      term: newTerm,
      session: newSession,
    });
  } catch (error) {
    console.log("Error in rolloverTeacherRecords:", error);
    next(new BadRequestError(error.message));
  }
};
