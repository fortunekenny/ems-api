import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["user", "admin", "staff", "student", "parent"],
    default: "user",
  },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Parent" },
  isApproved: { type: Boolean, default: false }, // Added isApproved field
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Hash the password before saving the user
userSchema.pre("save", async function (next) {
  const user = this;

  // If the password field hasn't been modified, skip hashing
  if (!user.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user.password, salt);
    user.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare input password with the hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
