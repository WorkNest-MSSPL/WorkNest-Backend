const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const employeeRequestOperations = async (req, res) => {
  const {
    type, // 1=Create, 2=Update, 3=GetByID, 4=GetAll, 5=GetByEmployee, 6=GetPendingApprovals, 7=GetByStatus, 8=Submit, 9=ApproveReject, 10=AddComment, 11=Cancel, 12=Delete, 13=GetWorkflowStatus, 14=GetStatistics
    request_id,
    employee_id,
    category_id,
    subject,
    description,
    request_amount,
    effective_date,
    end_date,
    attachment_path,
    priority, // LOW, NORMAL, HIGH, URGENT
    current_status, // For ApproveReject: APPROVED, REJECTED | For AddComment: INTERNAL, PUBLIC, SYSTEM, FORWARD_REASON
    comments,
    action_by,
  } = req.body;

  try {
    validateLicense();
    const userId = 1;

    const pool = await getConnection();
    const request = pool
      .request()
      .input("Type", sql.Int, type)
      .input("request_id", sql.Int, request_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("category_id", sql.Int, category_id || null)
      .input("subject", sql.NVarChar(200), subject || null)
      .input("description", sql.NVarChar(1000), description || null)
      .input("request_amount", sql.Decimal(18, 2), request_amount || null)
      .input("effective_date", sql.Date, effective_date || null)
      .input("end_date", sql.Date, end_date || null)
      .input("attachment_path", sql.NVarChar(500), attachment_path || null)
      .input("priority", sql.NVarChar(20), priority || "NORMAL")
      .input("current_status", sql.NVarChar(20), current_status || null)
      .input("comments", sql.NVarChar(500), comments || null)
      .input("action_by", sql.Int, action_by || userId);

    const result = await request.execute("usp_PR56_employee_request_ops");

    let responseData = {
      success: result.recordsets[0]?.[0]?.isSuccess === 1,
      message: result.recordsets[0]?.[0]?.message || "Operation completed",
      data: result.recordsets[1] || [],
    };

    // Handle different response structures for specific operations
    if (type === 3 && result.recordsets.length >= 3) {
      responseData = {
        success: true,
        message: "Data retrieved successfully",
        data: {
          request: result.recordsets[0]?.[0] || {},
          approval_flow: result.recordsets[1] || [],
          comments: result.recordsets[2] || [],
        },
      };
    } else if (type === 13 && result.recordsets.length >= 3) {
      responseData = {
        success: true,
        message: "Workflow status retrieved successfully",
        data: {
          request: result.recordsets[0]?.[0] || {},
          current_approver: result.recordsets[1]?.[0] || {},
          workflow_progression: result.recordsets[2] || [],
        },
      };
    } else if (type === 14 && result.recordsets.length >= 2) {
      responseData = {
        success: true,
        message: "Statistics retrieved successfully",
        data: {
          overall_stats: result.recordsets[0]?.[0] || {},
          category_stats: result.recordsets[1] || [],
        },
      };
    }

    const statusCode = responseData.success ? 200 : 400;
    res.status(statusCode).json(responseData);
  } catch (error) {
    console.error("Error in employee request operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { employeeRequestOperations };
