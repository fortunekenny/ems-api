/* const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Link to User
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ["email", "sms", "app"], required: true }, // Notification type
  session: { type: String, default: session }, // e.g., 2023/2024
  term: { type: String, default: term }, // e.g., First, Second, Third
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}); */

/* import Timetable from "../models/TimetableModel.js";

// Create a timetable entry
export const createTimetable = async (req, res, next) => {
  try {
    const { classId, subject, teacher, day, time, session, term } = req.body;
    const timetable = new Timetable({
      classId,
      subject,
      teacher,
      day,
      time,
      session,
      term,
    });
    await timetable.save();
    res.status(201).json(timetable);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all timetables
export const getTimetables = async (req, res) => {
  try {
    const timetables = await Timetable.find().populate("class subject teacher");
    res.status(200).json(timetables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get timetable by ID
export const getTimetableById = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id).populate(
      "class subject teacher",
    );
    if (!timetable)
      return res.status(404).json({ error: "Timetable not found" });
    res.status(200).json(timetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get timetable for a specific class
export const getTimetableByClass = async (req, res) => {
  try {
    const timetable = await Timetable.find({
      class: req.params.classId,
      session: req.query.session,
      term: req.query.term,
    }).populate("class subject teacher");
    res.status(200).json(timetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a timetable entry
export const updateTimetable = async (req, res) => {
  try {
    const { subject, teacher, day, time, session, term } = req.body;
    const updatedTimetable = await Timetable.findByIdAndUpdate(
      req.params.id,
      { subject, teacher, day, time, session, term },
      { new: true },
    );
    if (!updatedTimetable)
      return res.status(404).json({ error: "Timetable not found" });
    res.status(200).json(updatedTimetable);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a timetable entry
export const deleteTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findByIdAndDelete(req.params.id);
    if (!timetable)
      return res.status(404).json({ error: "Timetable not found" });
    res.status(200).json({ message: "Timetable deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
 */

/* export const updateStaff = async (req, res, next) => {
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
      gender,
      email,
      role,
      department,
      subjects = [],
      classes = [],
      term,
      session,
      isClassTeacher,
    } = req.body;

    // Find the staff member in the database by their ID
    const staff = await Staff.findOne({ _id: staffId }).select("-password");
    if (!staff) {
      throw new NotFoundError(`Staff member not found`);
    }

    // Find or create the teacherRcords entry for this term/session
    let teacherRecord = staff.teacherRcords.find(
      (rec) => rec.term === term && rec.session === session,
    );
    if (!teacherRecord) {
      throw new NotFoundError(
        `No teacher record found for ${term} term, ${session} session`,
      );
    }

    // --- Handle class teacher assignment ---
    if ((isClassTeacher && subjects) || isClassTeacher) {
      if (
        isClassTeacher &&
        (!teacherRecord.isClassTeacher ||
          isClassTeacher.toString() !== teacherRecord.isClassTeacher.toString())
      ) {
        // Assign as class teacher for this term/session
        const newClass = await Class.findById(isClassTeacher);
        if (!newClass) {
          throw new NotFoundError("Assigned class not found for class teacher");
        }
        // Remove previous class teacher assignment for this term/session
        if (teacherRecord.isClassTeacher) {
          const oldClass = await Class.findById(teacherRecord.isClassTeacher);
          if (oldClass) {
            oldClass.classTeacher = null;
            await oldClass.save();

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
          // console.log(
          //   `Subject ID ${subjectId} not found, skipping assignment.`,
          // );
          throw new NotFoundError("Subject not found");
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
    // if (staus) staff.status = status;
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
};*/

