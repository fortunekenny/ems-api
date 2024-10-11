import express from "express";
import rateLimiter from "express-rate-limit";
// import { register, login, logout } from "../controllers/authController.js";
import * as authController from "../controllers/authController.js";

const router = express.Router();

const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { msg: "IP rate limit exceeded, retry in 15 minutes." },
});

// Apply rate limiter to the register and login routes
// router.post("/register", apiLimiter, authController.register);
router.post("/login", apiLimiter, authController.login);
router.get("/logout", authController.logout);

export default router;
