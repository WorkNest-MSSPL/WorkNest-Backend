const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const jobApplicationOperations = async (req, res) => {
  const {
    type,
    application_id,
    job_posting_id,
    candidate_name,
    email,
    phone,
    resume_url,
    cover_letter,
    application_date,
    status,
    skills = [],
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

    // Create TVP for skills
    const skillsTVP = new sql.Table();
    skillsTVP.columns.add("skill_id", sql.Int);
    skillsTVP.columns.add("skill_level", sql.NVarChar(50));

    // Add skills to TVP
    skills.forEach((skill) => {
      skillsTVP.rows.add(skill.skill_id, skill.skill_level);
    });

    const result = await pool
      .request()
      .input("type", sql.Int, type)
      .input("application_id", sql.Int, application_id || null)
      .input("job_posting_id", sql.Int, job_posting_id || null)
      .input("candidate_name", sql.NVarChar(200), candidate_name || null)
      .input("email", sql.NVarChar(200), email || null)
      .input("phone", sql.NVarChar(20), phone || null)
      .input("resume_url", sql.NVarChar(500), resume_url || null)
      .input("cover_letter", sql.NVarChar(sql.MAX), cover_letter || null)
      .input("application_date", sql.Date, application_date || null)
      .input("status", sql.NVarChar(20), status || null)
      .input("skills", skillsTVP)
      .execute("USP_ManageJobApplications");

    // Handle response based on operation type
    let success = false;
    let message = "";
    let data = null;
    let statusCode = 200;

    // Check if we have any recordsets
    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];

      // For type 1 (insert), we get application_id directly
      if (type === 1 && firstRecordset.length > 0) {
        success = true;
        data = firstRecordset[0];
        message = "Application created successfully";
        statusCode = 201;
      }
      // For type 2, 4 (update operations)
      else if ((type === 2 || type === 4) && firstRecordset.length > 0) {
        success = true;
        message =
          firstRecordset[0].message || "Operation completed successfully";
      }
      // For type 3, 5, 6 (select operations)
      else if (
        (type === 3 || type === 5 || type === 6) &&
        firstRecordset.length > 0
      ) {
        success = true;

        // Parse skills JSON string to array
        const applications = firstRecordset.map((app) => {
          if (app.skills) {
            try {
              app.skills = JSON.parse(app.skills);
            } catch (e) {
              app.skills = [];
            }
          } else {
            app.skills = [];
          }
          return app;
        });

        data = type === 3 ? applications[0] : applications;
        message = "Data retrieved successfully";
      }
    }

    // Handle empty results for select operations
    if (
      (type === 3 || type === 5 || type === 6) &&
      (!data || (Array.isArray(data) && data.length === 0))
    ) {
      success = true;
      message = "No applications found";
      data = type === 3 ? null : [];
    }

    // Set appropriate HTTP status code for errors
    if (!success) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      success,
      message,
      data,
    });
  } catch (error) {
    console.error(
      "Error executing USP_ManageJobApplications procedure:",
      error
    );

    // Handle specific error cases
    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    // Handle database validation errors
    if (
      error.message?.includes("invalid") ||
      error.message?.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
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
  jobApplicationOperations,
};
