const express = require("express");
const router = express.Router();

const {
  getAttendanceData,
  getAttendanceSummary,
} = require("../controller/attendance/attendanceVisualization.controller.js");

router.post("/report", getAttendanceData);
router.post("/summary", getAttendanceSummary);

module.exports = router;
