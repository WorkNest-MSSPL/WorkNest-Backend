const express = require("express");
const router = express.Router();

const {
  visitorReportOperations,
} = require("../controller/visitor/VisitorReport.controller.js");
const {
  visitorManageOperations,
} = require("../controller/visitor/VisitorManage.controller.js");

router.post("/report", visitorReportOperations);
router.post("/manage", visitorManageOperations);

module.exports = router;
