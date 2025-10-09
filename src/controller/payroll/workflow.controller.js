const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const workflowMasterOperations = async (req, res) => {
  const {
    type, // 1=Create, 2=Update, 3=GetByID, 4=GetAll, 5=GetByCategory, 6=GetByCategoryAndLevel, 7=Delete, 8=GetHierarchy, 9=Validate
    workflow_id,
    category_id,
    approval_level,
    approver_type, // REPORTING_MANAGER, DEPARTMENT_HEAD, HR_MANAGER, FINANCE_MANAGER, CUSTOM
    custom_approver_id,
    is_mandatory,
    status, // ACTIVE, INACTIVE
  } = req.body;

  try {
    validateLicense();
    const userId = 1;

    const pool = await getConnection();
    const request = pool
      .request()
      .input("Type", sql.Int, type)
      .input("workflow_id", sql.Int, workflow_id || null)
      .input("category_id", sql.Int, category_id || null)
      .input("approval_level", sql.Int, approval_level || null)
      .input("approver_type", sql.NVarChar(30), approver_type || null)
      .input("custom_approver_id", sql.Int, custom_approver_id || null)
      .input(
        "is_mandatory",
        sql.Bit,
        is_mandatory !== undefined ? (is_mandatory ? 1 : 0) : null
      )
      .input("status", sql.NVarChar(20), status || "ACTIVE")
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId);

    const result = await request.execute("usp_PR55_workflow_master_ops");

    let responseData = {
      success: result.recordsets[0]?.[0]?.isSuccess === 1,
      message: result.recordsets[0]?.[0]?.message || "Operation completed",
      data: result.recordsets[1] || [],
    };

    // Handle different response structures for specific operations
    if (type === 8 && result.recordsets.length >= 2) {
      responseData = {
        success: true,
        message: "Data retrieved successfully",
        data: {
          category: result.recordsets[0]?.[0] || {},
          workflow_levels: result.recordsets[1] || [],
        },
      };
    }

    const statusCode = responseData.success ? 200 : 400;
    res.status(statusCode).json(responseData);
  } catch (error) {
    console.error("Error in workflow master operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { workflowMasterOperations };
