const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const onboardingTasksOperations = async (req, res) => {
  const {
    type,
    onboarding_task_id,
    application_id,
    task_name,
    description,
    due_date,
    status,
  } = req.body;

  try {
    validateLicense();

    // Get user ID from the request
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
      .input("onboarding_task_id", sql.Int, onboarding_task_id || null)
      .input("application_id", sql.Int, application_id || null)
      .input("task_name", sql.NVarChar(200), task_name || null)
      .input("description", sql.NVarChar(500), description || null)
      .input("due_date", sql.Date, due_date || null)
      .input("status", sql.NVarChar(20), status || null)
      .execute("usp_R09_onboarding_tasks_ops");

    // Handle different response formats based on operation type
    let success = false;
    let message = "";
    let data = null;
    let statusCode = 200;

    // Check if we have any recordsets
    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];

      // Extract success and message from first record
      if (firstRecordset.length > 0) {
        const firstRow = firstRecordset[0];

        // If the result contains success + message
        if (
          firstRow.hasOwnProperty("isSuccess") &&
          firstRow.hasOwnProperty("message")
        ) {
          success = Boolean(firstRow.isSuccess);
          message = firstRow.message || "";
        } else {
          // Otherwise it is SELECT data
          success = true;
          data = firstRecordset;
        }

        // For INSERT operations (Type 1), get the returned ID from second recordset
        if (parseInt(type) === 1 && result.recordsets.length > 1) {
          const secondRecordset = result.recordsets[1];
          if (secondRecordset.length > 0) {
            data = secondRecordset;
          }
        }

        // For SELECT operations (3,4,5,7,8,10), data is in the first recordset
        if (
          [3, 4, 5, 7, 8, 10].includes(parseInt(type)) &&
          result.recordsets.length > 0
        ) {
          data = result.recordsets[0];
        }

        // For UPDATE operations (2,9), get the returned ID from second recordset
        if ([2, 9].includes(parseInt(type)) && result.recordsets.length > 1) {
          const secondRecordset = result.recordsets[1];
          if (secondRecordset.length > 0) {
            data = secondRecordset;
          }
        }
      }
    }

    // Fallback success check if no explicit success flag
    if (success === undefined || success === null) {
      success = Boolean(data && data.length > 0);
    }

    // Set appropriate HTTP status code
    if (parseInt(type) === 1 && success) {
      statusCode = 201; // Created
    } else if (!success) {
      statusCode = 400; // Bad request
    }

    // Default messages for successful non-SELECT operations
    if (success && !data) {
      switch (parseInt(type)) {
        case 1:
          message = message || "Onboarding task created successfully";
          break;
        case 2:
          message = message || "Onboarding task updated successfully";
          break;
        case 6:
          message = message || "Onboarding task deleted successfully";
          break;
        case 9:
          message = message || "Onboarding task status updated successfully";
          break;
      }
    }

    // For SELECT operations with no data but success=true
    if (success && (!data || data.length === 0)) {
      switch (parseInt(type)) {
        case 3:
          message = "Onboarding task not found";
          break;
        case 4:
          message = "No active onboarding tasks found";
          break;
        case 5:
          message = "No onboarding tasks found for this application";
          break;
        case 7:
          message = "No onboarding tasks found with this status";
          break;
        case 8:
          message = "No onboarding tasks found";
          break;
        case 10:
          message = "No overdue onboarding tasks found";
          break;
      }
    }

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
    });
  } catch (error) {
    console.error(
      "Error executing usp_R09_onboarding_tasks_ops procedure:",
      error
    );

    // Handle specific error cases
    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    // SQL constraint violations
    if (error.number === 547 || error.message?.includes("constraint")) {
      return res.status(400).json({
        success: false,
        message: "Cannot perform operation due to constraint violation",
      });
    }

    // Foreign key violation (application not found)
    if (error.message?.includes("Application not found")) {
      return res.status(400).json({
        success: false,
        message: "Application not found",
      });
    }

    // Invalid status value
    if (error.message?.includes("Invalid status")) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'Pending' or 'Completed'",
      });
    }

    // Date validation errors
    if (
      error.message?.toLowerCase().includes("date") ||
      error.message?.toLowerCase().includes("datetime")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
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
  onboardingTasksOperations,
};
