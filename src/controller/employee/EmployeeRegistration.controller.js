const { getConnection, sql } = require("../../config/database.js");
const { validateLicense } = require("../../../checker.obf.js");
const { getUserId } = require("../../utils/UserInfo.js");

const registerEmployee = async (req, res) => {
  const {
    // Employee Master
    first_name,
    last_name,
    dob,
    gender,
    marital_status,
    nationality_id,
    company_id,
    branch_id,
    department_id,
    designation_id,
    shift_id,

    // Contact Info
    address_line1,
    address_line2,
    city_id,
    state_id,
    country_id,
    postal_code,
    phone_number,
    email,
    emergency_contact_name,
    emergency_contact_phone,

    // JSON data
    dependents,
    education,
    employment_history,
    skills,
    certifications,
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
      // Employee Master inputs
      .input("FirstName", sql.NVarChar(100), first_name)
      .input("LastName", sql.NVarChar(100), last_name)
      .input("DOB", sql.Date, dob)
      .input("Gender", sql.NVarChar(10), gender)
      .input("MaritalStatus", sql.NVarChar(20), marital_status)
      .input("NationalityID", sql.Int, nationality_id)
      .input("CompanyID", sql.Int, company_id)
      .input("BranchID", sql.Int, branch_id)
      .input("DepartmentID", sql.Int, department_id)
      .input("DesignationID", sql.Int, designation_id)
      .input("ShiftID", sql.Int, shift_id)
      .input("CreatedBy", sql.Int, userId)

      // Contact Info inputs
      .input("AddressLine1", sql.NVarChar(255), address_line1 || null)
      .input("AddressLine2", sql.NVarChar(255), address_line2 || null)
      .input("CityID", sql.Int, city_id)
      .input("StateID", sql.Int, state_id)
      .input("CountryID", sql.Int, country_id)
      .input("PostalCode", sql.NVarChar(20), postal_code || null)
      .input("PhoneNumber", sql.NVarChar(20), phone_number || null)
      .input("Email", sql.NVarChar(255), email || null)
      .input(
        "EmergencyContactName",
        sql.NVarChar(255),
        emergency_contact_name || null
      )
      .input(
        "EmergencyContactPhone",
        sql.NVarChar(20),
        emergency_contact_phone || null
      )

      // JSON inputs
      .input(
        "Dependents",
        sql.NVarChar(sql.MAX),
        dependents ? JSON.stringify(dependents) : null
      )
      .input(
        "Education",
        sql.NVarChar(sql.MAX),
        education ? JSON.stringify(education) : null
      )
      .input(
        "EmploymentHistory",
        sql.NVarChar(sql.MAX),
        employment_history ? JSON.stringify(employment_history) : null
      )
      .input(
        "Skills",
        sql.NVarChar(sql.MAX),
        skills ? JSON.stringify(skills) : null
      )
      .input(
        "Certifications",
        sql.NVarChar(sql.MAX),
        certifications ? JSON.stringify(certifications) : null
      )
      .execute("usp_RegisterEmployee");

    // Handle the result from stored procedure
    let success = false;
    let message = "";
    let data = null;
    let statusCode = 200;

    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];

      if (firstRecordset.length > 0) {
        const firstRow = firstRecordset[0];
        success = Boolean(firstRow.IsSuccess);
        message = firstRow.Message || "";

        // Extract the returned data
        data = {
          employee_code: firstRow.EmployeeCode,
          employee_id: firstRow.EmployeeID,
        };
      }
    }

    // Set appropriate HTTP status code
    if (success) {
      statusCode = 201; // Created
    } else {
      statusCode = 400; // Bad request
    }

    res.status(statusCode).json({
      success,
      message,
      data,
    });
  } catch (error) {
    console.error("Error executing usp_RegisterEmployee procedure:", error);

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
  registerEmployee,
};
