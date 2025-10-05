const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const leaveRequestOperations = async (req, res) => {
  const {
    type,
    request_id,
    employee_id,
    leave_type_id,
    start_date,
    end_date,
    total_days,
    reason,
    status = "Pending",
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
      case 1: // CREATE LEAVE REQUEST
        // Validate leave balance first
        const balanceCheck = await pool
          .request()
          .input("employee_id", sql.Int, employee_id)
          .input("leave_type_id", sql.Int, leave_type_id).query(`
            SELECT closing_balance FROM L03_employee_leave_balance 
            WHERE employee_id = @employee_id AND leave_type_id = @leave_type_id
          `);

        if (
          !balanceCheck.recordset[0] ||
          balanceCheck.recordset[0].closing_balance < total_days
        ) {
          return res.status(400).json({
            success: false,
            message: "Insufficient leave balance",
          });
        }

        result = await pool
          .request()
          .input("employee_id", sql.Int, employee_id)
          .input("leave_type_id", sql.Int, leave_type_id)
          .input("start_date", sql.Date, start_date)
          .input("end_date", sql.Date, end_date)
          .input("total_days", sql.Decimal(6, 2), total_days)
          .input("reason", sql.NVarChar(500), reason || null)
          .input("status", sql.NVarChar(20), status).query(`
            INSERT INTO L04_leave_requests 
            (employee_id, leave_type_id, start_date, end_date, total_days, reason, status, applied_on, created_at)
            OUTPUT INSERTED.*
            VALUES (@employee_id, @leave_type_id, @start_date, @end_date, @total_days, @reason, @status, GETDATE(), GETDATE())
          `);

        return res.status(201).json({
          success: true,
          message: "Leave request submitted successfully",
          data: result.recordset[0],
        });

      case 2: // UPDATE LEAVE REQUEST
        result = await pool
          .request()
          .input("request_id", sql.Int, request_id)
          .input("start_date", sql.Date, start_date)
          .input("end_date", sql.Date, end_date)
          .input("total_days", sql.Decimal(6, 2), total_days)
          .input("reason", sql.NVarChar(500), reason || null)
          .input("status", sql.NVarChar(20), status).query(`
            UPDATE L04_leave_requests 
            SET start_date = @start_date,
                end_date = @end_date,
                total_days = @total_days,
                reason = @reason,
                status = @status,
                updated_at = GETDATE()
            OUTPUT INSERTED.*
            WHERE request_id = @request_id
          `);

        return res.json({
          success: true,
          message: "Leave request updated successfully",
          data: result.recordset[0],
        });

      case 3: // GET LEAVE REQUEST BY ID
        let query = `
          SELECT lr.*, 
                e.first_name, e.last_name, e.employee_code,
                lt.leave_type_name, lt.leave_type_code
          FROM L04_leave_requests lr
          INNER JOIN E01_employee_master e ON lr.employee_id = e.employee_id
          INNER JOIN M07_leave_type_master lt ON lr.leave_type_id = lt.leave_type_id
        `;

        if (request_id !== -1) {
          query += ` WHERE lr.request_id = @request_id`;
        }

        result = await pool
          .request()
          .input("request_id", sql.Int, request_id)
          .query(query);

        return res.json({
          success: true,
          data:
            request_id === -1 ? result.recordset : result.recordset[0] || null,
        });

      case 4: // GET LEAVE REQUESTS BY EMPLOYEE
        result = await pool.request().input("employee_id", sql.Int, employee_id)
          .query(`
            SELECT lr.*, lt.leave_type_name, lt.leave_type_code
            FROM L04_leave_requests lr
            INNER JOIN M07_leave_type_master lt ON lr.leave_type_id = lt.leave_type_id
            WHERE lr.employee_id = @employee_id
            ORDER BY lr.created_at DESC
          `);

        return res.json({
          success: true,
          data: result.recordset,
        });

      case 5: // GET PENDING REQUESTS FOR APPROVER
        const { approver_id } = req.body;

        result = await pool.request().input("approver_id", sql.Int, approver_id)
          .query(`
            SELECT lr.*, e.first_name, e.last_name, e.employee_code,
                   lt.leave_type_name, d.department_name
            FROM L04_leave_requests lr
            INNER JOIN E01_employee_master e ON lr.employee_id = e.employee_id
            INNER JOIN M07_leave_type_master lt ON lr.leave_type_id = lt.leave_type_id
            LEFT JOIN M02_department_master d ON e.department_id = d.department_id
            WHERE lr.status = 'Pending'
            AND e.supervisor_id = @approver_id
            ORDER BY lr.created_at DESC
          `);

        return res.json({
          success: true,
          data: result.recordset,
        });

      case 6: // CANCEL LEAVE REQUEST
        result = await pool.request().input("request_id", sql.Int, request_id)
          .query(`
            UPDATE L04_leave_requests 
            SET status = 'Cancelled', updated_at = GETDATE()
            WHERE request_id = @request_id AND status = 'Pending'
          `);

        if (result.rowsAffected[0] === 0) {
          return res.status(400).json({
            success: false,
            message: "Cannot cancel request that is not in Pending status",
          });
        }

        return res.json({
          success: true,
          message: "Leave request cancelled successfully",
        });

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid operation type",
        });
    }
  } catch (error) {
    console.error("Error in leaveRequestOperations:", error);

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
  leaveRequestOperations,
};
