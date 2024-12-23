// Utility function to calculate the end date of a term given a start date (15 weeks excluding weekends)

/*const calculateTermEndDate = (startDate) => {
  let weekdaysToAdd = 15 * 5; // 15 weeks * 5 weekdays (excluding weekends)
  let tempEndDate = new Date(startDate);

  while (weekdaysToAdd > 0) {
    tempEndDate.setDate(tempEndDate.getDate() + 1); // Move to the next day

    // Only count weekdays (Monday to Friday)
    if (tempEndDate.getDay() !== 0 && tempEndDate.getDay() !== 6) {
      weekdaysToAdd--;
    }
  }

  return tempEndDate;
};*/

// Utility function to calculate the end date of a term given a start date (15 weeks excluding weekends)

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
export const startTermGenerationDate = "2024-11-16";

export const holidayDurationForEachTerm = [14, 10, 21];

export const getCurrentSession = () => {
  const date = new Date();
  const currentYear = date.getFullYear();
  return `${currentYear}/${currentYear + 1}`;
};

/*export const getCurrentTermDetails = (startDate, holidayDurations) => {
  if (holidayDurations.length < 3) {
    throw new Error("Holiday durations must be provided for all three terms.");
  }

  let currentStartDate = new Date(startDate); // Start date of the first term
  const now = new Date(); // Current date for comparison
  let currentTerm = "first"; // Default to first term
  let termStartDate, termEndDate;

  // Infinite loop that cycles through terms and holidays
  while (true) {
    // First term
    const firstTermEndDate = calculateTermEndDate(currentStartDate);
    console.log("First Term End Date: " + firstTermEndDate);

    if (now <= firstTermEndDate) {
      console.log("Currently in First Term");
      currentTerm = "first";
      termStartDate = currentStartDate;
      termEndDate = firstTermEndDate;
      break;
    }

    // First holiday
    currentStartDate = new Date(firstTermEndDate);
    currentStartDate.setDate(currentStartDate.getDate() + holidayDurations[0]);
    console.log("First Holiday End Date: " + currentStartDate);

    if (now <= currentStartDate) {
      console.log("Currently in First Term Holiday");
      currentTerm = "first";
      termStartDate = new Date(firstTermEndDate);
      termEndDate = currentStartDate;
      break;
    }

    // Second term
    const secondTermEndDate = calculateTermEndDate(currentStartDate);
    console.log("Second Term End Date: " + secondTermEndDate);

    if (now <= secondTermEndDate) {
      console.log("Currently in Second Term");
      currentTerm = "second";
      termStartDate = currentStartDate;
      termEndDate = secondTermEndDate;
      break;
    }

    // Second holiday
    currentStartDate = new Date(secondTermEndDate);
    currentStartDate.setDate(currentStartDate.getDate() + holidayDurations[1]);
    console.log("Second Holiday End Date: " + currentStartDate);

    if (now <= currentStartDate) {
      console.log("Currently in Second Term Holiday");
      currentTerm = "second";
      termStartDate = new Date(secondTermEndDate);
      termEndDate = currentStartDate;
      break;
    }

    // Third term
    const thirdTermEndDate = calculateTermEndDate(currentStartDate);
    console.log("Third Term End Date: " + thirdTermEndDate);

    if (now <= thirdTermEndDate) {
      console.log("Currently in Third Term");
      currentTerm = "third";
      termStartDate = currentStartDate;
      termEndDate = thirdTermEndDate;
      break;
    }

    // Third holiday
    currentStartDate = new Date(thirdTermEndDate);
    currentStartDate.setDate(currentStartDate.getDate() + holidayDurations[2]);
    console.log("Third Holiday End Date: " + currentStartDate);

    if (now <= currentStartDate) {
      console.log("Currently in Third Term Holiday");
      currentTerm = "third";
      termStartDate = new Date(thirdTermEndDate);
      termEndDate = currentStartDate;
      break;
    }

    // Reset to the first term after the third term holiday
  }

  return {
    term: currentTerm,
    startDate: termStartDate,
    endDate: termEndDate,
  };
};*/

export const getCurrentTermDetails = (startDate, holidayDurations) => {
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
  const nextTermStartDate = holidayEndDate; // Determine next term start date

  return {
    term: currentTerm,
    startDate: termStartDate,
    endDate: termEndDate,
    holidayStartDate: holidayStartDate || null,
    holidayEndDate: holidayEndDate || null,
    session: getCurrentSession(),
    weekOfTerm,
    isHoliday,
    nextTermStartDate,
  };
};
// console.log(
//   "Term Details:",
//   getCurrentTermDetails(startTermGenerationDate, holidayDurationForEachTerm),
// );

// console.log("Session:", getCurrentSession());
