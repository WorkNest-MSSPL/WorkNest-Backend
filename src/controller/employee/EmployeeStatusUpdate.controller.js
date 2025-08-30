const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const updateEmployeeStatus = async (req, res) => {
  const { employee_code, status } = req.body;

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

    // Validate required fields
    if (!employee_code) {
      return res.status(400).json({
        success: false,
        message: "Employee code is required",
      });
    }

    if (![0, 1, 2].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status value. Allowed values: 0=Inactive, 1=Active, 2=Archived",
      });
    }

    const pool = await getConnection();

    await pool
      .request()
      .input("EmployeeCode", sql.NVarChar(50), employee_code)
      .input("UpdatedBy", sql.Int, userId)
      .input("Status", sql.Int, status)
      .execute("usp_UpdateEmployeeStatus");

    res.status(200).json({
      success: true,
      message: "Employee status updated successfully",
      data: {
        employee_code: employee_code,
        new_status: status,
      },
    });
  } catch (error) {
    console.error("Error executing usp_UpdateEmployeeStatus procedure:", error);

    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    if (error.message?.includes("Employee Code not found")) {
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
  updateEmployeeStatus,
};
