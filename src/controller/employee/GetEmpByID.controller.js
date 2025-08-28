const { getConnection, sql } = require("../../config/database.js");
const { validateLicense } = require("../../../checker.obf.js");
const { getUserId } = require("../../utils/UserInfo.js");

const getEmployeeProfileByCode = async (req, res) => {
  const { employee_code } = req.body;

  try {
    validateLicense();

    // Get user ID from the request (optional for GET, but good for audit)
    const userId = getUserId(req);

    if (!employee_code) {
      return res.status(400).json({
        success: false,
        message: "Employee code is required",
      });
    }

    const pool = await getConnection();

    const result = await pool
      .request()
      .input("EmployeeCode", sql.NVarChar(50), employee_code)
      .execute("usp_GetEmployeeProfileByCode");

    // Handle the result from stored procedure
    let success = false;
    let message = "";
    let data = null;
    let statusCode = 200;

    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];

      if (firstRecordset.length > 0) {
        const firstRow = firstRecordset[0];

        // Parse JSON data from each column
        data = {
          employee_master: firstRow.EmployeeMaster
            ? JSON.parse(firstRow.EmployeeMaster)
            : null,
          contact_info: firstRow.ContactInfo
            ? JSON.parse(firstRow.ContactInfo)
            : null,
          dependents: firstRow.Dependents
            ? JSON.parse(firstRow.Dependents)
            : [],
          education: firstRow.Education ? JSON.parse(firstRow.Education) : [],
          employment_history: firstRow.EmploymentHistory
            ? JSON.parse(firstRow.EmploymentHistory)
            : [],
          skills: firstRow.Skills ? JSON.parse(firstRow.Skills) : [],
          certifications: firstRow.Certifications
            ? JSON.parse(firstRow.Certifications)
            : [],
        };

        success = true;
        message = "Employee profile retrieved successfully";
      } else {
        success = false;
        message = "Employee not found";
        statusCode = 404;
      }
    } else {
      success = false;
      message = "Employee not found";
      statusCode = 404;
    }

    res.status(statusCode).json({
      success,
      message,
      data,
    });
  } catch (error) {
    console.error(
      "Error executing usp_GetEmployeeProfileByCode procedure:",
      error
    );

    // Handle specific error cases
    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    if (error.message?.includes("Employee not found")) {
      return res.status(404).json({
        success: false,
        message: "Employee not found with the provided code",
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
  getEmployeeProfileByCode,
};
