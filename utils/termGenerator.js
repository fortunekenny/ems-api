import Student from "../models/StudentModel.js";
import Staff from "../models/StaffModel.js";
import Parent from "../models/ParentModel.js";
import Subject from "../models/SubjectModel.js";
import Attendance from "../models/AttendanceModel.js";
import Class from "../models/ClassModel.js";
import InternalServerError from "../errors/internal-server-error.js";
import BadRequestError from "../errors/bad-request.js";

const calculateTermEndDate = (startDate) => {
  let weekdaysToAdd = 15 * 5; // 15 weeks * 5 weekdays = 75 weekdays
  let tempEndDate = new Date(startDate);

  // Loop until all weekdays are added
  while (weekdaysToAdd > 0) {
    tempEndDate.setDate(tempEndDate.getDate() + 1); // Move to the next day

    // If it's a weekday (Monday to Friday), decrement the weekdays count
    if (tempEndDate.getDay() >= 1 && tempEndDate.getDay() <= 5) {
      weekdaysToAdd--;
    }
  }

  // Ensure the end date falls on a Friday (end of the week)
  while (tempEndDate.getDay() !== 5) {
    tempEndDate.setDate(tempEndDate.getDate() - 1); // Roll back to Friday
  }

  return tempEndDate;
};

// Function to generate the current term as a string ("first", "second", "third") cycling indefinitely
/* export const generateCurrentTerm = (startDate, holidayDurations) => {
  if (holidayDurations.length < 3) {
    throw new Error("Holiday durations must be provided for all three terms.");
  }

  let currentStartDate = new Date(startDate); // Start date of the first term
  const now = new Date(); // Current date for comparison
  let currentTerm = "first"; // Start with the first term

  // Infinite loop that cycles through the terms and holidays
  while (true) {
    // First term
    const firstTermEndDate = calculateTermEndDate(currentStartDate);
    console.log("First Term End Date: " + firstTermEndDate);

    if (now <= firstTermEndDate) {
      console.log("Currently in First Term");
      currentTerm = "first";
      break;
    }

    // First holiday (start after the first term ends)
    currentStartDate = new Date(firstTermEndDate);
    currentStartDate.setDate(currentStartDate.getDate() + holidayDurations[0]);
    console.log("First Holiday End Date: " + currentStartDate);

    if (now <= currentStartDate) {
      console.log("Currently in First Term Holiday");
      currentTerm = "first";
      break;
    }

    // Second term
    const secondTermEndDate = calculateTermEndDate(currentStartDate);
    console.log("Second Term End Date: " + secondTermEndDate);

    if (now <= secondTermEndDate) {
      console.log("Currently in Second Term");
      currentTerm = "second";
      break;
    }

    // Second holiday (start after the second term ends)
    currentStartDate = new Date(secondTermEndDate);
    currentStartDate.setDate(currentStartDate.getDate() + holidayDurations[1]);
    console.log("Second Holiday End Date: " + currentStartDate);

    if (now <= currentStartDate) {
      console.log("Currently in Second Term Holiday");
      currentTerm = "second";
      break;
    }

    // Third term
    const thirdTermEndDate = calculateTermEndDate(currentStartDate);
    console.log("Third Term End Date: " + thirdTermEndDate);

    if (now <= thirdTermEndDate) {
      console.log("Currently in Third Term");
      currentTerm = "third";
      break;
    }

    // Third holiday (start after the third term ends)
    currentStartDate = new Date(thirdTermEndDate);
    currentStartDate.setDate(currentStartDate.getDate() + holidayDurations[2]);
    console.log("Third Holiday End Date: " + currentStartDate);

    if (now <= currentStartDate) {
      console.log("Currently in Third Term Holiday");
      currentTerm = "third";
      break;
    }

    // At the end of the third term holiday, the loop continues and resets to the first term
  }

  return currentTerm;
}; */

export const startTermGenerationDate = "2024-09-16";
// export const startTermGenerationDate = "2024-11-16";

// export const startTermGenerationDate = "2025-01-05";

export const holidayDurationForEachTerm = [14, 10, 21];

// export const publicHolidays = [
//   // new Date("2025-01-01"),
//   // new Date("2025-04-07"),
//   // // new Date("2025-05-01"),
//   // new Date("2025-08-15"),
//   // new Date("2025-10-02"),
//   // new Date("2025-12-25"),
// ];

export const getCurrentSession = (startDate) => {
  const currentDate = new Date();
  const startMonth = new Date(startDate).getMonth(); // Get the start month from startDate

  // Determine the start year dynamically based on the start month
  const academicYearStart =
    currentDate.getMonth() >= startMonth
      ? currentDate.getFullYear()
      : currentDate.getFullYear() - 1;

  return `${academicYearStart}/${academicYearStart + 1}`;
};

