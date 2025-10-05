const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const leaveApprovalOperations = async (req, res) => {
  const {
    type,
    approval_id,
    request_id,
    approver_id,
    approval_level = 1,
    approval_status = "Pending",
    remarks,
  } = req.body;

  try {
    validateLicense();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const pool = await getConnection();
    let result;

    switch (parseInt(type)) {
      case 1: // CREATE APPROVAL RECORD
        result = await pool
          .request()
          .input("request_id", sql.Int, request_id)
          .input("approver_id", sql.Int, approver_id)
          .input("approval_level", sql.Int, approval_level)
          .input("approval_status", sql.NVarChar(20), approval_status)
          .input("remarks", sql.NVarChar(500), remarks || null).query(`
            INSERT INTO L05_leave_approvals 
            (request_id, approver_id, approval_level, approval_status, remarks, action_date)
            OUTPUT INSERTED.*
            VALUES (@request_id, @approver_id, @approval_level, @approval_status, @remarks, 
                   CASE WHEN @approval_status != 'Pending' THEN GETDATE() ELSE NULL END)
          `);

        return res.status(201).json({
          success: true,
          message: "Approval record created successfully",
          data: result.recordset[0],
        });

      case 2: // UPDATE APPROVAL STATUS
        result = await pool
          .request()
          .input("approval_id", sql.Int, approval_id)
          .input("approval_status", sql.NVarChar(20), approval_status)
          .input("remarks", sql.NVarChar(500), remarks || null).query(`
            UPDATE L05_leave_approvals 
            SET approval_status = @approval_status,
                remarks = @remarks,
                action_date = GETDATE()
            OUTPUT INSERTED.*
            WHERE approval_id = @approval_id
          `);

        // Update main leave request status if final approval
        if (approval_status === "Approved" || approval_status === "Rejected") {
          await pool
            .request()
            .input("request_id", sql.Int, request_id)
            .input("status", sql.NVarChar(20), approval_status).query(`
              UPDATE L04_leave_requests 
              SET status = @status, updated_at = GETDATE()
              WHERE request_id = @request_id
            `);

          // If approved, deduct from leave balance
          if (approval_status === "Approved") {
            const leaveRequest = await pool
              .request()
              .input("request_id", sql.Int, request_id).query(`
                SELECT employee_id, leave_type_id, total_days 
                FROM L04_leave_requests 
                WHERE request_id = @request_id
              `);

            if (leaveRequest.recordset[0]) {
              const { employee_id, leave_type_id, total_days } =
                leaveRequest.recordset[0];

              await pool
                .request()
                .input("employee_id", sql.Int, employee_id)
                .input("leave_type_id", sql.Int, leave_type_id)
                .input("total_days", sql.Decimal(6, 2), total_days).query(`
                  UPDATE L03_employee_leave_balance 
                  SET used = used + @total_days,
                      closing_balance = (opening_balance + accrued + carried_forward) - (used + @total_days),
                      last_updated = GETDATE()
                  WHERE employee_id = @employee_id AND leave_type_id = @leave_type_id
                `);
            }
          }
        }

        return res.json({
          success: true,
          message: `Leave request ${approval_status.toLowerCase()} successfully`,
          data: result.recordset[0],
        });

      case 3: // GET APPROVALS BY REQUEST ID
        result = await pool.request().input("request_id", sql.Int, request_id)
          .query(`
            SELECT la.*, 
                   e.first_name, e.last_name, e.employee_code as approver_code
            FROM L05_leave_approvals la
            INNER JOIN E01_employee_master e ON la.approver_id = e.employee_id
            WHERE la.request_id = @request_id
            ORDER BY la.approval_level
          `);

        return res.json({
          success: true,
          data: result.recordset,
        });

      case 4: // GET PENDING APPROVALS FOR APPROVER
        result = await pool.request().input("approver_id", sql.Int, approver_id)
          .query(`
            SELECT la.*, lr.*, 
                   e.first_name, e.last_name, e.employee_code,
                   lt.leave_type_name, d.department_name
            FROM L05_leave_approvals la
            INNER JOIN L04_leave_requests lr ON la.request_id = lr.request_id
            INNER JOIN E01_employee_master e ON lr.employee_id = e.employee_id
            INNER JOIN M07_leave_type_master lt ON lr.leave_type_id = lt.leave_type_id
            LEFT JOIN M02_department_master d ON e.department_id = d.department_id
            WHERE la.approver_id = @approver_id 
            AND la.approval_status = 'Pending'
            AND lr.status = 'Pending'
            ORDER BY la.approval_level, lr.created_at
          `);

        return res.json({
          success: true,
          data: result.recordset,
        });

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid operation type",
        });
    }
  } catch (error) {
    console.error("Error in leaveApprovalOperations:", error);

    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  leaveApprovalOperations,
};
