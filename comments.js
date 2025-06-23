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
