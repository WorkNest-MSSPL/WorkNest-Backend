const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const candidateInterviewsOperations = async (req, res) => {
  const {
    type,
    interview_id,
    application_id,
    interviewer_id,
    interview_date,
    interview_mode,
    feedback,
    rating,
  } = req.body;

  try {
    validateLicense();

    // Get user ID from request
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
      .input("interview_id", sql.Int, interview_id || null)
      .input("application_id", sql.Int, application_id || null)
      .input("interviewer_id", sql.Int, interviewer_id || null)
      .input("interview_date", sql.DateTime, interview_date || null)
      .input("interview_mode", sql.NVarChar(50), interview_mode || null)
      .input("feedback", sql.NVarChar(sql.MAX), feedback || null)
      .input("rating", sql.Int, rating || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_R07_candidate_interviews_ops");

    let success = false;
    let message = "";
    let data = null;
    let statusCode = 200;

    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];
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

        // Handle SELECT operations (3,4,5,6)
        if (
          [3, 4, 5, 6].includes(parseInt(type)) &&
          result.recordsets.length > 0
        ) {
          data = result.recordsets[0];
        }
      }
    }

    // Fallback success check
    if (!success && data && data.length > 0) {
      success = true;
    }

    // Set status codes
    if (parseInt(type) === 1 && success) {
      statusCode = 201; // Created
    } else if (!success) {
      statusCode = 400; // Bad request
    }

    // Default messages for non-SELECT ops
    if (success && !data) {
      switch (parseInt(type)) {
        case 1:
          message = message || "Interview record created successfully";
          break;
        case 2:
          message = message || "Interview record updated successfully";
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
      "Error executing usp_R07_candidate_interviews_ops procedure:",
      error
    );

    // License validation error
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

    // Duplicate record errors
    if (
      error.number === 2601 ||
      error.number === 2627 ||
      error.message?.includes("duplicate")
    ) {
      return res.status(400).json({
        success: false,
        message: "Duplicate interview record exists",
      });
    }

    // Date validation errors
    if (error.message?.toLowerCase().includes("date")) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format or date range",
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
  candidateInterviewsOperations,
};
