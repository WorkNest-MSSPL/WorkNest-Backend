const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const leavePolicyOperations = async (req, res) => {
  const {
    type,
    policy_id,
    company_id,
    policy_name,
    description,
    accrual_frequency,
    carry_forward_allowed = false,
    max_carry_forward_days,
    encashment_allowed = false,
    effective_from,
    effective_to,
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
      .input("policy_id", sql.Int, policy_id || null)
      .input("company_id", sql.Int, company_id || null)
      .input("policy_name", sql.NVarChar(200), policy_name || null)
      .input("description", sql.NVarChar(500), description || null)
      .input("accrual_frequency", sql.NVarChar(50), accrual_frequency || null)
      .input("carry_forward_allowed", sql.Bit, carry_forward_allowed ? 1 : 0)
      .input(
        "max_carry_forward_days",
        sql.Decimal(6, 2),
        max_carry_forward_days || null
      )
      .input("encashment_allowed", sql.Bit, encashment_allowed ? 1 : 0)
      .input("effective_from", sql.Date, effective_from || null)
      .input("effective_to", sql.Date, effective_to || null)
      .input("user_id", sql.Int, userId)
      .execute("usp_L01_leave_policy_ops");

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
          (parseInt(type) === 3 || parseInt(type) === 4) &&
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
          message = message || "Leave policy created successfully";
          break;
        case 2:
          message = message || "Leave policy updated successfully";
          break;
        case 5:
          message = message || "Leave policy deleted successfully";
          break;
      }
    }

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
    });
  } catch (error) {
    console.error("Error executing usp_L01_leave_policy_ops procedure:", error);

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

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  leavePolicyOperations,
};
