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

/* 

{
  "_id": "666a1b2c3d4e5f6789012345",
  "student": "665f1a2b3c4d5e6789012345",
  "amountDue": 50000,
  "amountPaid": 20000,
  "installments": [
    {
      "amount": 10000,
      "datePaid": "2025-05-01T00:00:00.000Z"
    },
    {
      "amount": 10000,
      "datePaid": "2025-06-01T00:00:00.000Z"
    }
  ],
  "dueDate": "2025-07-01T00:00:00.000Z",
  "session": "2024/2025",
  "term": "First",
  "status": "Pending",
  "createdAt": "2025-06-15T12:00:00.000Z",
  "updatedAt": "2025-06-15T12:00:00.000Z",
  "__v": 0
}
*/
