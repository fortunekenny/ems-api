/*require("dotenv").config();
import "express-async-errors";
import * as dotenv from "dotenv";

//Express
import express from "express";
const app = express();

//rest of package
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const xss = require("xss-clean");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");

//public
const dirname = require("path");
const path = require("path");

//Database
const connectDB = require("./db/connect");

//routers

//middleware
const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");

import morgan from "morgan";
import mongoose from "mongoose";

//IMPORTING ENDS

app.use(helmet());
app.use(cors());
app.use(xss());
app.use(mongoSanitize());

app.use(express.static(path.resolve(__dirname, "./client/dist")));

app.use(express.json());
app.use(cookieParser(process.env.JWT_SECRET));

app.use(express.static("./public"));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api/v1/auth", authRouter);

app.get("*", (req, res) => {
  // res.sendFile(path.resolve(__dirname, "./public", "index.html"));
  res.sendFile(path.resolve(__dirname, "./client/dist", "index.html"));
});

//error middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5100;

// try {
//   await mongoose.connect(process.env.MONGO_URL);
//   app.listen(port, () => {
//     console.log(`server running on PORT ${port}....`);
//   });
// } catch (error) {
//   console.log(error);
//   process.exit(1);
// }

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    app.listen(port, () => {
      console.log(`ems server is listening on port ${port}...`);
    });
  } catch (error) {
    console.log(error);
  }
};

start();
*/

import express from "express";
import dotenv from "dotenv";
import "express-async-errors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import xss from "xss-clean";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./db/connectdb.js";
import notFoundMiddleware from "./middleware/not-found.js";
import errorHandlerMiddleware from "./middleware/error-handler.js";
import loadRoutes from "./utils/routeLoader.js"; // Import dynamic route loader

import authRoutes from "./routes/authRoutes.js";

// Initialize express
const app = express();

// Load environment variables
dotenv.config();

// Get __dirname and __filename in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middlewares
app.use(helmet());
app.use(cors());
app.use(xss());
app.use(mongoSanitize());

// Body parsers (to handle request bodies)
app.use(express.json()); // Parse application/json
app.use(express.urlencoded({ extended: true })); // Parse application/x-www-form-urlencoded

// Cookie parser
app.use(cookieParser(process.env.JWT_SECRET));

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Load all routes dynamically from the 'routes' folder
const routesPath = path.join(__dirname, "routes"); // Adjust if necessary
await loadRoutes(app, routesPath);

// app.use("/api/v1/auth", authRoutes);

// Catch-all route for serving the frontend
// app.get("*", (req, res) => {
//   res.sendFile(path.resolve(__dirname, "./client/dist", "index.html"));
// });

// Error handling middlewares
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// Start the server
const port = process.env.PORT || 5100;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    app.listen(port, () => {
      console.log(`EMS server is listening on port ${port}...`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

start();