// Accept an optional array of public holiday dates (as strings or Date objects)
export const getCurrentTermDetails = (
  startDate,
  holidayDurations,
  publicHolidays = [],
) => {
  if (holidayDurations.length < 3) {
    throw new Error("Holiday durations must be provided for all three terms.");
  }

  let currentStartDate = new Date(startDate); // Start date of the first term
  const now = new Date(); // Current date for comparison
  let currentTerm = "first"; // Default to first term
  let termStartDate, termEndDate, holidayStartDate, holidayEndDate, isHoliday;
  let nextHolidayStartDate = null;
  let nextHolidayEndDate = null;
  let nextTermStartDate = null;

  // Function to adjust a date to the next Monday if it's not a Monday
  const adjustToNextMonday = (date) => {
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 1) {
      // If not Monday
      date.setDate(date.getDate() + ((8 - day) % 7)); // Move to the next Monday
    }
    return date;
  };

  // Infinite loop that cycles through terms and holidays
  while (true) {
    // First term
    const firstTermEndDate = calculateTermEndDate(currentStartDate);

    if (now <= firstTermEndDate) {
      currentTerm = "first";
      termStartDate = currentStartDate;
      termEndDate = firstTermEndDate;
      isHoliday = false;

      // Pre-calculate next holiday and next term start dates
      nextHolidayStartDate = new Date(firstTermEndDate);
      nextHolidayEndDate = new Date(nextHolidayStartDate);
      nextHolidayEndDate.setDate(
        nextHolidayEndDate.getDate() + holidayDurations[0],
      );

      nextTermStartDate = adjustToNextMonday(new Date(nextHolidayEndDate));
      break;
    }

    // First holiday
    holidayStartDate = new Date(firstTermEndDate);
    holidayEndDate = new Date(holidayStartDate);
    holidayEndDate.setDate(holidayEndDate.getDate() + holidayDurations[0]);

    if (now <= holidayEndDate) {
      currentTerm = "first";
      termStartDate = firstTermEndDate;
      termEndDate = holidayEndDate;
      isHoliday = true;

      // Pre-calculate next term start date
      nextTermStartDate = adjustToNextMonday(new Date(holidayEndDate));
      break;
    }

    // Update start date for the second term
    currentStartDate = new Date(holidayEndDate);

    // Second term
    const secondTermEndDate = calculateTermEndDate(currentStartDate);

    if (now <= secondTermEndDate) {
      currentTerm = "second";
      termStartDate = currentStartDate;
      termEndDate = secondTermEndDate;
      isHoliday = false;

      // Pre-calculate next holiday and next term start dates
      nextHolidayStartDate = new Date(secondTermEndDate);
      nextHolidayEndDate = new Date(nextHolidayStartDate);
      nextHolidayEndDate.setDate(
        nextHolidayEndDate.getDate() + holidayDurations[1],
      );

      nextTermStartDate = adjustToNextMonday(new Date(nextHolidayEndDate));
      break;
    }

    // Second holiday
    holidayStartDate = new Date(secondTermEndDate);
    holidayEndDate = new Date(holidayStartDate);
    holidayEndDate.setDate(holidayEndDate.getDate() + holidayDurations[1]);

    if (now <= holidayEndDate) {
      currentTerm = "second";
      termStartDate = secondTermEndDate;
      termEndDate = holidayEndDate;
      isHoliday = true;

      // Pre-calculate next term start date
      nextTermStartDate = adjustToNextMonday(new Date(holidayEndDate));
      break;
    }

    // Update start date for the third term
    currentStartDate = new Date(holidayEndDate);

    // Third term
    const thirdTermEndDate = calculateTermEndDate(currentStartDate);

    if (now <= thirdTermEndDate) {
      currentTerm = "third";
      termStartDate = currentStartDate;
      termEndDate = thirdTermEndDate;
      isHoliday = false;

      // Pre-calculate next holiday and next term start dates
      nextHolidayStartDate = new Date(thirdTermEndDate);
      nextHolidayEndDate = new Date(nextHolidayStartDate);
      nextHolidayEndDate.setDate(
        nextHolidayEndDate.getDate() + holidayDurations[2],
      );

      nextTermStartDate = adjustToNextMonday(new Date(nextHolidayEndDate));
      break;
    }

    // Third holiday
    holidayStartDate = new Date(thirdTermEndDate);
    holidayEndDate = new Date(holidayStartDate);
    holidayEndDate.setDate(holidayEndDate.getDate() + holidayDurations[2]);

    if (now <= holidayEndDate) {
      currentTerm = "third";
      termStartDate = thirdTermEndDate;
      termEndDate = holidayEndDate;
      isHoliday = true;

      // Pre-calculate next term start date
      nextTermStartDate = adjustToNextMonday(new Date(holidayEndDate)); // First term of next session
      break;
    }

    // Reset to the first term after the third term holiday
    currentStartDate = new Date(holidayEndDate);
  }

  // Calculate school days (weekdays only) in the term
  let schoolDays = [];
  let currentDate = new Date(termStartDate);
  while (currentDate <= termEndDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      schoolDays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Remove public holidays from schoolDays
  const publicHolidaySet = new Set(
    publicHolidays.map((d) => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }),
  );
  schoolDays = schoolDays.filter(
    (d) => !publicHolidaySet.has(new Date(d).setHours(0, 0, 0, 0)),
  );

  // Calculate the week and day of the term (excluding public holidays)
  const msInADay = 24 * 60 * 60 * 1000; // Milliseconds in a day
  // Find the index of today in the filtered schoolDays array
  const todayIndex = schoolDays.findIndex((d) => {
    const d0 = new Date(d);
    d0.setHours(0, 0, 0, 0);
    const n0 = new Date(now);
    n0.setHours(0, 0, 0, 0);
    return d0.getTime() === n0.getTime();
  });
  const dayOfTerm = todayIndex === -1 ? schoolDays.length : todayIndex + 1;

  const msInAWeek = 7 * msInADay;
  const weeksElapsed = Math.floor(dayOfTerm / 5); // 5 school days per week
  const weekOfTerm = weeksElapsed + 1; // Adding 1 to make it 1-indexed

  // Calculate school days (weekdays only) in the term
  /* const schoolDays = [];
  let currentDate = new Date(termStartDate);
  while (currentDate <= termEndDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      schoolDays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  } */

  // Calculate current session
  const session = getCurrentSession(startDate);

  // Calculate nextTerm and nextSession
  let nextTerm = null;
  let nextSession = null;
  if (currentTerm === "third") {
    nextTerm = "first";
    nextSession = getCurrentSession(nextTermStartDate);
  } else {
    nextTerm = currentTerm === "first" ? "second" : "third";
    nextSession = session;
  }

  return {
    term: currentTerm,
    startDate: termStartDate,
    endDate: termEndDate,
    holidayStartDate: holidayStartDate || nextHolidayStartDate,
    holidayEndDate: holidayEndDate || nextHolidayEndDate,
    nextTermStartDate,
    session,
    weekOfTerm,
    day: dayOfTerm, // school day number, excluding public holidays
    isHoliday,
    schoolDays, // list of all school days in the term, excluding public holidays
    schoolDaysCount: schoolDays.length, // Total number of school days in the term, excluding public holidays
    nextTerm,
    nextSession,
  };
};

