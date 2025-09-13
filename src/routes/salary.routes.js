const express = require("express");
const router = express.Router();

const {
  payrollPeriodOperations,
} = require("../controller/salary/P01_PayrollPeriodMaster.controller.js");
const {
  salaryStructureOperations,
} = require("../controller/salary/P02_SalaryStructureMaster.controller.js");
const {
  salaryStructureComponentsOperations,
} = require("../controller/salary/P03_SalaryStructureComponent.controller.js");

router.post("/payroll-period", payrollPeriodOperations);
router.post("/salary-structure", salaryStructureOperations);
router.post("/salary-structure-component", salaryStructureComponentsOperations);

module.exports = router;
