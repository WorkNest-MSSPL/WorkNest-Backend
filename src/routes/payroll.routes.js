const express = require("express");
const router = express.Router();

// Import all payroll controllers
const {
  salaryComponentOperations,
} = require("../controller/payroll/salaryComponent.controller");
const {
  salaryTemplateOperations,
} = require("../controller/payroll/salaryTemplate.controller");
const {
  templateComponentOperations,
} = require("../controller/payroll/templateComponent.controller");
const {
  employeeSalaryOperations,
} = require("../controller/payroll/employeeSalary.controller");
const {
  payrollCycleOperations,
} = require("../controller/payroll/payrollCycle.controller");
const {
  payrollTransactionOperations,
} = require("../controller/payroll/payrollTransaction.controller");
const {
  payrollComponentsOperations,
} = require("../controller/payroll/payrollComponents.controller");
const { loanOperations } = require("../controller/payroll/loan.controller");
const {
  reimbursementOperations,
} = require("../controller/payroll/reimbursement.controller");
const {
  taxDeclarationOperations,
} = require("../controller/payroll/taxDeclaration.controller");
const {
  requestCategoryOperations,
} = require("../controller/payroll/requestCategory.controller");
const {
  workflowMasterOperations,
} = require("../controller/payroll/workflow.controller");
const {
  employeeApproverOperations,
} = require("../controller/payroll/empApprover.controller");
const {
  employeeRequestOperations,
} = require("../controller/payroll/empRequest.controller");

// ============================================================================
// SALARY STRUCTURE ROUTES
// ============================================================================

// #swagger.tags = ['Salary Structure']
// #swagger.description = 'Salary Component Operations: Type 1=Create, 2=Update, 3=GetAll, 4=GetByID'
router.post("/salary-component", salaryComponentOperations);

// #swagger.tags = ['Salary Structure']
// #swagger.description = 'Salary Template Operations: Type 1=Create, 2=Update, 3=GetAll, 4=GetByID'
router.post("/salary-template", salaryTemplateOperations);

// #swagger.tags = ['Salary Structure']
// #swagger.description = 'Template Component Mapping: Type 1=Add, 2=Update, 3=GetAll, 4=Delete, 5=Calculate'
router.post("/template-components", templateComponentOperations);

// #swagger.tags = ['Salary Structure']
// #swagger.description = 'Employee Salary Structure Operations: Type 1=Create, 3=GetAll, 4=GetByEmployeeID'
router.post("/employee-salary", employeeSalaryOperations);

// ============================================================================
// PAYROLL PROCESSING ROUTES
// ============================================================================

// #swagger.tags = ['Payroll Processing']
// #swagger.description = 'Payroll Cycle Operations: Type 1=Create, 3=GetAll, 4=GetByID, 5=UpdateStatus'
router.post("/payroll-cycle", payrollCycleOperations);

// #swagger.tags = ['Payroll Processing']
// #swagger.description = 'Payroll Transaction Operations: Type 1=Calculate, 3=GetAll, 4=GetByID, 6=GetEmployeePayslips, 7=GetPayslipComponents'
router.post("/payroll-transaction", payrollTransactionOperations);

// #swagger.tags = ['Payroll Processing']
// #swagger.description = 'Payroll Components: Type 7=GetPayslipComponents'
router.post("/payroll-components", payrollComponentsOperations);

// ============================================================================
// LOAN MANAGEMENT ROUTES
// ============================================================================

// #swagger.tags = ['Loan Management']
router.post("/loan", loanOperations);

// ============================================================================
// REIMBURSEMENT ROUTES
// ============================================================================

// #swagger.tags = ['Reimbursement']
// #swagger.description = 'Reimbursement Operations: Type 1=Create, 3=GetAll, 5=Approve/Reject'
router.post("/reimbursement", reimbursementOperations);

// ============================================================================
// TAX_DECLARATION ROUTES
// ============================================================================

// #swagger.tags = ['Tax Declaration']
// #swagger.description = 'Tax Declaration Operations: Type 1=Create/Update, 3=GetAll'
router.post("/tax-declaration", taxDeclarationOperations);

// Request Category Routes
router.post("/request-categories", requestCategoryOperations);

// Workflow Master Routes
router.post("/request-workflows", workflowMasterOperations);

// Employee Approver Mapping Routes
router.post("/request-approvers", employeeApproverOperations);

// Employee Request Routes
router.post("/requests", employeeRequestOperations);

module.exports = router;
