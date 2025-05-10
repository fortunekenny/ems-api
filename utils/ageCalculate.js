/* const calculateAge = (dateOfBirth) => {
  // Convert dateOfBirth to a Date object
  const dob = new Date(dateOfBirth);

  // Get current time in milliseconds
  const now = Date.now();

  // Calculate the difference in milliseconds
  const diffMs = now - dob.getTime();

  // Convert milliseconds to years (using 365.25 days to account for leap years)
  const age = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));

  return age;
};

export default calculateAge;

 */

const calculateAge = (dateOfBirth) => {
  // Assuming dateOfBirth is in "dd/mm/yyyy" format:
  const parts = dateOfBirth.split("/");
  if (parts.length !== 3) {
    throw new Error("Invalid date format. Expected dd/mm/yyyy");
  }
  const [day, month, year] = parts;
  // Rearrange to "yyyy-mm-dd"
  const isoDateString = `${year}-${month}-${day}`;
  const dob = new Date(isoDateString);

  // Validate that dob is a valid date
  if (isNaN(dob.getTime())) {
    throw new Error("Invalid date provided.");
  }

  const now = Date.now();
  const diffMs = now - dob.getTime();
  const age = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  return age;
};

export default calculateAge;
