const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const jobCategoryOperations = async (req, res) => {
  const { type, job_category_id, company_id, category_name, description } =
    req.body;

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
      .input("job_category_id", sql.Int, job_category_id || null)
      .input("company_id", sql.Int, company_id || null)
      .input("category_name", sql.NVarChar(200), category_name || null)
      .input("description", sql.NVarChar(500), description || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_R01_job_category_master_ops");

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
          message = message || "Job category created successfully";
          break;
        case 2:
          message = message || "Job category updated successfully";
          break;
        // Note: Type 5 (DELETE) is commented out in the stored procedure
      }
    }

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
    });
  } catch (error) {
    console.error(
      "Error executing usp_R01_job_category_master_ops procedure:",
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
      return res.status(400).json({
        success: false,
        message: "Cannot perform operation due to existing references",
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
        message: "Job category with this name already exists",
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
  jobCategoryOperations,
};
