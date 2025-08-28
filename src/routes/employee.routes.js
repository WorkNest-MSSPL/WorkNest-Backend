const express = require("express");
const router = express.Router();

const {
  registerEmployee,
} = require("../controller/employee/EmployeeRegistration.controller.js");
const {
  updateEmployeeProfile,
} = require("../controller/employee/EmployeeProfileUpdate.controller.js");
const {
  getEmployeeProfileByCode,
} = require("../controller/employee/GetEmpByID.controller.js");

router.post("/register", registerEmployee);
router.post("/profile", updateEmployeeProfile);
router.get("/profile", getEmployeeProfileByCode);

module.exports = router;
