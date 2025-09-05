const express = require("express");
const router = express.Router();

const {
  leavePolicyOperations,
} = require("../controller/leave/L01_LeavePolicy.controller.js");
const {
  leavePolicyRuleOperations,
} = require("../controller/leave/L02_LeavePolicyRule.controller.js");

router.post("/leave-policy", leavePolicyOperations);
router.post("/leave-policy-rule", leavePolicyRuleOperations);

module.exports = router;
