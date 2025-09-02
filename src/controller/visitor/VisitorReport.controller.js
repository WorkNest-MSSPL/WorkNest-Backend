const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const visitorReportOperations = async (req, res) => {
  const { type, visitor_id } = req.body;

  try {
    validateLicense();

    const pool = await getConnection();

    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("visitor_id", sql.Int, visitor_id || null)
      .execute("usp_Visitor_ReportOps");

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

        // For all report types, the actual data starts from the second recordset
        if (result.recordsets.length > 1) {
          // For Type 4 (Full detail), we have multiple recordsets for different data types
          if (parseInt(type) === 4 && result.recordsets.length > 2) {
            data = {
              profile: result.recordsets[1] || [],
              photos: result.recordsets[2] || [],
              preregistrations: result.recordsets[3] || [],
              vehicles: result.recordsets[4] || [],
              access_areas: result.recordsets[5] || [],
              logs: result.recordsets[6] || [],
              checkins_checkouts: result.recordsets[7] || [],
              blacklist_entries: result.recordsets[8] || [],
            };
          } else {
            // For other types, we have a single data recordset
            data = result.recordsets[1];
          }
        }
      }
    }

    // If no success flag was found, check if we have any data
    if (success === undefined || success === null) {
      success = Boolean(
        data &&
          (Array.isArray(data)
            ? data.length > 0
            : Object.values(data).some((arr) => arr.length > 0))
      );
    }

    // Set appropriate HTTP status code
    if (!success) {
      statusCode = 404; // Not found for missing data
    }

    // Handle validation errors
    if (message.includes("is required")) {
      statusCode = 400; // Bad request
    }

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
    });
  } catch (error) {
    console.error("Error executing usp_Visitor_ReportOps procedure:", error);

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
  visitorReportOperations,
};
