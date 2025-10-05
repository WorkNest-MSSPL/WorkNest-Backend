const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const loanOperations = async (req, res) => {
  const {
    type,
    loan_id,
    employee_id,
    loan_type_id,
    loan_amount,
    interest_rate,
    tenure_months,
    emi_amount,
    start_date,
    approval_status,
    approved_by,
    approved_date,
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
      .input("loan_id", sql.Int, loan_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("loan_type_id", sql.Int, loan_type_id || null)
      .input("loan_amount", sql.Decimal(18, 2), loan_amount || null)
      .input("interest_rate", sql.Decimal(5, 2), interest_rate || null)
      .input("tenure_months", sql.Int, tenure_months || null)
      .input("emi_amount", sql.Decimal(18, 2), emi_amount || null)
      .input("start_date", sql.Date, start_date || null)
      .input("approval_status", sql.Int, approval_status || 1)
      .input("approved_by", sql.Int, approved_by || null)
      .input("approved_date", sql.Date, approved_date || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_PR28_employee_loan_ops");

    res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in loan operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { loanOperations };
