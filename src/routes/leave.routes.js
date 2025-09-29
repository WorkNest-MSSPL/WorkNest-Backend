const express = require("express");
const router = express.Router();

const {
  leavePolicyOperations,
} = require("../controller/leave/L01_LeavePolicy.controller.js");
const {
  leavePolicyRuleOperations,
} = require("../controller/leave/L02_LeavePolicyRule.controller.js");
const {
  leaveAssignmentOperations,
} = require("../controller/leave/LeaveAssignment.controller.js");
const {
  leaveBalanceOperations,
} = require("../controller/leave/LeaveBalance.controller.js");
const {
  leaveRequestOperations,
} = require("../controller/leave/LeaveRequest.controller.js");
const {
  leaveApprovalOperations,
} = require("../controller/leave/LeaveApproval.controller.js");

router.post("/leave-policy", leavePolicyOperations);
router.post("/leave-policy-rule", leavePolicyRuleOperations);

// Leave Assignment Routes
router.post("/leave-assignments", leaveAssignmentOperations);

// Leave Balance Routes
router.post("/leave-balances", leaveBalanceOperations);

// Leave Request Routes
router.post("/leave-requests", leaveRequestOperations);

// Leave Approval Routes
router.post("/leave-approvals", leaveApprovalOperations);

module.exports = router;
