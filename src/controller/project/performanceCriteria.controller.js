const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

// Get all performance criteria
const getAllPerformanceCriteria = async (req, res) => {
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
    const result = await pool.request().query(`
      SELECT 
        criteria_id,
        criteria_name,
        description,
        max_score,
        weightage,
        status
      FROM EP02_performance_criteria
      WHERE status = 1
      ORDER BY criteria_name
    `);

    res.status(200).json({
      success: true,
      message: "Performance criteria fetched successfully",
      data: result.recordset,
    });
  } catch (error) {
    console.error("Error fetching performance criteria:", error);

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

// Get performance criteria by ID
const getPerformanceCriteriaById = async (req, res) => {
  try {
    validateLicense();

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const { id } = req.params;
    const pool = await getConnection();

    const result = await pool.request().input("criteria_id", sql.Int, id)
      .query(`
        SELECT 
          criteria_id,
          criteria_name,
          description,
          max_score,
          weightage,
          status
        FROM EP02_performance_criteria
        WHERE criteria_id = @criteria_id AND status = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Performance criteria not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Performance criteria fetched successfully",
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("Error fetching performance criteria by ID:", error);

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

// Create new performance criteria
const createPerformanceCriteria = async (req, res) => {
  try {
    validateLicense();

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const {
      criteria_name,
      description,
      max_score,
      weightage,
      status = 1,
    } = req.body;

    // Validation
    if (!criteria_name || !max_score) {
      return res.status(400).json({
        success: false,
        message: "Criteria name and max score are required",
      });
    }

    if (max_score <= 0) {
      return res.status(400).json({
        success: false,
        message: "Max score must be greater than 0",
      });
    }

    if (weightage && (weightage < 0 || weightage > 100)) {
      return res.status(400).json({
        success: false,
        message: "Weightage must be between 0 and 100",
      });
    }

    const pool = await getConnection();

    // Check if criteria name already exists
    const existingCheck = await pool
      .request()
      .input("criteria_name", sql.NVarChar(200), criteria_name).query(`
        SELECT criteria_id FROM EP02_performance_criteria 
        WHERE criteria_name = @criteria_name AND status = 1
      `);

    if (existingCheck.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Performance criteria with this name already exists",
      });
    }

    // Insert new criteria
    const result = await pool
      .request()
      .input("criteria_name", sql.NVarChar(200), criteria_name)
      .input("description", sql.NVarChar(sql.MAX), description || null)
      .input("max_score", sql.Int, max_score)
      .input("weightage", sql.Decimal(5, 2), weightage || null)
      .input("status", sql.TinyInt, status).query(`
        INSERT INTO EP02_performance_criteria (
          criteria_name, description, max_score, weightage, status
        )
        OUTPUT INSERTED.criteria_id, INSERTED.criteria_name, INSERTED.max_score, INSERTED.weightage
        VALUES (@criteria_name, @description, @max_score, @weightage, @status)
      `);

    res.status(201).json({
      success: true,
      message: "Performance criteria created successfully",
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("Error creating performance criteria:", error);

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

// Update performance criteria
const updatePerformanceCriteria = async (req, res) => {
  try {
    validateLicense();

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const { id } = req.params;
    const { criteria_name, description, max_score, weightage, status } =
      req.body;

    // Validation
    if (max_score !== undefined && max_score <= 0) {
      return res.status(400).json({
        success: false,
        message: "Max score must be greater than 0",
      });
    }

    if (weightage !== undefined && (weightage < 0 || weightage > 100)) {
      return res.status(400).json({
        success: false,
        message: "Weightage must be between 0 and 100",
      });
    }

    const pool = await getConnection();

    // Check if criteria exists
    const existingCriteria = await pool
      .request()
      .input("criteria_id", sql.Int, id)
      .query(
        "SELECT criteria_id FROM EP02_performance_criteria WHERE criteria_id = @criteria_id"
      );

    if (existingCriteria.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Performance criteria not found",
      });
    }

    // Check for duplicate criteria name (excluding current record)
    if (criteria_name) {
      const duplicateCheck = await pool
        .request()
        .input("criteria_id", sql.Int, id)
        .input("criteria_name", sql.NVarChar(200), criteria_name).query(`
          SELECT criteria_id FROM EP02_performance_criteria 
          WHERE criteria_name = @criteria_name AND criteria_id != @criteria_id AND status = 1
        `);

      if (duplicateCheck.recordset.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Performance criteria with this name already exists",
        });
      }
    }

    // Build dynamic update query
    let updateFields = [];
    let request = pool.request();

    if (criteria_name !== undefined) {
      updateFields.push("criteria_name = @criteria_name");
      request.input("criteria_name", sql.NVarChar(200), criteria_name);
    }

    if (description !== undefined) {
      updateFields.push("description = @description");
      request.input("description", sql.NVarChar(sql.MAX), description);
    }

    if (max_score !== undefined) {
      updateFields.push("max_score = @max_score");
      request.input("max_score", sql.Int, max_score);
    }

    if (weightage !== undefined) {
      updateFields.push("weightage = @weightage");
      request.input("weightage", sql.Decimal(5, 2), weightage);
    }

    if (status !== undefined) {
      updateFields.push("status = @status");
      request.input("status", sql.TinyInt, status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    request.input("criteria_id", sql.Int, id);

    const query = `
      UPDATE EP02_performance_criteria 
      SET ${updateFields.join(", ")}
      OUTPUT INSERTED.criteria_id, INSERTED.criteria_name, INSERTED.max_score, INSERTED.weightage, INSERTED.status
      WHERE criteria_id = @criteria_id
    `;

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: "Performance criteria updated successfully",
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("Error updating performance criteria:", error);

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

// Delete performance criteria (soft delete)
const deletePerformanceCriteria = async (req, res) => {
  try {
    validateLicense();

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const { id } = req.params;
    const pool = await getConnection();

    // Check if criteria exists
    const existingCriteria = await pool
      .request()
      .input("criteria_id", sql.Int, id)
      .query(
        "SELECT criteria_id FROM EP02_performance_criteria WHERE criteria_id = @criteria_id"
      );

    if (existingCriteria.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Performance criteria not found",
      });
    }

    // Soft delete by setting status to 0
    await pool
      .request()
      .input("criteria_id", sql.Int, id)
      .query(
        "UPDATE EP02_performance_criteria SET status = 0 WHERE criteria_id = @criteria_id"
      );

    res.status(200).json({
      success: true,
      message: "Performance criteria deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting performance criteria:", error);

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
  getAllPerformanceCriteria,
  getPerformanceCriteriaById,
  createPerformanceCriteria,
  updatePerformanceCriteria,
  deletePerformanceCriteria,
};
