const express = require("express");
const userPermissionController = require("../controller/user/userPermission.controller.js");
const router = express.Router();

/**
 * @route   GET /api/user-permissions
 * @desc    Get all user permissions
 * @access  Private
 */
router.get("/", userPermissionController.getUserPermissions);

/**
 * @route   GET /api/user-permissions/user/:userId
 * @desc    Get user permissions by user ID
 * @access  Private
 */
router.get("/:userId", userPermissionController.getUserPermissionsByUserId);

/**
 * @route   POST /api/user-permissions
 * @desc    Set user permissions
 * @access  Private
 */
router.post("/", userPermissionController.setUserPermissions);

/**
 * @route   DELETE /api/user-permissions/:id
 * @desc    Delete user permission
 * @access  Private
 */
router.delete("/:id", userPermissionController.deleteUserPermission);

module.exports = router;
