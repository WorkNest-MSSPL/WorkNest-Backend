const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const jobPostingsOperations = async (req, res) => {
  const {
    type,
    job_posting_id,
    company_id,
    job_title,
    job_category_id,
    department_id,
    location,
    employment_type,
    description,
    posted_date,
    closing_date,
    status,
    job_description,
    responsibilities,
    requirements,
    qualifications,
    skills_required,
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
      .input("job_posting_id", sql.Int, job_posting_id || null)
      .input("company_id", sql.Int, company_id || null)
      .input("job_title", sql.NVarChar(200), job_title || null)
      .input("job_category_id", sql.Int, job_category_id || null)
      .input("department_id", sql.Int, department_id || null)
      .input("location", sql.NVarChar(200), location || null)
      .input("employment_type", sql.NVarChar(50), employment_type || null)
      .input("description", sql.NVarChar(sql.MAX), description || null)
      .input("posted_date", sql.Date, posted_date || null)
      .input("closing_date", sql.Date, closing_date || null)
      .input("status", sql.NVarChar(20), status || null)
      .input("job_description", sql.Text, job_description || null)
      .input("responsibilities", sql.Text, responsibilities || null)
      .input("requirements", sql.Text, requirements || null)
      .input("qualifications", sql.Text, qualifications || null)
      .input("skills_required", sql.NVarChar(sql.MAX), skills_required || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_R02_job_postings_ops");

    // Handle response based on operation type
    let success = false;
    let message = "";
    let data = null;
    let statusCode = 200;

    // Check if we have any recordsets
    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];

      // Extract success and message from first record (for operations that return them)
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

        // For SELECT operations, check if there's additional data
        if (
          (parseInt(type) === 3 ||
            parseInt(type) === 4 ||
            parseInt(type) === 8) &&
          result.recordsets.length > 0
        ) {
          data = result.recordsets[0]; // SELECT operations return data in first recordset
        }
      }
    }

    // If no success flag was found but we have data, consider it successful
    if (success === false && data && data.length > 0) {
      success = true;
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
          message = message || "Job posting created successfully";
          break;
        case 2:
          message = message || "Job posting updated successfully";
          break;
        case 5:
          message = message || "Job posting closed successfully";
          break;
      }
    }

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
    });
  } catch (error) {
    console.error("Error executing usp_R02_job_postings_ops procedure:", error);

    // Handle specific error cases
    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    // Handle SQL constraint violations (foreign key constraints)
    if (error.number === 547 || error.message?.includes("constraint")) {
      let constraintMessage =
        "Cannot perform operation due to constraint violation";

      // Provide more specific error messages for common constraint violations
      if (error.message?.includes("job_category_id")) {
        constraintMessage = "Invalid job category selected";
      } else if (error.message?.includes("department_id")) {
        constraintMessage = "Invalid department selected";
      } else if (error.message?.includes("company_id")) {
        constraintMessage = "Invalid company selected";
      }

      return res.status(400).json({
        success: false,
        message: constraintMessage,
      });
    }

    // Handle duplicate key violations
    if (
      error.number === 2601 ||
      error.number === 2627 ||
      error.message?.includes("duplicate")
    ) {
      return res.status(400).json({
        success: false,
        message: "Job posting with similar details already exists",
      });
    }

    // Handle date validation errors
    if (error.message?.includes("date") || error.message?.includes("Date")) {
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
  jobPostingsOperations,
};
