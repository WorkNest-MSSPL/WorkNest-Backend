const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const leavePolicyRuleOperations = async (req, res) => {
  const {
    type,
    rule_id,
    policy_id,
    leave_type_id,
    accrual_days_per_period,
    max_consecutive_days,
    requires_approval = true,
    min_notice_days = 0,
    probation_restriction = false,
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
      .input("rule_id", sql.Int, rule_id || null)
      .input("policy_id", sql.Int, policy_id || null)
      .input("leave_type_id", sql.Int, leave_type_id || null)
      .input(
        "accrual_days_per_period",
        sql.Decimal(6, 2),
        accrual_days_per_period || null
      )
      .input(
        "max_consecutive_days",
        sql.Decimal(6, 2),
        max_consecutive_days || null
      )
      .input("requires_approval", sql.Bit, requires_approval ? 1 : 0)
      .input("min_notice_days", sql.Int, min_notice_days)
      .input("probation_restriction", sql.Bit, probation_restriction ? 1 : 0)
      .input("user_id", sql.Int, userId)
      .execute("usp_L02_leave_policy_rule_ops");

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
          message = message || "Policy rule created successfully";
          break;
        case 2:
          message = message || "Policy rule updated successfully";
          break;
        case 5:
          message = message || "Policy rule deleted successfully";
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
      "Error executing usp_L02_leave_policy_rule_ops procedure:",
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

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  leavePolicyRuleOperations,
};
