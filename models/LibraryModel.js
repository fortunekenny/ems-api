import mongoose from "mongoose";

const librarySchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  isbn: { type: String, required: true, unique: true },
  availableCopies: { type: Number, default: 1 },
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  borrowedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of borrowers
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Library = mongoose.model("Library", librarySchema);

export default Library;
