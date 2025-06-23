// models/weekTimetableModel.js
import mongoose from "mongoose";

const weekTimetableSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    term: String,
    session: String,
    schedule: [
      {
        day: {
          type: String,
          enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          required: true,
        },
        periods: [
          {
            periodNumber: Number,
            subject: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Subject",
            },
            teacher: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Staff",
            },
            startTime: String, // e.g., "08:00"
            endTime: String, // e.g., "08:45"
          },
        ],
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model("WeekTimetable", weekTimetableSchema);

/* 
{
  "_id": "666b91ac4d3b1a4f8e123abc",
  "classId": "665a1e8f1b2a3c4d5e6f7a10",  // Primary 4A class ObjectId
  "term": "First",
  "session": "2024/2025",
  "schedule": [
    {
      "day": "Monday",
      "periods": [
        {
          "periodNumber": 1,
          "subject": "665b2e9f1b2a3c4d5e6f7a20",  // Mathematics
          "teacher": "665c3f0f1b2a3c4d5e6f7a30",
          "startTime": "08:00",
          "endTime": "08:45"
        },
        {
          "periodNumber": 2,
          "subject": "665b2e9f1b2a3c4d5e6f7a21",  // English
          "teacher": "665c3f0f1b2a3c4d5e6f7a31",
          "startTime": "08:50",
          "endTime": "09:35"
        }
      ]
    },
    {
      "day": "Tuesday",
      "periods": [
        {
          "periodNumber": 1,
          "subject": "665b2e9f1b2a3c4d5e6f7a22",  // Science
          "teacher": "665c3f0f1b2a3c4d5e6f7a32",
          "startTime": "08:00",
          "endTime": "08:45"
        },
        {
          "periodNumber": 2,
          "subject": "665b2e9f1b2a3c4d5e6f7a23",  // Social Studies
          "teacher": "665c3f0f1b2a3c4d5e6f7a33",
          "startTime": "08:50",
          "endTime": "09:35"
        }
      ]
    },
    {
      "day": "Wednesday",
      "periods": [
        {
          "periodNumber": 1,
          "subject": "665b2e9f1b2a3c4d5e6f7a24",  // Civic Education
          "teacher": "665c3f0f1b2a3c4d5e6f7a34",
          "startTime": "08:00",
          "endTime": "08:45"
        }
      ]
    },
    {
      "day": "Thursday",
      "periods": [
        {
          "periodNumber": 1,
          "subject": "665b2e9f1b2a3c4d5e6f7a25",  // Yoruba
          "teacher": "665c3f0f1b2a3c4d5e6f7a35",
          "startTime": "08:00",
          "endTime": "08:45"
        }
      ]
    },
    {
      "day": "Friday",
      "periods": [
        {
          "periodNumber": 1,
          "subject": "665b2e9f1b2a3c4d5e6f7a26",  // Physical Education
          "teacher": "665c3f0f1b2a3c4d5e6f7a36",
          "startTime": "08:00",
          "endTime": "08:45"
        }
      ]
    }
  ],
  "createdAt": "2025-06-12T09:30:00.000Z",
  "updatedAt": "2025-06-12T09:30:00.000Z",
  "__v": 0
}
*/
