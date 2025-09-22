const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const employeeSalaryStructureOperations = async (req, res) => {
  const {
    type,
    emp_salary_id,
    employee_id,
    structure_id,
    assigned_from,
    assigned_to,
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
      .input("emp_salary_id", sql.Int, emp_salary_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("structure_id", sql.Int, structure_id || null)
      .input("assigned_from", sql.Date, assigned_from || null)
      .input("assigned_to", sql.Date, assigned_to || null)
      .execute("usp_P04_employee_salary_structure_ops");

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

        // SELECT operations return data in the 2nd recordset
        if (
          (parseInt(type) === 3 ||
            parseInt(type) === 4 ||
            parseInt(type) === 5) &&
          result.recordsets.length > 1
        ) {
          data = result.recordsets[1];
        }
      }
    }

    if (success === undefined || success === null) {
      success = Boolean(data && data.length > 0);
    }

    if (parseInt(type) === 1 && success) {
      statusCode = 201; // Created
    } else if (!success) {
      statusCode = 400; // Bad request
    }

    if (success && !data) {
      switch (parseInt(type)) {
        case 1:
          message =
            message || "Employee salary structure assigned successfully";
          break;
        case 2:
          message = message || "Employee salary structure updated successfully";
          break;
        case 6:
          message = message || "Employee salary structure closed successfully";
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
      "Error executing usp_P04_employee_salary_structure_ops procedure:",
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
  employeeSalaryStructureOperations,
};
