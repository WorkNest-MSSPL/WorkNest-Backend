const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const visitorManageOperations = async (req, res) => {
  const {
    type,
    visitor_id,
    first_name,
    last_name,
    email,
    phone,
    company_name,
    government_id_type,
    government_id_number,
    photo_url,
    vehicle_number,
    vehicle_type,
    parking_slot,
    area_name,
    access_start_time,
    access_end_time,
    host_employee_id,
    visit_date,
    visit_time,
    purpose,
    special_instructions,
    checkin_location,
    badge_number,
    badge_qr_code_url,
    checkout_location,
    checked_out_by,
    remarks,
  } = req.body;

  try {
    validateLicense();

    // Get user ID from the request for performed_by
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
      .input("visitor_id", sql.Int, visitor_id || null)
      .input("first_name", sql.NVarChar(100), first_name || null)
      .input("last_name", sql.NVarChar(100), last_name || null)
      .input("email", sql.NVarChar(200), email || null)
      .input("phone", sql.NVarChar(20), phone || null)
      .input("company_name", sql.NVarChar(200), company_name || null)
      .input("government_id_type", sql.NVarChar(50), government_id_type || null)
      .input(
        "government_id_number",
        sql.NVarChar(100),
        government_id_number || null
      )
      .input("photo_url", sql.NVarChar(500), photo_url || null)
      .input("vehicle_number", sql.NVarChar(50), vehicle_number || null)
      .input("vehicle_type", sql.NVarChar(50), vehicle_type || null)
      .input("parking_slot", sql.NVarChar(50), parking_slot || null)
      .input("area_name", sql.NVarChar(200), area_name || null)
      .input("access_start_time", sql.DateTime, access_start_time || null)
      .input("access_end_time", sql.DateTime, access_end_time || null)
      .input("host_employee_id", sql.Int, host_employee_id || null)
      .input("visit_date", sql.Date, visit_date || null)
      .input("visit_time", sql.Time, visit_time || null)
      .input("purpose", sql.NVarChar(500), purpose || null)
      .input(
        "special_instructions",
        sql.NVarChar(500),
        special_instructions || null
      )
      .input("checkin_location", sql.NVarChar(200), checkin_location || null)
      .input("badge_number", sql.NVarChar(50), badge_number || null)
      .input("badge_qr_code_url", sql.NVarChar(500), badge_qr_code_url || null)
      .input("checkout_location", sql.NVarChar(200), checkout_location || null)
      .input("checked_out_by", sql.Int, checked_out_by || null)
      .input("remarks", sql.NVarChar(500), remarks || null)
      .input("performed_by", sql.Int, userId)
      .execute("usp_Visitor_ManageOps");

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

        // For successful operations, extract the returned IDs
        if (success && firstRecordset.length > 0) {
          data = {
            visitor_id: firstRow.visitor_id || null,
            prereg_id: firstRow.prereg_id || null,
            checkin_id: firstRow.checkin_id || null,
          };
        }
      }
    }

    // Set appropriate HTTP status code
    if (parseInt(type) === 1 && success) {
      statusCode = 201; // Created for first-time registration
    } else if (!success) {
      // Determine specific error status codes
      if (message.includes("is required")) {
        statusCode = 400; // Bad request for missing required fields
      } else if (message.includes("No active check-in found")) {
        statusCode = 404; // Not found
      } else if (message.includes("Error:")) {
        statusCode = 500; // Internal server error
      } else {
        statusCode = 400; // Default bad request
      }
    }

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
    });
  } catch (error) {
    console.error("Error executing usp_Visitor_ManageOps procedure:", error);

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
  visitorManageOperations,
};
