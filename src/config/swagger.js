// Auto-generate Swagger documentation from routes
const swaggerAutogen = require('swagger-autogen')();

const doc = {
  info: {
    title: 'WorkNest Payroll Management API',
    version: '1.0.0',
    description: 'Complete Industrial-Level Payroll Management System - Auto-Generated API Documentation'
  },
  host: 'localhost:3000',
  schemes: ['http'],
  consumes: ['application/json'],
  produces: ['application/json'],
  tags: [
    { name: 'Salary Structure', description: 'Salary components, templates, and employee salary management' },
    { name: 'Payroll Processing', description: 'Payroll cycles and transaction processing' },
    { name: 'Loan Management', description: 'Employee loan applications and management' },
    { name: 'Reimbursement', description: 'Expense reimbursement claims' },
    { name: 'Tax Declaration', description: 'Employee tax declarations and calculations' }
  ],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'Authorization',
      description: 'Enter your bearer token in the format: Bearer <token>'
    }
  },
  definitions: {
    SalaryComponentRequest: {
      type: 'integer',
      component_code: 'BASIC',
      component_name: 'Basic Salary',
      component_type: 1,
      calculation_type: 1,
      is_taxable: true,
      is_pf_applicable: true
    },
    PayrollCycleRequest: {
      type: 1,
      company_id: 1,
      salary_month: 10,
      salary_year: 2024,
      pay_period_from: '2024-10-01',
      pay_period_to: '2024-10-31',
      working_days: 26
    },
    LoanRequest: {
      type: 1,
      employee_id: 1,
      loan_type_id: 1,
      loan_amount: 50000,
      interest_rate: 8.5,
      tenure_months: 12,
      emi_amount: 4375
    },
    ApiResponse: {
      success: true,
      message: 'Operation successful',
      data: {}
    }
  }
};

const outputFile = './src/config/swagger-output.json';
const endpointsFiles = ['./src/index.js'];

// Generate swagger documentation
swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  require('../index.js');
});

module.exports = doc;
