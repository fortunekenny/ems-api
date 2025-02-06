import Counter from "../models/CounterModel.js"; // Import the Counter model

// Utility function to shuffle an array using Fisher-Yates algorithm
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const generateID = async (prefix, firstName, middleName, lastName) => {
  // Atomically increment the counter for this prefix
  const counter = await Counter.findOneAndUpdate(
    { prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  // Get the current date parts
  const now = new Date();
  const year = now.getFullYear().toString(); // e.g., "2025"
  const month = String(now.getMonth() + 1).padStart(2, "0"); // e.g., "01"
  const day = String(now.getDate()).padStart(2, "0"); // e.g., "31"

  // Extract initials from the names (convert to uppercase)
  const initials = [];
  if (firstName) initials.push(firstName[0].toUpperCase());
  if (middleName) initials.push(middleName[0].toUpperCase());
  if (lastName) initials.push(lastName[0].toUpperCase());

  // Ensure we have exactly 3 letters. If any name is missing, fill with an empty string.
  while (initials.length < 3) {
    initials.push("E");
  }

  // Shuffle the initials randomly
  const shuffledInitials = shuffleArray(initials);

  // Construct the final ID:
  // <prefix> + <year> + <shuffledInitial[0]> + <month> + <shuffledInitial[1]> + <day> + <shuffledInitial[2]> + <counter>
  const finalID = `${prefix}${year}${shuffledInitials[0]}${month}${shuffledInitials[1]}${day}${shuffledInitials[2]}${counter.seq}`;

  return finalID;
};

export default generateID;