/* export const getCurrentTermDetails = (startDate, holidayDurations) => {
  if (holidayDurations.length < 3) {
    throw new Error("Holiday durations must be provided for all three terms.");
  }

  let currentStartDate = new Date(startDate); // Start date of the first term
  const now = new Date(); // Current date for comparison
  let currentTerm = "first"; // Default to first term
  let termStartDate, termEndDate, holidayStartDate, holidayEndDate, isHoliday;

  // Infinite loop that cycles through terms and holidays
  while (true) {
    // First term
    const firstTermEndDate = calculateTermEndDate(currentStartDate);

    if (now <= firstTermEndDate) {
      currentTerm = "first";
      termStartDate = currentStartDate;
      termEndDate = firstTermEndDate;
      isHoliday = false;
      break;
    }

    // First holiday
    holidayStartDate = new Date(firstTermEndDate);
    holidayEndDate = new Date(holidayStartDate);
    holidayEndDate.setDate(holidayEndDate.getDate() + holidayDurations[0]);

    if (now <= holidayEndDate) {
      currentTerm = "first";
      termStartDate = firstTermEndDate;
      termEndDate = holidayEndDate;
      isHoliday = true;
      break;
    }

    // Update start date for the second term
    currentStartDate = new Date(holidayEndDate);

    // Second term
    const secondTermEndDate = calculateTermEndDate(currentStartDate);

    if (now <= secondTermEndDate) {
      currentTerm = "second";
      termStartDate = currentStartDate;
      termEndDate = secondTermEndDate;
      isHoliday = false;
      break;
    }

    // Second holiday
    holidayStartDate = new Date(secondTermEndDate);
    holidayEndDate = new Date(holidayStartDate);
    holidayEndDate.setDate(holidayEndDate.getDate() + holidayDurations[1]);

    if (now <= holidayEndDate) {
      currentTerm = "second";
      termStartDate = secondTermEndDate;
      termEndDate = holidayEndDate;
      isHoliday = true;
      break;
    }

    // Update start date for the third term
    currentStartDate = new Date(holidayEndDate);

    // Third term
    const thirdTermEndDate = calculateTermEndDate(currentStartDate);

    if (now <= thirdTermEndDate) {
      currentTerm = "third";
      termStartDate = currentStartDate;
      termEndDate = thirdTermEndDate;
      isHoliday = false;
      break;
    }

    // Third holiday
    holidayStartDate = new Date(thirdTermEndDate);
    holidayEndDate = new Date(holidayStartDate);
    holidayEndDate.setDate(holidayEndDate.getDate() + holidayDurations[2]);

    if (now <= holidayEndDate) {
      currentTerm = "third";
      termStartDate = thirdTermEndDate;
      termEndDate = holidayEndDate;
      isHoliday = true;
      break;
    }

    // Reset to the first term after the third term holiday
    currentStartDate = new Date(holidayEndDate);
  }

  // Calculate the week of the term
  const msInAWeek = 7 * 24 * 60 * 60 * 1000; // Milliseconds in a week
  const weeksElapsed = Math.floor((now - termStartDate) / msInAWeek);
  const weekOfTerm = weeksElapsed + 1; // Adding 1 to make it 1-indexed

  // Calculate current session
  const session = getCurrentSession(startDate);

  return {
    term: currentTerm,
    startDate: termStartDate,
    endDate: termEndDate,
    holidayStartDate: holidayStartDate || null,
    holidayEndDate: holidayEndDate || null,
    session,
    weekOfTerm,
    isHoliday,
  };
}; */

