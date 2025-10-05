const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const salaryComponentOperations = async (req, res) => {
  const {
    type,
    component_id,
    component_code,
    component_name,
    component_type,
    calculation_type,
    calculation_formula,
    formula,
    is_taxable,
    is_pf_applicable,
    is_esi_applicable,
    is_pt_applicable,
    display_order,
    status,
  } = req.body;

  try {

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
      .input("component_id", sql.Int, component_id || null)
      .input("component_code", sql.NVarChar(20), component_code || null)
      .input("component_name", sql.NVarChar(100), component_name || null)
      .input("component_type", sql.TinyInt, component_type || null)
      .input("calculation_type", sql.TinyInt, calculation_type || null)
      .input("calculation_formula", sql.NVarChar(sql.MAX), calculation_formula || formula || null)
      .input("is_taxable", sql.Bit, is_taxable ? 1 : 0)
      .input("is_pf_applicable", sql.Bit, is_pf_applicable ? 1 : 0)
      .input("is_esi_applicable", sql.Bit, is_esi_applicable ? 1 : 0)
      .input("is_pt_applicable", sql.Bit, is_pt_applicable ? 1 : 0)
      .input("display_order", sql.Int, display_order || null)
      .input("status", sql.TinyInt, status || 1)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_PR01_salary_component_ops");

    res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in salary component operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { salaryComponentOperations };
