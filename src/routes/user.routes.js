const express = require("express");
const userController = require("../controller/user/user.controller.js");
const router = express.Router();

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private
 */
router.post("/", userController.createUser);

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private
 */
router.get("/", userController.getUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get("/:id", userController.getUserById);

module.exports = router;
