const { getConnection, sql } = require("../../config/database.js");
const { validateLicense } = require("../../../checker.obf.js");
const { getUserId } = require("../../helper/UserInfo.js");

const companyOperations = async (req, res) => {
  const {
    type,
    company_id,
    company_code,
    company_name,
    address,
    phone,
    email,
    website,
    status = 1,
    // Remove created_by and updated_by from destructuring since we'll set them automatically
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
    console.log("pool", pool);

    // Determine which user field to use based on operation type
    let createdByValue = null;
    let updatedByValue = null;

    if (parseInt(type) === 1) {
      // For INSERT operations, set created_by
      createdByValue = userId;
    } else if (
      parseInt(type) === 2 ||
      parseInt(type) === 5 ||
      parseInt(type) === 6
    ) {
      // For UPDATE, INACTIVE, ARCHIVE operations, set updated_by
      updatedByValue = userId;
    }

    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("company_id", sql.Int, company_id || null)
      .input("company_code", sql.NVarChar(50), company_code || null)
      .input("company_name", sql.NVarChar(255), company_name || null)
      .input("address", sql.NVarChar(500), address || null)
      .input("phone", sql.NVarChar(20), phone || null)
      .input("email", sql.NVarChar(255), email || null)
      .input("website", sql.NVarChar(255), website || null)
      .input("status", sql.TinyInt, status)
      .input("created_by", sql.Int, createdByValue) // Set automatically
      .input("updated_by", sql.Int, updatedByValue) // Set automatically
      .execute("usp_M01_company_master_ops");

    console.log("result", result);

    // Extract message and data from the stored procedure result
    const firstRecordset = result?.recordsets?.[0] || [];
    const messageRecord = firstRecordset.find((record) => record.message);
    const dataRecords = firstRecordset.filter((record) => !record.message);

    // Get message from procedure or use default based on type
    let message = messageRecord?.message;

    if (!message) {
      switch (parseInt(type)) {
        case 1:
          message = "Company created successfully";
          break;
        case 2:
          message = "Company updated successfully";
          break;
        case 3:
          message = "Company information retrieved successfully";
          break;
        case 4:
          message = "All companies retrieved successfully";
          break;
        case 5:
          message = "Company marked as inactive";
          break;
        case 6:
          message = "Company archived successfully";
          break;
        default:
          message = "Operation completed successfully";
      }
    }

    // Determine success based on message content or assume true
    const success =
      !messageRecord ||
      (!messageRecord.message?.toLowerCase().includes("error") &&
        !messageRecord.message?.toLowerCase().includes("fail"));

    // Prepare response data
    let responseData = [];
    if (parseInt(type) === 3 || parseInt(type) === 4) {
      // For select operations, return the data records
      responseData = dataRecords.length > 0 ? dataRecords : firstRecordset;
    } else if (parseInt(type) === 1 && dataRecords.length > 0) {
      // For insert operations, return the new ID if available
      responseData = dataRecords;
    }

    // Set appropriate HTTP status code
    const statusCode = parseInt(type) === 1 ? 201 : 200;

    res.status(statusCode).json({
      success,
      message,
      data: responseData,
    });
  } catch (error) {
    console.error(
      "Error executing usp_M01_company_master_ops procedure:",
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
    });
  }
};

module.exports = {
  companyOperations,
};
