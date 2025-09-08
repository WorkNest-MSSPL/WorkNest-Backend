const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const jobApplicationsOperations = async (req, res) => {
  const {
    type,
    application_id,
    job_posting_id,
    candidate_name,
    email,
    phone,
    resume_url,
    cover_letter,
    application_date,
    status = 1,
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
      .input("application_id", sql.Int, application_id || null)
      .input("job_posting_id", sql.Int, job_posting_id || null)
      .input("candidate_name", sql.NVarChar(255), candidate_name || null)
      .input("email", sql.NVarChar(255), email || null)
      .input("phone", sql.NVarChar(50), phone || null)
      .input("resume_url", sql.NVarChar(sql.MAX), resume_url || null)
      .input("cover_letter", sql.NVarChar(sql.MAX), cover_letter || null)
      .input("application_date", sql.DateTime, application_date || null)
      .input("status", sql.TinyInt, status)
      .input("performed_by", sql.Int, userId)
      .execute("usp_R03_job_applications_ops");

    // Handle response based on operation type
    let success = false;
    let message = "";
    let data = null;
    let statusCode = 200;

    // Check if we have any recordsets
    if (result.recordsets && result.recordsets.length > 0) {
      // For INSERT operations (Type 1), there are 2 recordsets: [success_message, inserted_data]
      if (parseInt(type) === 1 && result.recordsets.length >= 2) {
        const successRecordset = result.recordsets[0];
        const dataRecordset = result.recordsets[1];

        if (successRecordset.length > 0) {
          const successRow = successRecordset[0];
          if (
            successRow.hasOwnProperty("isSuccess") &&
            successRow.hasOwnProperty("message")
          ) {
            success = Boolean(successRow.isSuccess);
            message = successRow.message || "";
          }
        }

        if (dataRecordset.length > 0) {
          data = dataRecordset;
        }
      }
      // For other operations
      else {
        const firstRecordset = result.recordsets[0];

        if (firstRecordset.length > 0) {
          const firstRow = firstRecordset[0];

          // Check if this is a success/message response or actual data
          if (
            firstRow.hasOwnProperty("isSuccess") &&
            firstRow.hasOwnProperty("message")
          ) {
            success = Boolean(firstRow.isSuccess);
            message = firstRow.message || "";
          } else {
            // This is actual data from SELECT operations
            success = true;
            data = firstRecordset;
          }
        }
      }
    }

    // If no success flag was found but we have data, consider it successful
    if (success === false && data && data.length > 0) {
      success = true;
    }

    // Handle specific case where update fails due to record not found
    if (parseInt(type) === 2 && !success && message.includes("not found")) {
      statusCode = 404;
    }

    // Set appropriate HTTP status code
    if (parseInt(type) === 1 && success) {
      statusCode = 201; // Created
    } else if (!success) {
      statusCode = success === false && statusCode === 200 ? 400 : statusCode;
    }

    // For operations that don't return data but were successful
    if (success && !data) {
      switch (parseInt(type)) {
        case 1:
          message = message || "Job application submitted successfully";
          break;
        case 2:
          message = message || "Job application updated successfully";
          break;
        case 5:
          message = message || "Application status updated successfully";
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
      "Error executing usp_R03_job_applications_ops procedure:",
      error
    );

    // Handle specific error cases
    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    // Handle SQL constraint violations
    if (error.number === 547 || error.message?.includes("constraint")) {
      let constraintMessage =
        "Cannot perform operation due to constraint violation";

      if (error.message?.includes("job_posting_id")) {
        constraintMessage = "Invalid job posting selected";
      } else if (error.message?.includes("email")) {
        constraintMessage = "Email validation failed";
      }

      return res.status(400).json({
        success: false,
        message: constraintMessage,
      });
    }

    // Handle duplicate applications
    if (
      error.number === 2601 ||
      error.number === 2627 ||
      error.message?.includes("duplicate")
    ) {
      return res.status(400).json({
        success: false,
        message: "You have already applied for this position",
      });
    }

    // Handle required field validation
    if (
      error.message?.includes("NULL") ||
      error.message?.includes("required")
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
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
  jobApplicationsOperations,
};
