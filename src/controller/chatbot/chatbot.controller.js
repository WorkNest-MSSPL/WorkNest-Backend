const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const RequestedTable = {
  HR: [
    "E01_employee_master",
    "E02_employee_personal_details",
    "E03_employee_contact_details",
    "E04_employee_job_details",
    "E05_employee_bank_details",
    "E06_employee_documents",
    "M01_country_master",
    "M02_department_master",
    "M03_designation_master",
    "M04_branch_master",
    "M05_location_master",
    "M06_employment_type_master",
  ],
};

const chatBotOperations = async (req, res) => {
  const {
    type,
    question,
    requested_tables,
    employee_id,
    is_public = true,
  } = req.body;

  try {
    validateLicense();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const pool = await getConnection();
    let result;
  } catch (error) {
    console.error("Error in leaveApprovalOperations:", error);

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
  chatBotOperations,
};
