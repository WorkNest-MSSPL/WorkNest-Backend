const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const employeeApproverOperations = async (req, res) => {
  const {
    type, // 1=Create, 2=Update, 3=GetByID, 4=GetAll, 5=GetByEmployee, 6=GetByApprover, 7=Delete
    mapping_id,
    employee_id,
    approver_type, // REPORTING_MANAGER, DEPARTMENT_HEAD, HR_MANAGER, FINANCE_MANAGER
    approver_id,
    is_active,
    effective_from,
    effective_to,
  } = req.body;

  try {
    validateLicense();
    const userId = 1;

    const pool = await getConnection();
    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("mapping_id", sql.Int, mapping_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("approver_type", sql.NVarChar(30), approver_type || null)
      .input("approver_id", sql.Int, approver_id || null)
      .input(
        "is_active",
        sql.Bit,
        is_active !== undefined ? (is_active ? 1 : 0) : null
      )
      .input("effective_from", sql.Date, effective_from || null)
      .input("effective_to", sql.Date, effective_to || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_PR59_employee_approver_ops");

    const responseData = {
      success: result.recordsets[0]?.[0]?.isSuccess === 1,
      message: result.recordsets[0]?.[0]?.message || "Operation completed",
      data: result.recordsets[1] || [],
    };

    res.status(responseData.success ? 200 : 400).json(responseData);
  } catch (error) {
    console.error("Error in employee approver operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { employeeApproverOperations };
