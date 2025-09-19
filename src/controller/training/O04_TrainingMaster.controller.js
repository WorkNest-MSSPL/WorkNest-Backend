const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const trainingMasterOperations = async (req, res) => {
  const {
    type,
    training_id,
    title,
    description,
    start_date,
    end_date,
    location,
    trainer_name,
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

    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("training_id", sql.Int, training_id || null)
      .input("title", sql.NVarChar(200), title || null)
      .input("description", sql.NVarChar(sql.MAX), description || null)
      .input("start_date", sql.Date, start_date || null)
      .input("end_date", sql.Date, end_date || null)
      .input("location", sql.NVarChar(200), location || null)
      .input("trainer_name", sql.NVarChar(200), trainer_name || null)
      .input("status", sql.Int, status)
      .execute("usp_O04_training_master_ops");

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
            parseInt(type) === 7 ||
            parseInt(type) === 8) &&
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
          message = message || "Training created successfully";
          break;
        case 2:
          message = message || "Training updated successfully";
          break;
        case 5:
          message =
            message ||
            (status === 1 ? "Training activated" : "Training deactivated");
          break;
        case 6:
          message = message || "Training archived successfully";
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
      "Error executing usp_O04_training_master_ops procedure:",
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
  trainingMasterOperations,
};
