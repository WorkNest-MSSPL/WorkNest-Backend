const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const trainingFeedbackOperations = async (req, res) => {
  const {
    type,
    feedback_id,
    training_id,
    employee_id,
    rating,
    comments,
    feedback_date,
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
      .input("feedback_id", sql.Int, feedback_id || null)
      .input("training_id", sql.Int, training_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("rating", sql.Decimal(3, 2), rating || null)
      .input("comments", sql.NVarChar(sql.MAX), comments || null)
      .input("feedback_date", sql.Date, feedback_date || null)
      .execute("usp_O06_training_feedback_ops");

    // Handle response
    let success = false;
    let message = "";
    let data = null;
    let statusCode = 200;

    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];

      if (firstRecordset.length > 0) {
        const firstRow = firstRecordset[0];
        success = Boolean(firstRow.isSuccess);
        message = firstRow.message || "";

        // For Type 9, handle the special case with canProvideFeedback
        if (parseInt(type) === 9 && result.recordsets.length > 1) {
          const secondRecordset = result.recordsets[1];
          if (secondRecordset.length > 0) {
            data = secondRecordset[0]; // Get the single row with canProvideFeedback
          }
        }
        // For other operations that return data in second recordset
        else if (
          (parseInt(type) === 1 ||
            parseInt(type) === 2 ||
            parseInt(type) === 3 ||
            parseInt(type) === 4 ||
            parseInt(type) === 5 ||
            parseInt(type) === 7 ||
            parseInt(type) === 8) &&
          result.recordsets.length > 1
        ) {
          data = result.recordsets[1];
        }
      }
    }

    // Set appropriate HTTP status code
    if (parseInt(type) === 1 && success) {
      statusCode = 201; // Created
    } else if (!success) {
      statusCode = 400; // Bad request
    }

    // For operations that don't return data but were successful
    if (success && !data) {
      switch (parseInt(type)) {
        case 1:
          message = message || "Feedback submitted successfully";
          break;
        case 2:
          message = message || "Feedback updated successfully";
          break;
        case 6:
          message = message || "Feedback deleted successfully";
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
      "Error executing usp_O06_training_feedback_ops procedure:",
      error
    );

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
  trainingFeedbackOperations,
};
