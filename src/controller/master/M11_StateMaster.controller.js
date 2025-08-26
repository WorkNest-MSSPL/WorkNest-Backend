const { getConnection, sql } = require("../../config/database.js");
const { validateLicense } = require("../../../checker.obf.js");
const { getUserId } = require("../../utils/UserInfo.js");

const stateOperations = async (req, res) => {
  const {
    type,
    state_id,
    state_code,
    state_name,
    country_id,
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

    // Determine which user field to use based on operation type
    let createdByValue = userId || null;
    let updatedByValue = userId || null;

    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("state_id", sql.Int, state_id || null)
      .input("state_code", sql.NVarChar(50), state_code || null)
      .input("state_name", sql.NVarChar(255), state_name || null)
      .input("country_id", sql.Int, country_id || null)
      .input("status", sql.TinyInt, status)
      .input("created_by", sql.Int, createdByValue)
      .input("updated_by", sql.Int, updatedByValue)
      .execute("usp_M11_state_master_ops");

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
        success = Boolean(firstRow.isSuccess);
        message = firstRow.message || "";

        // For INSERT/UPDATE operations, there might be a second recordset with the created/updated data
        if (
          (parseInt(type) === 1 || parseInt(type) === 2) &&
          result.recordsets.length > 1
        ) {
          data = result.recordsets[1];
        }

        // For SELECT operations, the data is in the second recordset
        if (
          (parseInt(type) === 3 ||
            parseInt(type) === 4 ||
            parseInt(type) === 7 ||
            parseInt(type) === 8) &&
          result.recordsets.length > 1
        ) {
          data = result.recordsets[1];
        }
      }
    }

    // If no success flag was found, check if we have any data
    if (success === undefined || success === null) {
      success = Boolean(data && data.length > 0);
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
          message = message || "State created successfully";
          break;
        case 2:
          message = message || "State updated successfully";
          break;
        case 5:
          message = message || "State status updated successfully";
          break;
        case 6:
          message = message || "State archived successfully";
          break;
      }
    }

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
    });
  } catch (error) {
    console.error("Error executing usp_M11_state_master_ops procedure:", error);

    // Handle specific error cases
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
  stateOperations,
};
