const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const darFullOperations = async (req, res) => {
  const {
    type,
    dar_id,
    employee_id,
    report_date,
    summary,
    status = "Draft",
    Comments,
    Attachments,
  } = req.body;

  try {
    validateLicense();

    // Get user ID from the request for created_by/updated_by
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
      .input("dar_id", sql.Int, dar_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("report_date", sql.Date, report_date || null)
      .input("summary", sql.NVarChar(sql.MAX), summary || null)
      .input("status", sql.NVarChar(20), status)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .input("Comments", sql.NVarChar(sql.MAX), Comments || null)
      .input("Attachments", sql.NVarChar(sql.MAX), Attachments || null)
      .execute("usp_DARFullOps");

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
        success = Boolean(firstRow.IsSuccess);
        message = firstRow.Message || "";

        // Handle different data structures based on operation type
        if (success) {
          switch (parseInt(type)) {
            case 1: // INSERT
            case 2: // UPDATE
              if (result.recordsets.length >= 3) {
                data = {
                  dar_master: result.recordsets[1] || [],
                  review_comments: result.recordsets[2] || [],
                  attachments: result.recordsets[3] || [],
                };
              } else if (result.recordsets.length >= 1) {
                data = result.recordsets[1] || [];
              }
              break;

            case 3: // GET ACTIVE DARs
              data = result.recordsets[1] || [];
              break;

            case 4: // GET DAR BY ID
              if (result.recordsets.length >= 3) {
                data = {
                  dar_master: result.recordsets[1] || [],
                  review_comments: result.recordsets[2] || [],
                  attachments: result.recordsets[3] || [],
                };
              }
              break;

            case 5: // CLOSE DAR
            case 6: // COMPLETE DAR
              // No additional data, just success message
              data = { dar_id };
              break;
          }
        }
      }
    }

    // Set appropriate HTTP status code
    if (parseInt(type) === 1 && success) {
      statusCode = 201; // Created for new DAR
    } else if (!success) {
      if (message.includes("Invalid status")) {
        statusCode = 400; // Bad request for validation errors
      } else {
        statusCode = 500; // Internal server error for other failures
      }
    }

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
    });
  } catch (error) {
    console.error("Error executing usp_DARFullOps procedure:", error);

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
  darFullOperations,
};
