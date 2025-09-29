const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const employeeTransferOperations = async (req, res) => {
  const {
    type,
    transfer_id,
    employee_id,
    zone_id,
    ward_id,
    area_id,
    beat_id,
    department_id,
    designation_id,
    is_active = 1,
    effective_date,
    end_date,
    transfer_reason,
    remarks,
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
    let createdByValue = null;
    let updatedByValue = null;

    if (parseInt(type) === 1) {
      createdByValue = userId;
      updatedByValue = userId;
    } else if (
      parseInt(type) === 2 ||
      parseInt(type) === 6 ||
      parseInt(type) === 7
    ) {
      updatedByValue = userId;
    }

    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("transfer_id", sql.Int, transfer_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("zone_id", sql.Int, zone_id || null)
      .input("ward_id", sql.Int, ward_id || null)
      .input("area_id", sql.Int, area_id || null)
      .input("beat_id", sql.Int, beat_id || null)
      .input("department_id", sql.Int, department_id || null)
      .input("designation_id", sql.Int, designation_id || null)
      .input("is_active", sql.Bit, is_active)
      .input("effective_date", sql.Date, effective_date || null)
      .input("end_date", sql.Date, end_date || null)
      .input("transfer_reason", sql.NVarChar(500), transfer_reason || null)
      .input("remarks", sql.NVarChar(1000), remarks || null)
      .input("created_by", sql.Int, createdByValue)
      .input("updated_by", sql.Int, updatedByValue)
      .execute("usp_E21_employee_transfer_ops");

    // Handle response
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
          (parseInt(type) === 1 ||
            parseInt(type) === 2 ||
            parseInt(type) === 6) &&
          result.recordsets.length > 1
        ) {
          data = result.recordsets[1];
        }

        // For SELECT operations, the data is in the second recordset
        if (
          (parseInt(type) === 3 ||
            parseInt(type) === 4 ||
            parseInt(type) === 5) &&
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
          message = message || "Employee transfer created successfully";
          break;
        case 2:
          message = message || "Employee transfer updated successfully";
          break;
        case 6:
          message = message || "Transfer status updated successfully";
          break;
        case 7:
          message = message || "Transfer record deleted successfully";
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
      "Error executing usp_E21_employee_transfer_ops procedure:",
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
  employeeTransferOperations,
};