// Register Student and create attendance
/* export const registerStudent = async (req, res, next) => {
  const {
    firstName,
    middleName,
    lastName,
    houseNumber,
    streetName,
    townOrCity,
    phoneNumber,
    password,
    classId,
    dateOfBirth,
    age,
    gender,
  } = req.body;

  if (
    !firstName ||
    !middleName ||
    !lastName ||
    !streetName ||
    !townOrCity ||
    !dateOfBirth ||
    !age ||
    !gender ||
    !classId
  ) {
    throw new BadRequestError("Please provide all required fields");
  }

  const { role, userId } = req.user;

  try {
    if (role !== "parent" && role !== "admin" && role !== "proprietor") {
      throw new Forbidden("Only parents can register students.");
    }

    let parent = null;
    let parentGuardianId = null;
    let assignedGuardian = null;

    if (role === "parent") {
      parent = await Parent.findById(userId);
      if (!parent) throw new NotFoundError("Parent not found");
      parentGuardianId = parent._id;
    }

    if (role === "admin" || role === "proprietor") {
      if (!req.body.parentGuardianId) {
        throw new BadRequestError(
          "Admin must assign a parent for the student.",
        );
      }

      assignedGuardian = await Parent.findById(req.body.parentGuardianId);
      if (!assignedGuardian) {
        throw new NotFoundError("Assigned parent/guardian not found.");
      }
      parentGuardianId = assignedGuardian._id;
    }

    const { term, session, startDate, endDate } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    await Student.collection.dropIndex("email_1");
    await Student.createIndexes();

    const student = new Student({
      firstName,
      middleName,
      lastName,
      houseNumber,
      streetName,
      townOrCity,
      dateOfBirth,
      phoneNumber,
      studentID: await generateID("STU", firstName, middleName, lastName),
      email: req.body.email == null ? undefined : req.body.email,
      password,
      classId,
      parentGuardianId,
      age,
      gender,
      term,
      session,
    });

    await student.save();

    // Verify class exists and add student
    const assignedClass = await Class.findById(classId);
    if (!assignedClass) {
      throw new NotFoundError(`Class not found`);
    }
    if (
      assignedClass.term === term &&
      assignedClass.session === student.session
    ) {
      assignedClass.students.push(student._id);
      await assignedClass.save();
    }

    // Retrieve the class teacher from the class document
    const classTeacher = assignedClass.classTeacher;

    // Update subjects for the assigned class
    const subjects = await Subject.find({
      _id: { $in: assignedClass.subjects },
    });
    for (const subject of subjects) {
      if (subject.term === term && subject.session === student.session) {
        subject.students.push(student._id);
        await subject.save();
      }
    }

    // Update parent's children
    const targetParent = role === "parent" ? parent : assignedGuardian;

    if (targetParent.father && Object.keys(targetParent.father).length > 0) {
      targetParent.father.children.push(student._id);
    }
    if (targetParent.mother && Object.keys(targetParent.mother).length > 0) {
      targetParent.mother.children.push(student._id);
    }
    if (
      targetParent.singleParent &&
      Object.keys(targetParent.singleParent).length > 0
    ) {
      targetParent.singleParent.children.push(student._id);
    }

    await targetParent.save();

    // Generate school days and attendance records
    const schoolDays = getSchoolDays(new Date(startDate), new Date(endDate));
    const attendanceIds = [];

    for (const date of schoolDays) {
      const attendance = new Attendance({
        student: student._id,
        classId: classId,
        date: date,
        morningStatus: "pending", // Separate status for morning attendance
        afternoonStatus: "pending", // Separate status for afternoon attendance
        // session: student.session,
        // term: student.term,
        classTeacher: classTeacher, // Assign class teacher
      });

      const savedAttendance = await attendance.save();
      attendanceIds.push(savedAttendance._id);
    }

    student.attendance = attendanceIds; // Add attendance IDs to the student document
    await student.save(); // Save updated student with attendance references

    const tokenUser = createTokenUser(student);
    attachCookiesToResponse({ res, user: tokenUser });

    const populatedStudent = await Student.findById(student._id)
      .select("-password")
      .populate([
        {
          path: "classId",
          select: "_id className classTeacher subjectTeachers subjects",
          populate: [
            { path: "classTeacher", select: "_id name" },
            { path: "subjectTeachers", select: "_id name" },
            { path: "subjects", select: "_id subjectName" },
          ],
        },
        { path: "guardian", select: "_id name" },
      ]);

    res.status(StatusCodes.CREATED).json({
      message: "Student registered successfully",
      populatedStudent,
      token: tokenUser,
    });
  } catch (error) {
    if (error.code === 11000) {
      console.error("Error registering student:", error);
      throw new BadRequestError("There is a duplicate error of unique values.");
    }
    console.error("Error registering student:", error);
    next(new InternalServerError(error.message));

    // throw error;
  }
}; */

/*const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true }, // Student name at birth
  middleName: { type: String, required: true }, // Student second name
  lastName: { type: String, required: true }, // Student surname
  houseNumber: { type: Number, required: false },
  streetName: { type: String, required: true },
  townOrCity: { type: String, required: true },
  email: { type: String, required: false, unique: true, sparse: true }, // Unique email, sparse Allow multiple `null` values
  password: { type: String, default: "secret" }, // Password (hashed later)
  studentID: { type: String, unique: true }, // Auto-generated student ID
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  }, // Class reference
  parentGuardianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Parent",
    required: false, // Guardian reference
  },
  attendance: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attendance" }], // Define as array of ObjectIds
  role: { type: String, default: "student" }, // Default role for students
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  previousStatus: { type: String, enum: ["active", "inactive"] }, // Track previous status
  isVerified: { type: Boolean, default: false },
  session: { type: String, required: false }, // e.g., 2023/2024
  term: { type: String, required: false }, // Term (e.g., First, Second, Third)
  dateOfBirth: {
    type: String, // Store date as a string to validate custom format
    required: [true, "Please provide date of birth"],
    validate: {
      validator: function (v) {
        // Regular expression to validate dd/mm/yyyy format
        return /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(
          v,
        );
      },
      message: "Invalid date format. Expected format: dd/mm/yy or dd/mm/yyyy",
    },
  },
  age: { type: Number }, // Age of the student
  gender: { type: String, enum: ["male", "female"], required: true }, // Gender: male or female
  medicalHistory: { type: String }, // Optional: Medical history
  createdAt: { type: Date, default: Date.now }, // Creation timestamp
  updatedAt: { type: Date, default: Date.now }, // Update timestamp
});

// Pre-save hook to hash password, generate studentID, set session, and term
studentSchema.pre("validate", async function (next) {
  if (this.isNew) {
    // Hash the password before saving
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10); // Generate a salt
      this.password = await bcrypt.hash(this.password, salt); // Hash the password
    }
  }
  next();
});

// Method to compare passwords
studentSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// Create the Student model
const Student = mongoose.model("Student", studentSchema);

export default Student;
*/
