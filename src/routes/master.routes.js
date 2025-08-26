const express = require("express");
const router = express.Router();
const {
  companyOperations,
} = require("../controller/master/M01_CompanyMaster.controller.js");
const {
  departmentOperations,
} = require("../controller/master/M02_DepartmentMaster.controller.js");
const {
  designationOperations,
} = require("../controller/master/M03_DesignationMaster.controller.js");
const {
  branchOperations,
} = require("../controller/master/M04_BranchMaster.controller.js");
const {
  shiftOperations,
} = require("../controller/master/M05_ShiftMaster.controller.js");
const {
  holidayOperations,
} = require("../controller/master/M06_HolidayMaster.controller.js");
const {
  leaveTypeOperations,
} = require("../controller/master/M07_LeaveTypeMaster.controller.js");
const {
  policyOperations,
} = require("../controller/master/M08_PolicyMaster.controller.js");

router.post("/company", companyOperations);
router.post("/department", departmentOperations);
router.post("/designation", designationOperations);
router.post("/branch", branchOperations);
router.post("/shift", shiftOperations);
router.post("/holiday", holidayOperations);
router.post("/leave-type", leaveTypeOperations);
router.post("/policy", policyOperations);

module.exports = router;
