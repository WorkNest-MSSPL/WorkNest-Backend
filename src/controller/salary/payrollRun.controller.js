const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const payrollRunsController = {
  /**
   * @desc    Get all payroll runs with period details
   * @route   GET /api/payroll/runs
   * @access  Private
   */
  getAllPayrollRuns: async (req, res) => {
    try {
      validateLicense();

      const { status, period_id } = req.query;
      const pool = await getConnection();

      let query = `
        SELECT 
          pr.*,
          pp.period_name, pp.start_date, pp.end_date, pp.status as period_status,
          e.first_name + ' ' + ISNULL(e.last_name, '') as processed_by_name,
          COUNT(epd.payroll_detail_id) as employee_count,
          SUM(epd.net_salary) as total_net_salary
        FROM P05_payroll_runs pr
        INNER JOIN P01_payroll_periods pp ON pr.period_id = pp.period_id
        LEFT JOIN E01_employee_master e ON pr.processed_by = e.employee_id
        LEFT JOIN P06_employee_payroll_details epd ON pr.payroll_run_id = epd.payroll_run_id
        WHERE 1=1
      `;

      const request = pool.request();

      if (status) {
        query += " AND pr.status = @status";
        request.input("status", status);
      }

      if (period_id) {
        query += " AND pr.period_id = @period_id";
        request.input("period_id", parseInt(period_id));
      }

      query += `GROUP BY pr.payroll_run_id, pr.period_id, pr.run_date, pr.status, pr.processed_by, 
                pr.created_at, pr.updated_at, pp.period_name, pp.start_date, pp.end_date, pp.status,
                e.first_name, e.last_name
                ORDER BY pr.created_at DESC`;

      const result = await request.query(query);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get payroll runs error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get payroll run by ID with detailed breakdown
   * @route   GET /api/payroll/runs/:runId
   * @access  Private
   */
  getPayrollRunById: async (req, res) => {
    try {
      const { runId } = req.params;
      const pool = await getConnection();

      // Get payroll run summary
      const runSummary = await pool
        .request()
        .input("payroll_run_id", parseInt(runId)).query(`
          SELECT 
            pr.*,
            pp.period_name, pp.start_date, pp.end_date,
            e.first_name + ' ' + ISNULL(e.last_name, '') as processed_by_name
          FROM P05_payroll_runs pr
          INNER JOIN P01_payroll_periods pp ON pr.period_id = pp.period_id
          LEFT JOIN E01_employee_master e ON pr.processed_by = e.employee_id
          WHERE pr.payroll_run_id = @payroll_run_id
        `);

      if (runSummary.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Payroll run not found",
        });
      }

      // Get employee payroll details
      const employeeDetails = await pool
        .request()
        .input("payroll_run_id", parseInt(runId)).query(`
          SELECT 
            epd.*,
            e.employee_code, e.first_name, e.last_name,
            d.department_name,
            des.designation_name,
            b.branch_name
          FROM P06_employee_payroll_details epd
          INNER JOIN E01_employee_master e ON epd.employee_id = e.employee_id
          LEFT JOIN M02_department_master d ON e.department_id = d.department_id
          LEFT JOIN M03_designation_master des ON e.designation_id = des.designation_id
          LEFT JOIN M04_branch_master b ON e.branch_id = b.branch_id
          WHERE epd.payroll_run_id = @payroll_run_id
          ORDER BY e.first_name, e.last_name
        `);

      // Get summary totals
      const summaryTotals = await pool
        .request()
        .input("payroll_run_id", parseInt(runId)).query(`
          SELECT 
            COUNT(*) as total_employees,
            SUM(gross_salary) as total_gross_salary,
            SUM(total_earnings) as total_earnings,
            SUM(total_deductions) as total_deductions,
            SUM(net_salary) as total_net_salary,
            SUM(CASE WHEN payment_status = 'Paid' THEN 1 ELSE 0 END) as paid_employees,
            SUM(CASE WHEN payment_status = 'Pending' THEN 1 ELSE 0 END) as pending_employees
          FROM P06_employee_payroll_details
          WHERE payroll_run_id = @payroll_run_id
        `);

      res.json({
        success: true,
        data: {
          payroll_run: runSummary.recordset[0],
          employees: employeeDetails.recordset,
          summary: summaryTotals.recordset[0],
        },
      });
    } catch (error) {
      console.error("Get payroll run details error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Update payroll run status
   * @route   PUT /api/payroll/runs/:runId/status
   * @access  Private (HR/Admin)
   */
  updatePayrollRunStatus: async (req, res) => {
    try {
      const { runId } = req.params;
      const { status } = req.body;
      const userId = getUserId(req);

      if (!status || !["Draft", "Finalized", "Cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Valid status (Draft, Finalized, Cancelled) is required",
        });
      }

      const pool = await getConnection();

      // Check if payroll run exists
      const existingRun = await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .query(
          "SELECT * FROM P05_payroll_runs WHERE payroll_run_id = @payroll_run_id"
        );

      if (existingRun.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Payroll run not found",
        });
      }

      // Update status
      await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .input("status", status)
        .input("updated_by", userId).query(`
          UPDATE P05_payroll_runs 
          SET status = @status, updated_at = GETDATE()
          WHERE payroll_run_id = @payroll_run_id
        `);

      res.json({
        success: true,
        message: `Payroll run status updated to ${status} successfully`,
      });
    } catch (error) {
      console.error("Update payroll run status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Cancel payroll run
   * @route   PUT /api/payroll/runs/:runId/cancel
   * @access  Private (HR/Admin)
   */
  cancelPayrollRun: async (req, res) => {
    try {
      const { runId } = req.params;
      const userId = getUserId(req);

      const pool = await getConnection();

      // Check if payroll run exists and is not already cancelled
      const existingRun = await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .query(
          "SELECT * FROM P05_payroll_runs WHERE payroll_run_id = @payroll_run_id AND status != 'Cancelled'"
        );

      if (existingRun.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Payroll run not found or already cancelled",
        });
      }

      // Update status to cancelled
      await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .input("updated_by", userId).query(`
          UPDATE P05_payroll_runs 
          SET status = 'Cancelled', updated_at = GETDATE()
          WHERE payroll_run_id = @payroll_run_id
        `);

      res.json({
        success: true,
        message: "Payroll run cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel payroll run error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = { payrollRunsController };
