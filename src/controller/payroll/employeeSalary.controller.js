const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const employeeSalaryOperations = async (req, res) => {
  const {
    type,
    emp_salary_id,
    employee_id,
    template_id,
    effective_from,
    effective_to,
    basic_salary,
    gross_salary,
    ctc,
    status,
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
      .input("emp_salary_id", sql.Int, emp_salary_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("template_id", sql.Int, template_id || null)
      .input("effective_from", sql.Date, effective_from || null)
      .input("annual_ctc", sql.Decimal(18, 2), ctc || null)
      .input("monthly_ctc", sql.Decimal(18, 2), gross_salary || null)
      .input("revision_type", sql.TinyInt, 1)
      .input("status", sql.TinyInt, status || 1)
      .input("created_by", sql.Int, userId)
      .execute("usp_PR04_employee_salary_ops");

    res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in employee salary operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { employeeSalaryOperations };
