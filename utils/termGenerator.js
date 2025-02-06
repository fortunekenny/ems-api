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
export const generateCurrentTerm = (startDate, holidayDurations) => {
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
};

// export const startTermGenerationDate = "2024-09-16";
// export const startTermGenerationDate = "2024-11-16";
export const startTermGenerationDate = "2025-01-05";

export const holidayDurationForEachTerm = [14, 10, 21];

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

export const getCurrentTermDetails = (startDate, holidayDurations) => {
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
    holidayStartDate: holidayStartDate || nextHolidayStartDate,
    holidayEndDate: holidayEndDate || nextHolidayEndDate,
    nextTermStartDate,
    session,
    weekOfTerm,
    isHoliday,
  };
};

/*export const getCurrentTermDetails = (startDate, holidayDurations) => {
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
};*/

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

    console.log(`Current Term: ${term}`);
    console.log(`Current Session: ${currentSession}`);
    console.log(`Term Ends On: ${endDate}`);
    console.log(`Next Term Starts On: ${nextTermStartDate}`);

    // Check if the current date is after the term's end date
    const now = new Date();
    if (now > new Date(endDate)) {
      if (term === "third") {
        // Transition to a new session after the third term ends
        console.log("Transitioning to a new session...");
        const newSession = getCurrentSession(nextTermStartDate); // New session begins at the start of the next term
        await createNewSession(newSession);

        console.log(`New session (${newSession}) has started.`);
      } else {
        // Transition to the next term within the same session
        console.log("Transitioning to the next term...");
        const newTerm = getNextTerm(term); // Get the next term
        await createNewTerm(newTerm, currentSession);

        console.log(
          `New term (${newTerm}) in session (${currentSession}) has started.`,
        );
      }
    } else {
      console.log("No transitions required. Current term is ongoing.");
    }
  } catch (error) {
    console.error("Error transitioning to new term or session:", error);
  }
};

// Helper functions
const getNextTerm = (currentTerm) => {
  const terms = ["first", "second", "third"];
  const currentIndex = terms.indexOf(currentTerm);
  return terms[(currentIndex + 1) % terms.length]; // Cycles through terms
};

const createNewSession = async (newSession) => {
  console.log(`Creating data for new session: ${newSession}...`);
  // Logic to create new session-related data (e.g., classes, attendance, subjects)
  // Update database, initialize collections, etc.
};

const createNewTerm = async (newTerm, currentSession) => {
  console.log(
    `Creating data for new term: ${newTerm} in session ${currentSession}...`,
  );
  // Logic to create new term-related data
  // Update database, initialize term-specific records, etc.
};
