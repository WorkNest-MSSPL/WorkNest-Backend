const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const reimbursementOperations = async (req, res) => {
  const {
    type,
    reimbursement_id,
    employee_id,
    reimbursement_type_id,
    claim_date,
    claim_amount,
    claimed_amount,
    description,
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
      .input("reimbursement_id", sql.Int, reimbursement_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("reimbursement_type_id", sql.Int, reimbursement_type_id || null)
      .input("claim_date", sql.Date, claim_date || null)
      .input("claim_amount", sql.Decimal(18, 2), claim_amount || null)
      .input("claimed_amount", sql.Decimal(18, 2), claimed_amount || null)
      .input("description", sql.NVarChar(500), description || null)
      .input("approval_status", sql.Int, approval_status || 1)
      .input("approved_by", sql.Int, approved_by || null)
      .input("approved_date", sql.Date, approved_date || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_PR33_reimbursement_ops");

    res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in reimbursement operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { reimbursementOperations };
