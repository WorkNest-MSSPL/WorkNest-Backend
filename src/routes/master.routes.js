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
const {
  bankOperations,
} = require("../controller/master/M09_BankMaster.controller.js");
const {
  countryOperations,
} = require("../controller/master/M10_CountryMaster.controller.js");
const {
  stateOperations,
} = require("../controller/master/M11_StateMaster.controller.js");
const {
  cityOperations,
} = require("../controller/master/M12_CityMaster.controller.js");
const {
  roleOperations,
} = require("../controller/master/M13_RoleMaster.controller.js");
const {
  menuOperations,
} = require("../controller/master/M14_MenuMaster.controller.js");
const {
  notificationTemplateOperations,
} = require("../controller/master/M15_NotificationTemplateMaster.controller.js");
const {
  overtimePolicyOperations,
} = require("../controller/master/M16_OvertimePolicyMaster.controller.js");
const {
  payrollComponentOperations,
} = require("../controller/master/M17_PayrollComponentMaster.controller.js");
const {
  visitorTypeOperations,
} = require("../controller/master/M18_VisitorTypeMaster.controller.js");
const {
  trainingTypeOperations,
} = require("../controller/master/M19_TrainingTypeMaster.controller.js");
const {
  expenseCategoryOperations,
} = require("../controller/master/M20_ExpenceCategoryMaster.controller.js");
const {
  zoneOperations,
} = require("../controller/master/M21_ZoneMaster.controller.js");
const {
  wardOperations,
} = require("../controller/master/M22_WardMaster.controller.js");
const {
  areaOperations,
} = require("../controller/master/M23_AreaMaster.controller.js");
const {
  beatOperations,
} = require("../controller/master/M24_BeatMaster.controller.js");
const {
  projectMasterOperations,
} = require("../controller/master/M25_ProjectMaster.controller.js");
const {
  projectMembersOperations,
} = require("../controller/master/M26_ProjectMembers.controller.js");

router.post("/company", companyOperations);
router.post("/department", departmentOperations);
router.post("/designation", designationOperations);
router.post("/branch", branchOperations);
router.post("/shift", shiftOperations);
router.post("/holiday", holidayOperations);
router.post("/leave-type", leaveTypeOperations);
router.post("/policy", policyOperations);
router.post("/bank", bankOperations);
router.post("/country", countryOperations);
router.post("/state", stateOperations);
router.post("/city", cityOperations);
router.post("/role", roleOperations);
router.post("/menu", menuOperations);
router.post("/notification-template", notificationTemplateOperations);
router.post("/overtime-policy", overtimePolicyOperations);
router.post("/payroll-component", payrollComponentOperations);
router.post("/visitor-type", visitorTypeOperations);
router.post("/training-type", trainingTypeOperations);
router.post("/training-type", trainingTypeOperations);
router.post("/expense-category", expenseCategoryOperations);
router.post("/zone", zoneOperations);
router.post("/ward", wardOperations);
router.post("/area", areaOperations);
router.post("/beat", beatOperations);
router.post("/project", projectMasterOperations);
router.post("/projectMembers", projectMembersOperations);

module.exports = router;
