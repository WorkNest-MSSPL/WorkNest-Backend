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
const {
  employeeSalaryStructureOperations,
} = require("../controller/salary/P04_EmployeeSalaryStructure.controller.js");

const {
  payrollRunsController,
} = require("../controller/salary/payrollRun.controller.js");
const {
  employeePayrollDetailsController,
} = require("../controller/salary/empPayrollDetail.controller.js");
const {
  payslipController,
} = require("../controller/salary/paySlip.controller.js");
const {
  bankTransferFileController,
} = require("../controller/salary/bankTransfer.controller.js");
const {
  taxConfigurationController,
} = require("../controller/salary/taxConfig.controller.js");

router.post("/payroll-period", payrollPeriodOperations);
router.post("/salary-structure", salaryStructureOperations);
router.post("/salary-structure-component", salaryStructureComponentsOperations);
router.post("/employee-salary-structure", employeeSalaryStructureOperations);

// Payroll Runs Routes
router.get("/payroll/runs", payrollRunsController.getAllPayrollRuns);
router.get("/payroll/runs/:runId", payrollRunsController.getPayrollRunById);
router.put(
  "/payroll/runs/:runId/status",
  payrollRunsController.updatePayrollRunStatus
);
router.put(
  "/payroll/runs/:runId/cancel",
  payrollRunsController.cancelPayrollRun
);

// Employee Payroll Details Routes
router.get(
  "/payroll/runs/:runId/employees/:employeeId",
  employeePayrollDetailsController.getEmployeePayrollDetails
);
router.put(
  "/payroll/runs/:runId/employees/:employeeId/payment-status",
  employeePayrollDetailsController.updatePaymentStatus
);
router.get(
  "/employees/:employeeId/payroll-history",
  employeePayrollDetailsController.getEmployeePayrollHistory
);

// Payslip Routes
router.post(
  "/payroll/runs/:runId/employees/:employeeId/payslip",
  payslipController.generatePayslip
);
router.get("/payslips/:payrollDetailId", payslipController.getPayslip);
router.get(
  "/payroll/runs/:runId/payslips",
  payslipController.getPayrollRunPayslips
);

// Bank Transfer File Routes
router.post(
  "/payroll/runs/:runId/bank-transfer-file",
  bankTransferFileController.generateBankTransferFile
);
router.get(
  "/payroll/runs/:runId/bank-transfer-files",
  bankTransferFileController.getBankTransferFiles
);
router.put(
  "/payroll/bank-transfer-files/:fileId/status",
  bankTransferFileController.updateBankTransferFileStatus
);

// Tax Configuration Routes
router.post(
  "/tax-configurations",
  taxConfigurationController.createTaxConfiguration
);
router.get(
  "/tax-configurations",
  taxConfigurationController.getTaxConfigurations
);
router.post(
  "/employees/:employeeId/tax-exemptions",
  taxConfigurationController.assignEmployeeTaxExemption
);
router.get(
  "/employees/:employeeId/tax-details",
  taxConfigurationController.getEmployeeTaxDetails
);

module.exports = router;
