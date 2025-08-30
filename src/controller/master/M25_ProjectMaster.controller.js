const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const projectMasterOperations = async (req, res) => {
  const {
    type,
    project_id,
    project_code,
    project_name,
    description,
    client_name,
    start_date,
    end_date,
    status = 1,
    budget,
  } = req.body;

  try {
    validateLicense();

    // Get logged-in user
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
      .input("project_id", sql.Int, project_id || null)
      .input("project_code", sql.NVarChar(50), project_code || null)
      .input("project_name", sql.NVarChar(255), project_name || null)
      .input("description", sql.NVarChar(sql.MAX), description || null)
      .input("client_name", sql.NVarChar(255), client_name || null)
      .input("start_date", sql.Date, start_date || null)
      .input("end_date", sql.Date, end_date || null)
      .input("status", sql.TinyInt, status)
      .input("budget", sql.Decimal(18, 2), budget || null)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_M25_project_master_ops");

    let success = false,
      message = "",
      data = null,
      statusCode = 200;

    if (result.recordsets?.length > 0) {
      const firstSet = result.recordsets[0];
      if (firstSet.length > 0) {
        success = Boolean(firstSet[0].isSuccess);
        message = firstSet[0].message || "";

        // For insert/update, data may come in second recordset
        if ((type === 1 || type === 2) && result.recordsets.length > 1) {
          data = result.recordsets[1];
        }

        // For selects
        if (
          (type === 3 || type === 4 || type === 8) &&
          result.recordsets.length > 1
        ) {
          data = result.recordsets[1];
        }
      }
    }

    if (!success && (type === 3 || type === 4 || type === 8)) {
      success = true;
      data = result.recordsets?.[0] || [];
    }

    if (type === 1 && success) statusCode = 201;
    if (!success) statusCode = 400;

    if (success && !data) {
      switch (type) {
        case 1:
          message ||= "Project created successfully";
          break;
        case 2:
          message ||= "Project updated successfully";
          break;
        case 5:
          message ||= "Project status updated successfully";
          break;
      }
    }

    res.status(statusCode).json({ success, message, data: data || null });
  } catch (error) {
    console.error("Error executing usp_M25_project_master_ops:", error);

    if (error.message?.includes("License validation failed")) {
      return res
        .status(403)
        .json({ success: false, message: "License validation failed" });
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = { projectMasterOperations };
