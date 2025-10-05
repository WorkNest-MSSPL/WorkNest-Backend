const express = require("express");
const router = express.Router();

const {
  performanceGoalsOperations,
} = require("../controller/performance/O01_PerformanceGoals.controller.js");
const {
  performanceReviewsOperations,
} = require("../controller/performance/O02_PerformanceReview.controller.js");
const {
  goalProgressOperations,
} = require("../controller/performance/O03_GoalProgress.controller.js");

router.post("/goal", performanceGoalsOperations);
router.post("/review", performanceReviewsOperations);
router.post("/progress", goalProgressOperations);

module.exports = router;
