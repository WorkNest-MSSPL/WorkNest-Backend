const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const payrollTransactionOperations = async (req, res) => {
  const {
    type,
    payroll_trans_id,
    payroll_cycle_id,
    employee_id,
  } = req.body;

  try {
    validateLicense();

    const userId = 1;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const pool = await getConnection();

    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("payroll_trans_id", sql.Int, payroll_trans_id || null)
      .input("payroll_cycle_id", sql.Int, payroll_cycle_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("created_by", sql.Int, userId)
      .execute("usp_PR10_payroll_transaction_ops");

    res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in payroll transaction operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { payrollTransactionOperations };
