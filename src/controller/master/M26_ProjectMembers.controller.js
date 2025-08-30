const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const projectMembersOperations = async (req, res) => {
  const {
    type,
    member_id,
    project_id,
    employee_id,
    role_in_project,
    assigned_date,
    released_date,
    status = 1,
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

    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("member_id", sql.Int, member_id || null)
      .input("project_id", sql.Int, project_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("role_in_project", sql.NVarChar(100), role_in_project || null)
      .input("assigned_date", sql.Date, assigned_date || null)
      .input("released_date", sql.Date, released_date || null)
      .input("status", sql.TinyInt, status)
      .input("created_by", sql.Int, userId)
      .input("updated_by", sql.Int, userId)
      .execute("usp_M26_project_members_ops");

    let success = false,
      message = "",
      data = null,
      statusCode = 200;

    if (result.recordsets?.length > 0) {
      const firstSet = result.recordsets[0];
      if (firstSet.length > 0) {
        success = Boolean(firstSet[0].isSuccess);
        message = firstSet[0].message || "";

        if ((type === 1 || type === 2) && result.recordsets.length > 1) {
          data = result.recordsets[1];
        }

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
          message ||= "Member added successfully";
          break;
        case 2:
          message ||= "Member updated successfully";
          break;
        case 5:
          message ||= "Member released successfully";
          break;
      }
    }

    res.status(statusCode).json({ success, message, data: data || null });
  } catch (error) {
    console.error("Error executing usp_M26_project_members_ops:", error);

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

module.exports = { projectMembersOperations };
