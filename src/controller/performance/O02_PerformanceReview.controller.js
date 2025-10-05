const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const performanceReviewsOperations = async (req, res) => {
  const {
    type,
    review_id,
    employee_id,
    reviewer_id,
    review_period_start,
    review_period_end,
    overall_rating,
    comments,
    review_date,
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
      .input("review_id", sql.Int, review_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("reviewer_id", sql.Int, reviewer_id || null)
      .input("review_period_start", sql.Date, review_period_start || null)
      .input("review_period_end", sql.Date, review_period_end || null)
      .input("overall_rating", sql.Decimal(3, 2), overall_rating || null)
      .input("comments", sql.NVarChar(sql.MAX), comments || null)
      .input("review_date", sql.Date, review_date || null)
      .execute("usp_O02_performance_reviews_ops");

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

        // For operations that return data in second recordset
        if (
          (parseInt(type) === 1 ||
            parseInt(type) === 2 ||
            parseInt(type) === 3 ||
            parseInt(type) === 4 ||
            parseInt(type) === 5 ||
            parseInt(type) === 6 ||
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
          message = message || "Performance review created successfully";
          break;
        case 2:
          message = message || "Performance review updated successfully";
          break;
        case 7:
          message = message || "Performance review deleted successfully";
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
      "Error executing usp_O02_performance_reviews_ops procedure:",
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
  performanceReviewsOperations,
};
