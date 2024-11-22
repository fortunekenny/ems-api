import multer from "multer";
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

export default upload;
