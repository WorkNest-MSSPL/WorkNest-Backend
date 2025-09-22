const express = require("express");
const router = express.Router();

const {
  trainingMasterOperations,
} = require("../controller/training/O04_TrainingMaster.controller.js");
const {
  trainingEnrollmentsOperations,
} = require("../controller/training/O05_TrainingEnrollments.controller.js");
const {
  trainingFeedbackOperations,
} = require("../controller/training/O06_TrainingFeedback.controller.js");

router.post("/master", trainingMasterOperations);
router.post("/enrollments", trainingEnrollmentsOperations);
router.post("/feedback", trainingFeedbackOperations);

module.exports = router;
