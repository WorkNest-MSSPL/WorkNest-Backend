const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const leaveBalanceOperations = async (req, res) => {
  const {
    type,
    balance_id,
    employee_id,
    leave_type_id,
    opening_balance = 0,
    accrued = 0,
    used = 0,
    carried_forward = 0,
    closing_balance = 0,
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
      case 1: // INSERT/INITIALIZE BALANCE
        result = await pool
          .request()
          .input("employee_id", sql.Int, employee_id)
          .input("leave_type_id", sql.Int, leave_type_id)
          .input("opening_balance", sql.Decimal(6, 2), opening_balance)
          .input("accrued", sql.Decimal(6, 2), accrued)
          .input("used", sql.Decimal(6, 2), used)
          .input("carried_forward", sql.Decimal(6, 2), carried_forward)
          .input("closing_balance", sql.Decimal(6, 2), closing_balance).query(`
            INSERT INTO L03_employee_leave_balance 
            (employee_id, leave_type_id, opening_balance, accrued, used, carried_forward, closing_balance, last_updated)
            OUTPUT INSERTED.*
            VALUES (@employee_id, @leave_type_id, @opening_balance, @accrued, @used, @carried_forward, @closing_balance, GETDATE())
          `);

        return res.status(201).json({
          success: true,
          message: "Leave balance initialized successfully",
          data: result.recordset[0],
        });

      case 2: // UPDATE BALANCE
        result = await pool
          .request()
          .input("balance_id", sql.Int, balance_id)
          .input("opening_balance", sql.Decimal(6, 2), opening_balance)
          .input("accrued", sql.Decimal(6, 2), accrued)
          .input("used", sql.Decimal(6, 2), used)
          .input("carried_forward", sql.Decimal(6, 2), carried_forward)
          .input("closing_balance", sql.Decimal(6, 2), closing_balance).query(`
            UPDATE L03_employee_leave_balance 
            SET opening_balance = @opening_balance,
                accrued = @accrued,
                used = @used,
                carried_forward = @carried_forward,
                closing_balance = @closing_balance,
                last_updated = GETDATE()
            OUTPUT INSERTED.*
            WHERE balance_id = @balance_id
          `);

        return res.json({
          success: true,
          message: "Leave balance updated successfully",
          data: result.recordset[0],
        });

      case 3: // GET BALANCE BY EMPLOYEE AND LEAVE TYPE
        result = await pool
          .request()
          .input("employee_id", sql.Int, employee_id)
          .input("leave_type_id", sql.Int, leave_type_id).query(`
            SELECT * FROM L03_employee_leave_balance 
            WHERE employee_id = @employee_id AND leave_type_id = @leave_type_id
          `);

        return res.json({
          success: true,
          data: result.recordset[0] || null,
        });

      case 4: // GET ALL BALANCES FOR EMPLOYEE
        result = await pool.request().input("employee_id", sql.Int, employee_id)
          .query(`
            SELECT lb.*, lt.leave_type_name, lt.leave_type_code
            FROM L03_employee_leave_balance lb
            INNER JOIN M07_leave_type_master lt ON lb.leave_type_id = lt.leave_type_id
            WHERE lb.employee_id = @employee_id
          `);

        return res.json({
          success: true,
          data: result.recordset,
        });

      case 5: // UPDATE BALANCE AFTER LEAVE REQUEST
        const { action, days } = req.body; // action: 'add', 'deduct'

        if (!action || !days) {
          return res.status(400).json({
            success: false,
            message: "Action and days are required",
          });
        }

        const updateQuery =
          action === "deduct"
            ? `UPDATE L03_employee_leave_balance 
             SET used = used + @days, 
                 closing_balance = (opening_balance + accrued + carried_forward) - (used + @days),
                 last_updated = GETDATE()
             WHERE employee_id = @employee_id AND leave_type_id = @leave_type_id`
            : `UPDATE L03_employee_leave_balance 
             SET accrued = accrued + @days,
                 closing_balance = (opening_balance + accrued + @days + carried_forward) - used,
                 last_updated = GETDATE()
             WHERE employee_id = @employee_id AND leave_type_id = @leave_type_id`;

        result = await pool
          .request()
          .input("employee_id", sql.Int, employee_id)
          .input("leave_type_id", sql.Int, leave_type_id)
          .input("days", sql.Decimal(6, 2), days)
          .query(updateQuery);

        return res.json({
          success: true,
          message: `Leave balance ${
            action === "deduct" ? "deducted" : "added"
          } successfully`,
        });

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid operation type",
        });
    }
  } catch (error) {
    console.error("Error in leaveBalanceOperations:", error);

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
  leaveBalanceOperations,
};