const getNextTerm = (currentTerm) => {
  const terms = ["first", "second", "third"];
  const currentIndex = terms.indexOf(currentTerm);
  return terms[(currentIndex + 1) % terms.length];
};

const duplicateDocuments = async (Model, filter, updateFields) => {
  const docs = await Model.find(filter).lean();
  const newDocs = docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, ...updateFields };
  });
  if (newDocs.length > 0) {
    await Model.insertMany(newDocs);
  }
};

export const transitionToNewTermOrSession = async (
  startDate,
  holidayDurations,
) => {
  try {
    // Get current term details dynamically
    const currentTermDetails = getCurrentTermDetails(
      startDate,
      holidayDurations,
    );

    const {
      term,
      endDate,
      nextTermStartDate,
      session: currentSession,
    } = currentTermDetails;

    /*     console.log(`Current Term: ${term}`);
    console.log(`Current Session: ${currentSession}`);
    console.log(`Term Ends On: ${endDate}`);
    console.log(`Next Term Starts On: ${nextTermStartDate}`); */

    // Check if the current date is after the term's end date
    const now = new Date();
    if (now > new Date(endDate)) {
      if (term === "third") {
        // Transition to a new session after the third term ends
        console.log("Transitioning to a new session...");
        const newSession = getCurrentSession(nextTermStartDate); // New session begins at the start of the next term
        const newTerm = "first";
        // Duplicate all relevant documents with new session and term
        await Promise.all([
          duplicateDocuments(
            Student,
            { status: "active" },
            { session: newSession, term: newTerm },
          ),
          duplicateDocuments(
            Staff,
            { status: "active" },
            { session: newSession, term: newTerm },
          ),
          duplicateDocuments(
            Parent,
            { status: "active" },
            { session: newSession, term: newTerm },
          ),
          duplicateDocuments(
            Subject,
            {},
            { session: newSession, term: newTerm },
          ),
          duplicateDocuments(
            Attendance,
            {},
            { session: newSession, term: newTerm },
          ),
          duplicateDocuments(Class, {}, { session: newSession, term: newTerm }),
        ]);
        console.log(
          `New session (${newSession}) and term (${newTerm}) will start ${nextTermStartDate}.`,
        );
      } else {
        // Transition to the next term within the same session
        console.log("Transitioning to the next term...");
        const newTerm = getNextTerm(term); // Get the next term
        // Duplicate all relevant documents with new term
        await Promise.all([
          duplicateDocuments(
            Student,
            { status: "active" },
            { session: currentSession, term: newTerm },
          ),
          duplicateDocuments(
            Staff,
            { status: "active" },
            { session: currentSession, term: newTerm },
          ),
          duplicateDocuments(
            Parent,
            { status: "active" },
            { session: currentSession, term: newTerm },
          ),
          duplicateDocuments(
            Subject,
            {},
            { session: currentSession, term: newTerm },
          ),
          duplicateDocuments(
            Attendance,
            {},
            { session: currentSession, term: newTerm },
          ),
          duplicateDocuments(
            Class,
            {},
            { session: currentSession, term: newTerm },
          ),
        ]);
        // console.log(
        //   `New term (${newTerm}) in session (${currentSession}) has started.`,
        // );
      }
    } else {
      console.log("No transitions required. Current term is ongoing.");
      throw new BadRequestError(
        "No transitions required. Current term is ongoing.",
      );
    }
  } catch (error) {
    console.log("Error transitioning to new term or session:", error);
    next(new InternalServerError(error.message));
  }
};

/// WORK ON THE ATTENDANCE DUBLICATE
/// isClassTeacher, subjectTeacher etc
