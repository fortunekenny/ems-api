// @ts-nocheck
/*import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer with Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "uploads", // Specify folder in Cloudinary
    resource_type: "raw", // For file uploads (non-images)
    allowed_formats: ["pdf", "doc", "docx", "xlsx"], // Restrict file types
  },
});

const upload = multer({ storage });

export default upload;*/

/*import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer with dynamic Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Ensure `classId` and `className` exist in the request
    if (!req.classId || !req.className) {
      throw new Error(
        "classId or className is missing for Cloudinary folder setup.",
      );
    }

    return {
      folder: `${req.classId}.${req.className}`, // Dynamic folder name
      resource_type: "raw", // For file uploads (non-images)
      allowed_formats: ["pdf", "doc", "docx", "xlsx"], // Restrict file types
    };
  },
});

const upload = multer({ storage });

export default upload;*/

import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import Class from "./models/ClassModel.js"; // Import the Class model or adjust the path accordingly

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer with Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Extract classId from the request body
    const { classId } = req.body;

    if (!classId) {
      throw new Error("classId is required to determine the upload folder.");
    }

    // Fetch class information from the database
    const classData = await Class.findById(classId).select("className"); // Only retrieve className
    if (!classData) {
      throw new Error("Class not found with the provided classId.");
    }

    const className = classData.className;

    return {
      folder: `${className}`, // Dynamically set folder based on classId and className
      resource_type: "raw", // For non-image files
      allowed_formats: ["pdf", "doc", "docx", "xlsx"], // Restrict file types
    };
  },
});

const upload = multer({ storage });

export default upload;
