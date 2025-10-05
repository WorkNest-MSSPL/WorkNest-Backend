const { getConnection, sql } = require("../../config/database.js");
const { getUserId } = require("../../utils/UserInfo.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const bankTransferFileController = {
  /**
   * @desc    Generate bank transfer file for payroll run
   * @route   POST /api/payroll/runs/:runId/bank-transfer-file
   * @access  Private (HR/Admin)
   */
  generateBankTransferFile: async (req, res) => {
    try {
      validateLicense();
      const { runId } = req.params;
      const { bank_id } = req.body;
      const userId = getUserId(req);

      if (!bank_id) {
        return res.status(400).json({
          success: false,
          message: "Bank ID is required",
        });
      }

      const pool = await getConnection();

      // Check if payroll run exists and is finalized
      const payrollRun = await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .query(
          "SELECT * FROM P05_payroll_runs WHERE payroll_run_id = @payroll_run_id AND status = 'Finalized'"
        );

      if (payrollRun.recordset.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Payroll run not found or not finalized",
        });
      }

      // Check if bank exists
      const bank = await pool
        .request()
        .input("bank_id", bank_id)
        .query("SELECT * FROM M09_bank_master WHERE bank_id = @bank_id");

      if (bank.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Bank not found",
        });
      }

      // Check if transfer file already exists
      const existingFile = await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .input("bank_id", bank_id)
        .query(
          "SELECT * FROM P10_bank_transfer_file WHERE payroll_run_id = @payroll_run_id AND bank_id = @bank_id"
        );

      if (existingFile.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Bank transfer file already generated for this payroll run and bank",
        });
      }

      // Get employees with bank accounts for this bank
      const employees = await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .input("bank_id", bank_id).query(`
          SELECT 
            epd.*,
            e.first_name, e.last_name, e.employee_code,
            eb.account_number, eb.ifsc_code, eb.account_holder_name
          FROM P06_employee_payroll_details epd
          INNER JOIN E01_employee_master e ON epd.employee_id = e.employee_id
          INNER JOIN E04_employee_bank_details eb ON e.employee_id = eb.employee_id
          WHERE epd.payroll_run_id = @payroll_run_id 
            AND eb.bank_id = @bank_id
            AND eb.is_primary = 1
            AND epd.payment_status = 'Pending'
          ORDER BY e.employee_code
        `);

      if (employees.recordset.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "No employees found with bank accounts for the specified bank",
        });
      }

      // Generate transfer file (simulated)
      const fileUrl = `/bank-files/payroll_${runId}_${bank_id}_${Date.now()}.txt`;

      // TODO: Implement actual file generation logic
      // This would typically involve:
      // 1. Formatting data according to bank's specifications
      // 2. Creating CSV/TXT file with account numbers, amounts, etc.
      // 3. Uploading to secure location

      // Insert bank transfer file record
      await pool
        .request()
        .input("payroll_run_id", parseInt(runId))
        .input("bank_id", bank_id)
        .input("file_url", fileUrl)
        .input("status", "Generated").query(`
          INSERT INTO P10_bank_transfer_file (payroll_run_id, bank_id, file_url, generated_on, status)
          VALUES (@payroll_run_id, @bank_id, @file_url, GETDATE(), @status)
        `);

      res.status(201).json({
        success: true,
        message: "Bank transfer file generated successfully",
        data: {
          file_url: fileUrl,
          employees_count: employees.recordset.length,
          total_amount: employees.recordset.reduce(
            (sum, emp) => sum + parseFloat(emp.net_salary),
            0
          ),
          status: "Generated",
        },
      });
    } catch (error) {
      console.error("Generate bank transfer file error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get bank transfer files for payroll run
   * @route   GET /api/payroll/runs/:runId/bank-transfer-files
   * @access  Private
   */
  getBankTransferFiles: async (req, res) => {
    try {
      const { runId } = req.params;
      const pool = await getConnection();

      const result = await pool
        .request()
        .input("payroll_run_id", parseInt(runId)).query(`
          SELECT 
            btf.*,
            bm.bank_name, bm.bank_code,
            COUNT(epd.employee_id) as employees_count,
            SUM(epd.net_salary) as total_amount
          FROM P10_bank_transfer_file btf
          INNER JOIN M09_bank_master bm ON btf.bank_id = bm.bank_id
          LEFT JOIN P06_employee_payroll_details epd ON btf.payroll_run_id = epd.payroll_run_id
          LEFT JOIN E04_employee_bank_details ebd ON epd.employee_id = ebd.employee_id AND ebd.bank_id = btf.bank_id
          WHERE btf.payroll_run_id = @payroll_run_id
          GROUP BY btf.transfer_file_id, btf.payroll_run_id, btf.bank_id, btf.file_url, 
                   btf.generated_on, btf.status, bm.bank_name, bm.bank_code
          ORDER BY btf.generated_on DESC
        `);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get bank transfer files error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Update bank transfer file status
   * @route   PUT /api/payroll/bank-transfer-files/:fileId/status
   * @access  Private (HR/Admin)
   */
  updateBankTransferFileStatus: async (req, res) => {
    try {
      const { fileId } = req.params;
      const { status } = req.body;

      if (!status || !["Generated", "Sent", "Acknowledged"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Valid status (Generated, Sent, Acknowledged) is required",
        });
      }

      const pool = await getConnection();

      // Check if file exists
      const existingFile = await pool
        .request()
        .input("transfer_file_id", parseInt(fileId))
        .query(
          "SELECT * FROM P10_bank_transfer_file WHERE transfer_file_id = @transfer_file_id"
        );

      if (existingFile.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Bank transfer file not found",
        });
      }

      // Update status
      await pool
        .request()
        .input("transfer_file_id", parseInt(fileId))
        .input("status", status).query(`
          UPDATE P10_bank_transfer_file 
          SET status = @status
          WHERE transfer_file_id = @transfer_file_id
        `);

      // If status is Acknowledged, update payment status for employees
      if (status === "Acknowledged") {
        await pool.request().input("transfer_file_id", parseInt(fileId)).query(`
            UPDATE epd
            SET epd.payment_status = 'Paid', epd.payment_date = GETDATE()
            FROM P06_employee_payroll_details epd
            INNER JOIN P10_bank_transfer_file btf ON epd.payroll_run_id = btf.payroll_run_id
            INNER JOIN E04_employee_bank_details ebd ON epd.employee_id = ebd.employee_id AND ebd.bank_id = btf.bank_id
            WHERE btf.transfer_file_id = @transfer_file_id 
              AND epd.payment_status = 'Pending'
          `);
      }

      res.json({
        success: true,
        message: `Bank transfer file status updated to ${status} successfully`,
      });
    } catch (error) {
      console.error("Update bank transfer file status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = { bankTransferFileController };
