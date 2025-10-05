const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const salaryTemplateOperations = async (req, res) => {
  const {
    type,
    template_id,
    company_id,
    template_code,
    template_name,
    description,
    is_default,
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
      .input("template_id", sql.Int, template_id || null)
      .input("template_code", sql.NVarChar(20), template_code || null)
      .input("template_name", sql.NVarChar(100), template_name || null)
      .input("description", sql.NVarChar(500), description || null)
      .input("company_id", sql.Int, company_id || 1)
      .input("applicable_from", sql.Date, null)
      .input("status", sql.TinyInt, status || 1)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_PR02_salary_template_ops");

    res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in salary template operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { salaryTemplateOperations };
