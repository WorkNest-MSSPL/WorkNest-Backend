const express = require("express");
const router = express.Router();

const {
  getDashboardData,
  getModuleDashboard,
  getQuickStats,
  getDepartmentAnalytics,
} = require("../controller/dashboard/dashboard.controller.js");

router.get("/data", getDashboardData);
router.get("/module/:module", getModuleDashboard);
router.get("/quickStats", getQuickStats);
router.get("/analytics/:department_id", getDepartmentAnalytics);

module.exports = router;
