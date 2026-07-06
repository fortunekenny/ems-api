// const Library = require("../models/Library");
import Library from "../models/LibraryModel.js";
import { emitToAuthorized } from "../utils/socket.js";

// The catalog is shared, non-sensitive data; everyone allowed to read it (per
// libraryRoutes authorizeRole) gets the live update via their role room.
const LIBRARY_ROLES = ["admin", "proprietor", "teacher", "non-teacher", "student"];

// Add a new book to the library
export const addBook = async (req, res) => {
  try {
    const { title, author, ISBN, category, session, term, availableCopies } =
      req.body;
    const book = new Library({
      title,
      author,
      ISBN,
      category,
      session,
      term,
      availableCopies,
    });
    await book.save();
    emitToAuthorized("library:updated", { bookId: book._id, action: "added" }, { roles: LIBRARY_ROLES });
    res.status(201).json(book);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all books in the library
export const getBooks = async (req, res) => {
  try {
    const books = await Library.find();
    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get book by ID
export const getBookById = async (req, res) => {
  try {
    const book = await Library.findById(req.params.id);
    if (!book) return res.status(404).json({ error: "Book not found" });
    res.status(200).json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a book
export const updateBook = async (req, res) => {
  try {
    const { title, author, ISBN, category, availableCopies, session, term } =
      req.body;
    const updatedBook = await Library.findByIdAndUpdate(
      req.params.id,
      { title, author, ISBN, category, availableCopies, session, term },
      { new: true },
    );
    if (!updatedBook) return res.status(404).json({ error: "Book not found" });
    emitToAuthorized("library:updated", { bookId: updatedBook._id, action: "updated" }, { roles: LIBRARY_ROLES });
    res.status(200).json(updatedBook);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a book
export const deleteBook = async (req, res) => {
  try {
    const book = await Library.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ error: "Book not found" });
    emitToAuthorized("library:updated", { bookId: book._id, action: "deleted" }, { roles: LIBRARY_ROLES });
    res.status(200).json({ message: "Book deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
