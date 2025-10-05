const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const getAllEmployees = async (req, res) => {
  try {
    validateLicense();

    const pool = await getConnection();

    const result = await pool.request().execute("usp_GetAllEmployees");

    // Check if we have any recordsets
    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];

      // Extract success and message from first record
      if (firstRecordset.length > 0) {
        const firstRow = firstRecordset[0];
        const success = Boolean(firstRow.IsSuccess);
        const message = firstRow.Message || "";

        let employees = null;

        // Parse JSON data if available
        if (firstRow.Employees) {
          try {
            employees = JSON.parse(firstRow.Employees);
          } catch (parseError) {
            console.error("Error parsing employees JSON:", parseError);
            employees = null;
          }
        }

        // Set appropriate HTTP status code
        const statusCode = success ? 200 : 404;

        return res.status(statusCode).json({
          success,
          message,
          data: employees,
        });
      }
    }

    // If no records found or unexpected response format
    res.status(404).json({
      success: false,
      message: "No employees found",
      data: null,
    });
  } catch (error) {
    console.error("Error executing usp_GetAllEmployees procedure:", error);

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
  getAllEmployees,
};
