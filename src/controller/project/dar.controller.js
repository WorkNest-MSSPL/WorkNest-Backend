const { getConnection, sql } = require("../../config/database.js");
const { getUserId } = require("../../utils/UserInfo.js");

const darController = {
  /**
   * @desc    Create Daily Activity Report
   * @route   POST /api/dar
   * @access  Private
   */
  createDAR: async (req, res) => {
    let transaction;
    try {
      const { report_date, summary, tasks } = req.body;
      const userId = getUserId();

      if (!report_date) {
        return res.status(400).json({
          success: false,
          message: "Report date is required",
        });
      }

      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check if DAR already exists for the date and employee
      const existingDAR = await pool
        .request()
        .input("employee_id", req.user.employee_id)
        .input("report_date", report_date)
        .query(
          "SELECT dar_id FROM T04_dar_master WHERE employee_id = @employee_id AND report_date = @report_date"
        );

      if (existingDAR.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "DAR already exists for this date",
        });
      }

      // Create DAR
      const darResult = await pool
        .request()
        .input("employee_id", userId)
        .input("report_date", report_date)
        .input("summary", summary || null).query(`
          INSERT INTO T04_dar_master 
          (employee_id, report_date, summary)
          OUTPUT INSERTED.dar_id, INSERTED.created_at
          VALUES (@employee_id, @report_date, @summary)
        `);

      const darId = darResult.recordset[0].dar_id;

      // Add DAR tasks
      if (tasks && tasks.length > 0) {
        for (const task of tasks) {
          await pool
            .request()
            .input("dar_id", darId)
            .input("task_id", task.task_id || null)
            .input("work_description", task.work_description)
            .input("hours_spent", task.hours_spent || null)
            .input("progress_percentage", task.progress_percentage || null)
            .query(`
              INSERT INTO T05_dar_tasks 
              (dar_id, task_id, work_description, hours_spent, progress_percentage)
              VALUES (@dar_id, @task_id, @work_description, @hours_spent, @progress_percentage)
            `);
        }
      }

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: "DAR created successfully",
        data: {
          dar_id: darId,
          report_date: report_date,
          created_at: darResult.recordset[0].created_at,
        },
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Create DAR error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get all DARs with filters
   * @route   GET /api/dar
   * @access  Private
   */
  getAllDARs: async (req, res) => {
    try {
      const { employee_id, report_date_from, report_date_to, status } =
        req.query;
      const pool = await getConnection();
      let request = pool.request();
      let whereConditions = [];

      let query = `
        SELECT 
          d.*,
          emp.first_name + ' ' + ISNULL(emp.last_name, '') as employee_name,
          emp.employee_code,
          COUNT(dt.dar_task_id) as task_count,
          SUM(dt.hours_spent) as total_hours
        FROM T04_dar_master d
        INNER JOIN E01_employee_master emp ON d.employee_id = emp.employee_id
        LEFT JOIN T05_dar_tasks dt ON d.dar_id = dt.dar_id
      `;

      // If not admin, only show own DARs
      // if (
      //   !req.user.roles.includes("Admin") &&
      //   !req.user.roles.includes("Manager")
      // ) {
      //   whereConditions.push("d.employee_id = @employee_id");
      //   request.input("employee_id", req.user.employee_id);
      // } else if (employee_id) {
      //   whereConditions.push("d.employee_id = @employee_id");
      //   request.input("employee_id", parseInt(employee_id));
      // }

      if (report_date_from) {
        whereConditions.push("d.report_date >= @report_date_from");
        request.input("report_date_from", report_date_from);
      }

      if (report_date_to) {
        whereConditions.push("d.report_date <= @report_date_to");
        request.input("report_date_to", report_date_to);
      }

      if (status) {
        whereConditions.push("d.status = @status");
        request.input("status", status);
      }

      if (whereConditions.length > 0) {
        query += " WHERE " + whereConditions.join(" AND ");
      }

      query +=
        " GROUP BY d.dar_id, d.employee_id, d.report_date, d.summary, d.status, " +
        "d.created_at, d.updated_at, d.updated_by, emp.first_name, emp.last_name, emp.employee_code " +
        "ORDER BY d.report_date DESC, d.created_at DESC";

      const result = await request.query(query);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get DARs error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get DAR by ID
   * @route   GET /api/dar/:id
   * @access  Private
   */
  getDARById: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId();
      const pool = await getConnection();

      const darResult = await pool.request().input("dar_id", parseInt(id))
        .query(`
          SELECT 
            d.*,
            emp.first_name + ' ' + ISNULL(emp.last_name, '') as employee_name,
            emp.employee_code
          FROM T04_dar_master d
          INNER JOIN E01_employee_master emp ON d.employee_id = emp.employee_id
          WHERE d.dar_id = @dar_id
        `);

      if (darResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "DAR not found",
        });
      }

      // Check access rights
      // if (
      //   !req.user.roles.includes("Admin") &&
      //   !req.user.roles.includes("Manager") &&
      //   darResult.recordset[0].employee_id !== userId
      // ) {
      //   return res.status(403).json({
      //     success: false,
      //     message: "Access denied",
      //   });
      // }

      // Get DAR tasks
      const tasksResult = await pool.request().input("dar_id", parseInt(id))
        .query(`
          SELECT dt.*, t.title as task_title, t.task_code
          FROM T05_dar_tasks dt
          LEFT JOIN T01_task_master_heirarchical t ON dt.task_id = t.task_id
          WHERE dt.dar_id = @dar_id
          ORDER BY dt.created_at
        `);

      // Get review comments
      const reviewsResult = await pool.request().input("dar_id", parseInt(id))
        .query(`
          SELECT dr.*, emp.first_name + ' ' + ISNULL(emp.last_name, '') as reviewed_by_name
          FROM T06_dar_review_comments dr
          LEFT JOIN E01_employee_master emp ON dr.reviewed_by = emp.employee_id
          WHERE dr.dar_id = @dar_id
          ORDER BY dr.reviewed_at DESC
        `);

      // Get attachments
      const attachmentsResult = await pool
        .request()
        .input("dar_id", parseInt(id)).query(`
          SELECT da.*, emp.first_name + ' ' + ISNULL(emp.last_name, '') as uploaded_by_name
          FROM T07_dar_attachments da
          LEFT JOIN E01_employee_master emp ON da.uploaded_by = emp.employee_id
          WHERE da.dar_id = @dar_id
          ORDER BY da.uploaded_at DESC
        `);

      res.json({
        success: true,
        data: {
          ...darResult.recordset[0],
          tasks: tasksResult.recordset,
          reviews: reviewsResult.recordset,
          attachments: attachmentsResult.recordset,
        },
      });
    } catch (error) {
      console.error("Get DAR by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Update DAR
   * @route   PUT /api/dar/:id
   * @access  Private
   */
  updateDAR: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = getUserId();

      const pool = await getConnection();

      // Check if DAR exists
      const existingDAR = await pool
        .request()
        .input("dar_id", parseInt(id))
        .query("SELECT * FROM T04_dar_master WHERE dar_id = @dar_id");

      if (existingDAR.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "DAR not found",
        });
      }

      // Check access rights
      // if (
      //   !req.user.roles.includes("Admin") &&
      //   !req.user.roles.includes("Manager") &&
      //   existingDAR.recordset[0].employee_id !== req.user.employee_id
      // ) {
      //   return res.status(403).json({
      //     success: false,
      //     message: "Access denied",
      //   });
      // }

      // Build dynamic update
      const updateFields = [];
      const request = pool.request();
      request.input("dar_id", parseInt(id));
      request.input("updated_by", userId);

      const allowedFields = ["summary", "status"];
      allowedFields.forEach((field) => {
        if (updates[field] !== undefined) {
          updateFields.push(`${field} = @${field}`);
          request.input(field, updates[field]);
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      updateFields.push("updated_at = GETDATE()");
      updateFields.push("updated_by = @updated_by");

      await request.query(
        `UPDATE T04_dar_master SET ${updateFields.join(
          ", "
        )} WHERE dar_id = @dar_id`
      );

      res.json({
        success: true,
        message: "DAR updated successfully",
      });
    } catch (error) {
      console.error("Update DAR error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Delete DAR
   * @route   DELETE /api/dar/:id
   * @access  Private
   */
  deleteDAR: async (req, res) => {
    let transaction;
    try {
      const { id } = req.params;
      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check if DAR exists
      const existingDAR = await pool
        .request()
        .input("dar_id", parseInt(id))
        .query("SELECT * FROM T04_dar_master WHERE dar_id = @dar_id");

      if (existingDAR.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "DAR not found",
        });
      }

      // Check access rights
      // if (
      //   !req.user.roles.includes("Admin") &&
      //   !req.user.roles.includes("Manager") &&
      //   existingDAR.recordset[0].employee_id !== req.user.employee_id
      // ) {
      //   await transaction.rollback();
      //   return res.status(403).json({
      //     success: false,
      //     message: "Access denied",
      //   });
      // }

      // Delete related records first
      await pool
        .request()
        .input("dar_id", parseInt(id))
        .query("DELETE FROM T05_dar_tasks WHERE dar_id = @dar_id");

      await pool
        .request()
        .input("dar_id", parseInt(id))
        .query("DELETE FROM T06_dar_review_comments WHERE dar_id = @dar_id");

      await pool
        .request()
        .input("dar_id", parseInt(id))
        .query("DELETE FROM T07_dar_attachments WHERE dar_id = @dar_id");

      // Delete DAR
      await pool
        .request()
        .input("dar_id", parseInt(id))
        .query("DELETE FROM T04_dar_master WHERE dar_id = @dar_id");

      await transaction.commit();

      res.json({
        success: true,
        message: "DAR deleted successfully",
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Delete DAR error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Add review comment to DAR
   * @route   POST /api/dar/:id/review
   * @access  Private (Manager/Admin)
   */
  addDARReview: async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const userId = getUserId();

      if (!comments) {
        return res.status(400).json({
          success: false,
          message: "Comments are required",
        });
      }

      const pool = await getConnection();

      // Check if DAR exists
      const existingDAR = await pool
        .request()
        .input("dar_id", parseInt(id))
        .query("SELECT dar_id FROM T04_dar_master WHERE dar_id = @dar_id");

      if (existingDAR.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "DAR not found",
        });
      }

      // Add review comment
      await pool
        .request()
        .input("dar_id", parseInt(id))
        .input("reviewed_by", userId)
        .input("comments", comments).query(`
          INSERT INTO T06_dar_review_comments 
          (dar_id, reviewed_by, comments)
          VALUES (@dar_id, @reviewed_by, @comments)
        `);

      // Update DAR status to reviewed
      await pool
        .request()
        .input("dar_id", parseInt(id))
        .input("updated_by", userId)
        .query(
          "UPDATE T04_dar_master SET status = 'Reviewed', updated_at = GETDATE(), updated_by = @updated_by WHERE dar_id = @dar_id"
        );

      res.json({
        success: true,
        message: "DAR reviewed successfully",
      });
    } catch (error) {
      console.error("Add DAR review error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = darController;
