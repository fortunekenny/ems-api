// models/apiKeyModel.js
import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    appName: { type: String, required: true },
    role: {
      type: String,
      enum: ["public", "internal", "admin"],
      default: "public",
    },
    active: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed }, // platform, version, etc.
  },
  { timestamps: true },
);

export default mongoose.model("ApiKey", apiKeySchema);

/* 
{
  "appName": "Parent Mobile App",
  "role": "public",
  "metadata": {
    "platform": "Android",
    "version": "v1.0"
  }
}
*/
