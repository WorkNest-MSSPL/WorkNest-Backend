const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const trainingEnrollmentsOperations = async (req, res) => {
  const {
    type,
    enrollment_id,
    training_id,
    employee_id,
    enrollment_date,
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
      .input("enrollment_id", sql.Int, enrollment_id || null)
      .input("training_id", sql.Int, training_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("enrollment_date", sql.Date, enrollment_date || null)
      .input("status", sql.NVarChar(20), status || null)
      .execute("usp_O05_training_enrollments_ops");

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
            parseInt(type) === 7 ||
            parseInt(type) === 8 ||
            parseInt(type) === 9) &&
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
          message = message || "Employee enrolled successfully";
          break;
        case 2:
          message = message || "Enrollment updated successfully";
          break;
        case 6:
          message = message || "Enrollment deleted successfully";
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
      "Error executing usp_O05_training_enrollments_ops procedure:",
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
  trainingEnrollmentsOperations,
};
