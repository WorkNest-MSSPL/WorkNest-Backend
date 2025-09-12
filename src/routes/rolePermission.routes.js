const express = require("express");
const rolePermissionController = require("../controller/user/rolePermission.controller.js");
const router = express.Router();

/**
 * @route   GET /api/role-permissions
 * @desc    Get all role permissions
 * @access  Private
 */
router.get("/", rolePermissionController.getRolePermissions);

/**
 * @route   GET /api/role-permissions/role/:roleId
 * @desc    Get role permissions by role ID
 * @access  Private
 */
router.get("/:roleId", rolePermissionController.getRolePermissionsByRoleId);

/**
 * @route   POST /api/role-permissions
 * @desc    Set role permissions
 * @access  Private
 */
router.post("/", rolePermissionController.setRolePermissions);

/**
 * @route   DELETE /api/role-permissions/:id
 * @desc    Delete role permission
 * @access  Private
 */
router.delete("/:id", rolePermissionController.deleteRolePermission);

module.exports = router;
