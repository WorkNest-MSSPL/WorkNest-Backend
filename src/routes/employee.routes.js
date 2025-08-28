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
const {
  getAllEmployees,
} = require("../controller/employee/GetAllEmployee.controller.js");

router.post("/register", registerEmployee);
router.post("/profile", updateEmployeeProfile);
router.post("/getById", getEmployeeProfileByCode);
router.get("/getAll", getAllEmployees);

module.exports = router;
