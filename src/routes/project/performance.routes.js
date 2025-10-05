const express = require("express");
const router = express.Router();
const performanceController = require("../../controller/project/performance.controller.js");

// Performance evaluation routes
router.post("/evaluations", performanceController.createPerformanceEvaluation);
router.get("/evaluations", performanceController.getAllPerformanceEvaluations);
router.get(
  "/evaluations/:id",
  performanceController.getPerformanceEvaluationById
);
router.put(
  "/evaluations/:id",
  performanceController.updatePerformanceEvaluation
);
router.delete(
  "/evaluations/:id",
  performanceController.deletePerformanceEvaluation
);

// KPI and criteria routes
router.get("/kpi/:employeeId", performanceController.calculateEmployeeKPI);
router.get("/criteria", performanceController.getPerformanceCriteria);

module.exports = router;
