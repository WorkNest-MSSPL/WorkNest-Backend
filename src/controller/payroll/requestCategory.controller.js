const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const requestCategoryOperations = async (req, res) => {
  const {
    type, // 1=Create, 2=Update, 3=GetByID, 4=GetAll, 5=GetByType, 6=Delete
    category_id,
    category_code,
    category_name,
    category_type, // FINANCIAL, LEAVE, DOCUMENT, OTHER
    requires_amount,
    requires_document,
    max_allowed_amount,
    approval_workflow, // SINGLE, MULTI_LEVEL
    status, // ACTIVE, INACTIVE
  } = req.body;

  try {
    validateLicense();
    const userId = 1;

    const pool = await getConnection();
    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("category_id", sql.Int, category_id || null)
      .input("category_code", sql.NVarChar(20), category_code || null)
      .input("category_name", sql.NVarChar(100), category_name || null)
      .input("category_type", sql.NVarChar(20), category_type || null)
      .input("requires_amount", sql.Bit, requires_amount ? 1 : 0)
      .input("requires_document", sql.Bit, requires_document ? 1 : 0)
      .input(
        "max_allowed_amount",
        sql.Decimal(18, 2),
        max_allowed_amount || null
      )
      .input(
        "approval_workflow",
        sql.NVarChar(20),
        approval_workflow || "SINGLE"
      )
      .input("status", sql.NVarChar(20), status || "ACTIVE")
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_PR54_request_category_ops");

    const responseData = {
      success: result.recordsets[0]?.[0]?.isSuccess === 1,
      message: result.recordsets[0]?.[0]?.message || "Operation completed",
      data: result.recordsets[1] || [],
    };

    res.status(responseData.success ? 200 : 400).json(responseData);
  } catch (error) {
    console.error("Error in request category operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { requestCategoryOperations };
