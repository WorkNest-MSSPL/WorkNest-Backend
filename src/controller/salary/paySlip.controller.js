const { getConnection, sql } = require("../../config/database.js");
const { getUserId } = require("../../utils/UserInfo.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const payslipController = {
  /**
   * @desc    Generate payslip for employee
   * @route   POST /api/payroll/runs/:runId/employees/:employeeId/payslip
   * @access  Private (HR/Admin)
   */
  generatePayslip: async (req, res) => {
    try {
      const { runId, employeeId } = req.params;
      const userId = getUserId(req);
      const pool = await getConnection();

      // Check if payroll detail exists
      const payrollDetail = await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .input("employee_id", parseInt(employeeId)).query(`
          SELECT pd.* FROM P06_employee_payroll_details pd
          WHERE pd.payroll_run_id = @payroll_run_id AND pd.employee_id = @employee_id
        `);

      if (payrollDetail.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Payroll record not found",
        });
      }

      const payrollDetailId = payrollDetail.recordset[0].payroll_detail_id;

      // Check if payslip already exists
      const existingPayslip = await pool
        .request()
        .input("payroll_detail_id", payrollDetailId)
        .query(
          "SELECT * FROM P09_payslip WHERE payroll_detail_id = @payroll_detail_id"
        );

      if (existingPayslip.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Payslip already generated for this payroll record",
        });
      }

      // Generate PDF (simulated - in real implementation, use PDF generation library)
      const pdfUrl = `/payslips/${runId}/employee_${employeeId}_${Date.now()}.pdf`;

      // Insert payslip record
      await pool
        .request()
        .input("payroll_detail_id", payrollDetailId)
        .input("pdf_url", pdfUrl).query(`
          INSERT INTO P09_payslip (payroll_detail_id, pdf_url, generated_on)
          VALUES (@payroll_detail_id, @pdf_url, GETDATE())
        `);

      // TODO: Implement actual PDF generation logic
      // This would typically involve:
      // 1. Fetching all payroll data
      // 2. Using a template engine
      // 3. Generating PDF with pdfkit, puppeteer, etc.
      // 4. Uploading to cloud storage

      res.status(201).json({
        success: true,
        message: "Payslip generated successfully",
        data: {
          pdf_url: pdfUrl,
          generated_on: new Date(),
        },
      });
    } catch (error) {
      console.error("Generate payslip error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get payslip by payroll detail ID
   * @route   GET /api/payslips/:payrollDetailId
   * @access  Private
   */
  getPayslip: async (req, res) => {
    try {
      const { payrollDetailId } = req.params;
      const pool = await getConnection();

      const result = await pool
        .request()
        .input("payroll_detail_id", parseInt(payrollDetailId)).query(`
          SELECT 
            ps.*,
            epd.employee_id, epd.net_salary,
            e.employee_code, e.first_name, e.last_name,
            pp.period_name, pp.start_date, pp.end_date,
            pr.run_date
          FROM P09_payslip ps
          INNER JOIN P06_employee_payroll_details epd ON ps.payroll_detail_id = epd.payroll_detail_id
          INNER JOIN E01_employee_master e ON epd.employee_id = e.employee_id
          INNER JOIN P05_payroll_runs pr ON epd.payroll_run_id = pr.payroll_run_id
          INNER JOIN P01_payroll_periods pp ON pr.period_id = pp.period_id
          WHERE ps.payroll_detail_id = @payroll_detail_id
        `);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Payslip not found",
        });
      }

      res.json({
        success: true,
        data: result.recordset[0],
      });
    } catch (error) {
      console.error("Get payslip error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get all payslips for a payroll run
   * @route   GET /api/payroll/runs/:runId/payslips
   * @access  Private (HR/Admin)
   */
  getPayrollRunPayslips: async (req, res) => {
    try {
      const { runId } = req.params;
      const pool = await getConnection();

      const result = await pool
        .request()
        .input("payroll_run_id", parseInt(runId)).query(`
          SELECT 
            ps.*,
            epd.employee_id, epd.net_salary,
            e.employee_code, e.first_name, e.last_name,
            d.department_name,
            des.designation_name
          FROM P09_payslip ps
          INNER JOIN P06_employee_payroll_details epd ON ps.payroll_detail_id = epd.payroll_detail_id
          INNER JOIN E01_employee_master e ON epd.employee_id = e.employee_id
          LEFT JOIN M02_department_master d ON e.department_id = d.department_id
          LEFT JOIN M03_designation_master des ON e.designation_id = des.designation_id
          WHERE epd.payroll_run_id = @payroll_run_id
          ORDER BY e.first_name, e.last_name
        `);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get payroll run payslips error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = { payslipController };
