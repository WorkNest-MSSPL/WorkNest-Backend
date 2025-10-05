const express = require("express");
const router = express.Router();

const {
  getDashboardData,
  getModuleDashboard,
  getQuickStats,
  getDepartmentAnalytics,
  getProjectDetailsWithCost,
  getEmployeePerformance,
} = require("../controller/dashboard/dashboard.controller.js");

// Main dashboard data with comprehensive metrics
router.get("/data", getDashboardData);

// Module-specific dashboard data
router.get("/module/:module", getModuleDashboard);

// Quick stats for dashboard widgets
router.get("/quick-stats", getQuickStats);

// Department-wise analytics
router.get("/department-analytics/:department_id", getDepartmentAnalytics);

// Project details with cost analysis
router.get("/project-details/:project_id", getProjectDetailsWithCost);

// Employee performance analytics
router.get("/employee-performance/:employee_id", getEmployeePerformance);

module.exports = router;

// const express = require("express");
// const router = express.Router();

// const {
//   getDashboardData,
//   getModuleDashboard,
//   getQuickStats,
//   getDepartmentAnalytics,
//   getProjectDetailsWithCost,
// } = require("../controller/dashboard/dashboard.controller.js");

// router.get("/data", getDashboardData);
// router.get("/module/:module", getModuleDashboard);
// router.get("/quickStats", getQuickStats);
// router.get("/analytics/:department_id", getDepartmentAnalytics);
// router.get("/project/:project_id", getProjectDetailsWithCost);

// module.exports = router;
