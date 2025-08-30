const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const taskOperations = async (req, res) => {
  const {
    type,
    task_id,
    project_id,
    task_title,
    task_description,
    assigned_by,
    assigned_to,
    priority = "Medium",
    status = "Pending",
    start_date,
    due_date,
    Comments,
    Attachments,
  } = req.body;

  try {
    validateLicense();

    const userId = getUserId(req);
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
      .input("task_id", sql.Int, task_id || null)
      .input("project_id", sql.Int, project_id || null)
      .input("task_title", sql.NVarChar(200), task_title || null)
      .input(
        "task_description",
        sql.NVarChar(sql.MAX),
        task_description || null
      )
      .input("assigned_by", sql.Int, assigned_by || null)
      .input("assigned_to", sql.Int, assigned_to || null)
      .input("priority", sql.NVarChar(20), priority)
      .input("status", sql.NVarChar(20), status)
      .input("start_date", sql.Date, start_date || null)
      .input("due_date", sql.Date, due_date || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .input("Comments", sql.NVarChar(sql.MAX), Comments || null)
      .input("Attachments", sql.NVarChar(sql.MAX), Attachments || null)
      .execute("usp_TaskFullOps");

    let success = false;
    let message = "";
    let data = null;
    let commentsData = null;
    let attachmentsData = null;
    let statusCode = 200;

    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];
      if (firstRecordset.length > 0) {
        const firstRow = firstRecordset[0];
        success = Boolean(firstRow.IsSuccess);
        message = firstRow.Message || "";

        if (result.recordsets.length > 1) {
          data = result.recordsets[1];
        }
        if (result.recordsets.length > 2) {
          commentsData = result.recordsets[2];
        }
        if (result.recordsets.length > 3) {
          attachmentsData = result.recordsets[3];
        }
      }
    }

    if (success === undefined || success === null) {
      success = Boolean(data && data.length > 0);
    }

    if (type === 1 && success) statusCode = 201;
    else if (!success) statusCode = 400;

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
      comments: commentsData || null,
      attachments: attachmentsData || null,
    });
  } catch (error) {
    console.error("Error executing usp_TaskFullOps procedure:", error);

    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  taskOperations,
};
