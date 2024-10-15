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

export const startTermGenerationDate = "2024-09-16";

export const holidayDurationForEachTerm = [14, 10, 21];
