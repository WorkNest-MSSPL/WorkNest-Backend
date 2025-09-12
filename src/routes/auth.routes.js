const express = require("express");
const authController = require("../controller/auth/auth.controller.js");
const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post("/refresh", authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Public
 */
router.post("/logout", authController.logout);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify access token
 * @access  Public
 */
router.get("/verify", authController.verifyToken);

module.exports = router;
