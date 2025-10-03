const { getConnection, sql } = require("../../config/database.js");
const { getUserId } = require("../../utils/UserInfo.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const employeePayrollDetailsController = {
  /**
   * @desc    Get employee payroll details for a run
   * @route   GET /api/payroll/runs/:runId/employees/:employeeId
   * @access  Private
   */
  getEmployeePayrollDetails: async (req, res) => {
    try {
      const { runId, employeeId } = req.params;
      const pool = await getConnection();

      // Get basic payroll details
      const payrollDetails = await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .input("employee_id", parseInt(employeeId)).query(`
          SELECT 
            epd.*,
            e.employee_code, e.first_name, e.last_name,
            d.department_name,
            des.designation_name,
            b.branch_name,
            c.company_name
          FROM P06_employee_payroll_details epd
          INNER JOIN E01_employee_master e ON epd.employee_id = e.employee_id
          LEFT JOIN M02_department_master d ON e.department_id = d.department_id
          LEFT JOIN M03_designation_master des ON e.designation_id = des.designation_id
          LEFT JOIN M04_branch_master b ON e.branch_id = b.branch_id
          LEFT JOIN M01_company_master c ON e.company_id = c.company_id
          WHERE epd.payroll_run_id = @payroll_run_id AND epd.employee_id = @employee_id
        `);

      if (payrollDetails.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Employee payroll details not found",
        });
      }

      // Get earnings breakdown
      const earnings = await pool
        .request()
        .input(
          "payroll_detail_id",
          payrollDetails.recordset[0].payroll_detail_id
        ).query(`
          SELECT 
            pe.*,
            pcm.component_name, pcm.component_type, pcm.description
          FROM P07_payroll_earnings pe
          INNER JOIN M17_payroll_component_master pcm ON pe.component_id = pcm.component_id
          WHERE pe.payroll_detail_id = @payroll_detail_id
          ORDER BY pe.amount DESC
        `);

      // Get deductions breakdown
      const deductions = await pool
        .request()
        .input(
          "payroll_detail_id",
          payrollDetails.recordset[0].payroll_detail_id
        ).query(`
          SELECT 
            pd.*,
            pcm.component_name, pcm.component_type, pcm.description
          FROM P08_payroll_deductions pd
          INNER JOIN M17_payroll_component_master pcm ON pd.component_id = pcm.component_id
          WHERE pd.payroll_detail_id = @payroll_detail_id
          ORDER BY pd.amount DESC
        `);

      res.json({
        success: true,
        data: {
          payroll_details: payrollDetails.recordset[0],
          earnings: earnings.recordset,
          deductions: deductions.recordset,
        },
      });
    } catch (error) {
      console.error("Get employee payroll details error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Update employee payment status
   * @route   PUT /api/payroll/runs/:runId/employees/:employeeId/payment-status
   * @access  Private (HR/Admin)
   */
  updatePaymentStatus: async (req, res) => {
    try {
      const { runId, employeeId } = req.params;
      const { payment_status, payment_date } = req.body;

      if (
        !payment_status ||
        !["Pending", "Paid", "On Hold"].includes(payment_status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid payment status (Pending, Paid, On Hold) is required",
        });
      }

      const pool = await getConnection();

      // Check if employee payroll record exists
      const existingRecord = await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .input("employee_id", parseInt(employeeId))
        .query(
          "SELECT * FROM P06_employee_payroll_details WHERE payroll_run_id = @payroll_run_id AND employee_id = @employee_id"
        );

      if (existingRecord.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Employee payroll record not found",
        });
      }

      // Update payment status
      const updateQuery =
        payment_status === "Paid"
          ? `
          UPDATE P06_employee_payroll_details 
          SET payment_status = @payment_status, 
              payment_date = @payment_date
          WHERE payroll_run_id = @payroll_run_id AND employee_id = @employee_id
        `
          : `
          UPDATE P06_employee_payroll_details 
          SET payment_status = @payment_status,
              payment_date = NULL
          WHERE payroll_run_id = @payroll_run_id AND employee_id = @employee_id
        `;

      const request = pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .input("employee_id", parseInt(employeeId))
        .input("payment_status", payment_status);

      if (payment_status === "Paid") {
        request.input("payment_date", payment_date || new Date());
      }

      await request.query(updateQuery);

      res.json({
        success: true,
        message: `Payment status updated to ${payment_status} successfully`,
      });
    } catch (error) {
      console.error("Update payment status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get payroll history for an employee
   * @route   GET /api/employees/:employeeId/payroll-history
   * @access  Private
   */
  getEmployeePayrollHistory: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { year, month } = req.query;
      const pool = await getConnection();

      let query = `
        SELECT 
          epd.*,
          pr.run_date,
          pp.period_name, pp.start_date, pp.end_date,
          pr.status as run_status
        FROM P06_employee_payroll_details epd
        INNER JOIN P05_payroll_runs pr ON epd.payroll_run_id = pr.payroll_run_id
        INNER JOIN P01_payroll_periods pp ON pr.period_id = pp.period_id
        WHERE epd.employee_id = @employee_id
      `;

      const request = pool.request().input("employee_id", parseInt(employeeId));

      if (year) {
        query += " AND YEAR(pp.start_date) = @year";
        request.input("year", parseInt(year));
      }

      if (month) {
        query += " AND MONTH(pp.start_date) = @month";
        request.input("month", parseInt(month));
      }

      query += " ORDER BY pp.start_date DESC";

      const result = await request.query(query);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get employee payroll history error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = { employeePayrollDetailsController };
