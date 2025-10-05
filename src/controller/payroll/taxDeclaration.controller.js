const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const taxDeclarationOperations = async (req, res) => {
  const {
    type,
    declaration_id,
    employee_id,
    financial_year,
    tax_regime,
    section_80c,
    section_80d,
    section_24,
    other_deductions,
    total_deductions,
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
      .input("declaration_id", sql.Int, declaration_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("financial_year", sql.NVarChar(20), financial_year || null)
      .input("tax_regime", sql.NVarChar(20), tax_regime || null)
      .input("section_80c", sql.Decimal(18, 2), section_80c || null)
      .input("section_80d", sql.Decimal(18, 2), section_80d || null)
      .input("section_24", sql.Decimal(18, 2), section_24 || null)
      .input("other_deductions", sql.Decimal(18, 2), other_deductions || null)
      .input("total_deductions", sql.Decimal(18, 2), total_deductions || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_PR20_tax_declaration_ops");

    res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in tax declaration operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { taxDeclarationOperations };
