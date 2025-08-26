const { getConnection, sql } = require("../../config/database.js");
const { validateLicense } = require("../../../checker.obf.js");
const { getUserId } = require("../../utils/UserInfo.js");

const payrollComponentOperations = async (req, res) => {
  const {
    type,
    component_id,
    component_code,
    component_name,
    component_type,
    taxable = false,
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
      .input("component_id", sql.Int, component_id || null)
      .input("component_code", sql.NVarChar(50), component_code || null)
      .input("component_name", sql.NVarChar(255), component_name || null)
      .input("component_type", sql.NVarChar(50), component_type || null)
      .input("taxable", sql.Bit, taxable)
      .input("status", sql.TinyInt, status)
      .input("created_by", sql.Int, createdByValue)
      .input("updated_by", sql.Int, updatedByValue)
      .execute("usp_M17_payroll_component_master_ops");

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
          message = message || "Payroll component created successfully";
          break;
        case 2:
          message = message || "Payroll component updated successfully";
          break;
        case 5:
          message = message || "Payroll component status updated successfully";
          break;
        case 6:
          message = message || "Payroll component archived successfully";
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
      "Error executing usp_M17_payroll_component_master_ops procedure:",
      error
    );

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
  payrollComponentOperations,
};
