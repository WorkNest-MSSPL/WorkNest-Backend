const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const payrollCycleOperations = async (req, res) => {
  const {
    type,
    payroll_cycle_id,
    company_id,
    cycle_code,
    salary_month,
    salary_year,
    pay_period_from,
    pay_period_to,
    payment_date,
    working_days,
    payroll_status,
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
      .input("payroll_cycle_id", sql.Int, payroll_cycle_id || null)
      .input("company_id", sql.Int, company_id || 1)
      .input("cycle_code", sql.NVarChar(50), cycle_code || null)
      .input("salary_month", sql.Int, salary_month || null)
      .input("salary_year", sql.Int, salary_year || null)
      .input("pay_period_from", sql.Date, pay_period_from || null)
      .input("pay_period_to", sql.Date, pay_period_to || null)
      .input("payment_date", sql.Date, payment_date || null)
      .input("working_days", sql.Decimal(5, 2), working_days || null)
      .input("payroll_status", sql.Int, payroll_status || 1)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_PR09_payroll_cycle_ops");

    res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in payroll cycle operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { payrollCycleOperations };
