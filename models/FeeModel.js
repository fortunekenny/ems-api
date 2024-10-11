import mongoose from "mongoose";

const installmentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  datePaid: { type: Date, required: true },
});

const feeSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  }, // Link to Student
  amountDue: { type: Number, required: true }, // Total fee amount
  amountPaid: { type: Number, default: 0 }, // Total amount paid so far
  installments: [installmentSchema], // Array to store installment payments
  dueDate: { type: Date, required: true }, // Final due date for payment
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  status: {
    type: String,
    enum: ["Paid", "Pending", "Overdue"],
    default: "Pending",
  }, // Payment status
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

feeSchema.pre("save", function (next) {
  // Update the status based on the amount paid
  if (this.amountPaid >= this.amountDue) {
    this.status = "Paid";
  } else if (new Date() > this.dueDate) {
    this.status = "Overdue";
  } else {
    this.status = "Pending";
  }
  next();
});

const Fee = mongoose.model("Fee", feeSchema);

export default Fee;
