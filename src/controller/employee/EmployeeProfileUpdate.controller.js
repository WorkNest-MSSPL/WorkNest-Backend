const { getConnection, sql } = require("../../config/database.js");
const { validateLicense } = require("../../../checker.obf.js");
const { getUserId } = require("../../utils/UserInfo.js");

const updateEmployeeProfile = async (req, res) => {
  const {
    // Employee Code (Identifier)
    employee_code,

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

    // Validate required field
    if (!employee_code) {
      return res.status(400).json({
        success: false,
        message: "Employee code is required",
      });
    }

    const pool = await getConnection();

    const result = await pool
      .request()
      // Employee Code (Identifier)
      .input("EmployeeCode", sql.NVarChar(50), employee_code)

      // Employee Master inputs
      .input("FirstName", sql.NVarChar(100), first_name || null)
      .input("LastName", sql.NVarChar(100), last_name || null)
      .input("DOB", sql.Date, dob || null)
      .input("Gender", sql.NVarChar(10), gender || null)
      .input("MaritalStatus", sql.NVarChar(20), marital_status || null)
      .input("NationalityID", sql.Int, nationality_id || null)
      .input("CompanyID", sql.Int, company_id || null)
      .input("BranchID", sql.Int, branch_id || null)
      .input("DepartmentID", sql.Int, department_id || null)
      .input("DesignationID", sql.Int, designation_id || null)
      .input("ShiftID", sql.Int, shift_id || null)
      .input("UpdatedBy", sql.Int, userId)

      // Contact Info inputs
      .input("AddressLine1", sql.NVarChar(255), address_line1 || null)
      .input("AddressLine2", sql.NVarChar(255), address_line2 || null)
      .input("CityID", sql.Int, city_id || null)
      .input("StateID", sql.Int, state_id || null)
      .input("CountryID", sql.Int, country_id || null)
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
      .execute("usp_UpdateEmployeeProfile");

    // For update operations, we don't expect a resultset, just completion
    res.status(200).json({
      success: true,
      message: "Employee profile updated successfully",
      data: {
        employee_code: employee_code,
      },
    });
  } catch (error) {
    console.error(
      "Error executing usp_UpdateEmployeeProfile procedure:",
      error
    );

    // Handle specific error cases
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
  updateEmployeeProfile,
};
