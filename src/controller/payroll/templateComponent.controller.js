const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const templateComponentOperations = async (req, res) => {
  const {
    type,
    template_component_id,
    template_id,
    component_id,
    calc_type,
    fixed_amount,
    percentage_value,
    display_order,
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
      .input("template_component_id", sql.Int, template_component_id || null)
      .input("template_id", sql.Int, template_id || null)
      .input("component_id", sql.Int, component_id || null)
      .input("calc_type", sql.TinyInt, calc_type || null)
      .input("fixed_amount", sql.Decimal(18, 2), fixed_amount || null)
      .input("percentage_value", sql.Decimal(5, 2), percentage_value || null)
      .input("display_order", sql.Int, display_order || null)
      .input("created_by", sql.Int, userId)
      .execute("usp_PR03_template_component_ops");

    res.status(200).json({
      success: true,
      message: "Operation completed successfully",
      data: result.recordsets[1],
    });
  } catch (error) {
    console.error("Error in template component operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { templateComponentOperations };
