const { getConnection, sql } = require("../../config/database.js");
const { getUserId } = require("../../utils/UserInfo.js");

const performanceController = {
  /**
   * @desc    Create performance evaluation
   * @route   POST /api/performance/evaluations
   * @access  Private (Manager/Admin)
   */
  createPerformanceEvaluation: async (req, res) => {
    let transaction;
    try {
      const {
        employee_id,
        project_id,
        evaluation_period,
        evaluation_date,
        criteria_scores,
      } = req.body;

      const userId = getUserId(req);
      if (
        !employee_id ||
        !evaluation_period ||
        !evaluation_date ||
        !criteria_scores
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Employee ID, evaluation period, date, and criteria scores are required",
        });
      }

      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Calculate overall rating
      let totalWeightedScore = 0;
      let totalWeightage = 0;

      for (const score of criteria_scores) {
        const criteriaResult = await pool
          .request()
          .input("criteria_id", score.criteria_id)
          .query(
            "SELECT weightage FROM EP02_performance_criteria WHERE criteria_id = @criteria_id AND status = 1"
          );

        if (criteriaResult.recordset.length === 0) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: `Criteria ID ${score.criteria_id} not found`,
          });
        }

        const weightage =
          parseFloat(criteriaResult.recordset[0].weightage) || 1;
        totalWeightedScore += parseFloat(score.score) * weightage;
        totalWeightage += weightage;
      }

      const overallRating =
        totalWeightage > 0 ? totalWeightedScore / totalWeightage : 0;

      // Create evaluation
      const evalResult = await pool
        .request()
        .input("employee_id", parseInt(employee_id))
        .input("project_id", project_id ? parseInt(project_id) : null)
        .input("evaluation_period", evaluation_period)
        .input("evaluation_date", evaluation_date)
        .input("evaluated_by", userId)
        .input("overall_rating", overallRating.toFixed(2))
        .input("comments", req.body.comments || null).query(`
          INSERT INTO EP01_performance_evaluation 
          (employee_id, project_id, evaluation_period, evaluation_date, evaluated_by, overall_rating, comments)
          OUTPUT INSERTED.evaluation_id, INSERTED.created_at
          VALUES (@employee_id, @project_id, @evaluation_period, @evaluation_date, @evaluated_by, @overall_rating, @comments)
        `);

      const evaluationId = evalResult.recordset[0].evaluation_id;

      // Insert criteria scores
      for (const score of criteria_scores) {
        await pool
          .request()
          .input("evaluation_id", evaluationId)
          .input("criteria_id", score.criteria_id)
          .input("score", parseFloat(score.score))
          .input("comments", score.comments || null).query(`
            INSERT INTO EP03_evaluation_scores 
            (evaluation_id, criteria_id, score, comments)
            VALUES (@evaluation_id, @criteria_id, @score, @comments)
          `);
      }

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: "Performance evaluation created successfully",
        data: {
          evaluation_id: evaluationId,
          overall_rating: overallRating,
          created_at: evalResult.recordset[0].created_at,
        },
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Create performance evaluation error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get all performance evaluations
   * @route   GET /api/performance/evaluations
   * @access  Private
   */
  getAllPerformanceEvaluations: async (req, res) => {
    try {
      const { employee_id, project_id, evaluation_period } = req.query;
      const pool = await getConnection();
      let request = pool.request();
      let whereConditions = [];

      let query = `
        SELECT 
          e.*,
          emp.first_name + ' ' + ISNULL(emp.last_name, '') as employee_name,
          emp.employee_code,
          evaluator.first_name + ' ' + ISNULL(evaluator.last_name, '') as evaluated_by_name,
          p.project_name
        FROM EP01_performance_evaluation e
        INNER JOIN E01_employee_master emp ON e.employee_id = emp.employee_id
        INNER JOIN E01_employee_master evaluator ON e.evaluated_by = evaluator.employee_id
        LEFT JOIN M25_project_master p ON e.project_id = p.project_id
      `;

      if (employee_id) {
        whereConditions.push("e.employee_id = @employee_id");
        request.input("employee_id", parseInt(employee_id));
      }

      if (project_id) {
        whereConditions.push("e.project_id = @project_id");
        request.input("project_id", parseInt(project_id));
      }

      if (evaluation_period) {
        whereConditions.push("e.evaluation_period = @evaluation_period");
        request.input("evaluation_period", evaluation_period);
      }

      if (whereConditions.length > 0) {
        query += " WHERE " + whereConditions.join(" AND ");
      }

      query += " ORDER BY e.evaluation_date DESC, e.created_at DESC";

      const result = await request.query(query);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get performance evaluations error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get performance evaluation by ID
   * @route   GET /api/performance/evaluations/:id
   * @access  Private
   */
  getPerformanceEvaluationById: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getConnection();

      const evalResult = await pool
        .request()
        .input("evaluation_id", parseInt(id)).query(`
          SELECT 
            e.*,
            emp.first_name + ' ' + ISNULL(emp.last_name, '') as employee_name,
            emp.employee_code,
            evaluator.first_name + ' ' + ISNULL(evaluator.last_name, '') as evaluated_by_name,
            p.project_name
          FROM EP01_performance_evaluation e
          INNER JOIN E01_employee_master emp ON e.employee_id = emp.employee_id
          INNER JOIN E01_employee_master evaluator ON e.evaluated_by = evaluator.employee_id
          LEFT JOIN M25_project_master p ON e.project_id = p.project_id
          WHERE e.evaluation_id = @evaluation_id
        `);

      if (evalResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Performance evaluation not found",
        });
      }

      // Get evaluation scores
      const scoresResult = await pool
        .request()
        .input("evaluation_id", parseInt(id)).query(`
          SELECT es.*, pc.criteria_name, pc.max_score, pc.weightage
          FROM EP03_evaluation_scores es
          INNER JOIN EP02_performance_criteria pc ON es.criteria_id = pc.criteria_id
          WHERE es.evaluation_id = @evaluation_id
        `);

      res.json({
        success: true,
        data: {
          ...evalResult.recordset[0],
          scores: scoresResult.recordset,
        },
      });
    } catch (error) {
      console.error("Get performance evaluation error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Update performance evaluation
   * @route   PUT /api/performance/evaluations/:id
   * @access  Private (Manager/Admin)
   */
  updatePerformanceEvaluation: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const pool = await getConnection();

      // Check if evaluation exists
      const existingEval = await pool
        .request()
        .input("evaluation_id", parseInt(id))
        .query(
          "SELECT evaluation_id FROM EP01_performance_evaluation WHERE evaluation_id = @evaluation_id"
        );

      if (existingEval.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Performance evaluation not found",
        });
      }

      // Build dynamic update
      const updateFields = [];
      const request = pool.request();
      request.input("evaluation_id", parseInt(id));

      const allowedFields = ["comments", "status"];
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

      await request.query(
        `UPDATE EP01_performance_evaluation SET ${updateFields.join(
          ", "
        )} WHERE evaluation_id = @evaluation_id`
      );

      res.json({
        success: true,
        message: "Performance evaluation updated successfully",
      });
    } catch (error) {
      console.error("Update performance evaluation error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Delete performance evaluation
   * @route   DELETE /api/performance/evaluations/:id
   * @access  Private (Admin)
   */
  deletePerformanceEvaluation: async (req, res) => {
    let transaction;
    try {
      const { id } = req.params;
      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check if evaluation exists
      const existingEval = await pool
        .request()
        .input("evaluation_id", parseInt(id))
        .query(
          "SELECT evaluation_id FROM EP01_performance_evaluation WHERE evaluation_id = @evaluation_id"
        );

      if (existingEval.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Performance evaluation not found",
        });
      }

      // Delete scores first
      await pool
        .request()
        .input("evaluation_id", parseInt(id))
        .query(
          "DELETE FROM EP03_evaluation_scores WHERE evaluation_id = @evaluation_id"
        );

      // Delete evaluation
      await pool
        .request()
        .input("evaluation_id", parseInt(id))
        .query(
          "DELETE FROM EP01_performance_evaluation WHERE evaluation_id = @evaluation_id"
        );

      await transaction.commit();

      res.json({
        success: false,
        message: "Performance evaluation deleted successfully",
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Delete performance evaluation error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Calculate employee KPI
   * @route   GET /api/performance/kpi/:employeeId
   * @access  Private
   */
  calculateEmployeeKPI: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { period } = req.query; // Format: YYYY-MM

      const pool = await getConnection();

      const kpiQuery = `
        SELECT 
          @employeeId as employee_id,
          @period as kpi_period,
          COUNT(t.task_id) as tasks_assigned,
          SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as tasks_completed,
          CASE 
            WHEN COUNT(t.task_id) > 0 THEN 
              (SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(t.task_id))
            ELSE 0 
          END as completion_rate,
          AVG(t.actual_hours) as avg_hours_per_task,
          SUM(t.actual_hours) as total_hours_utilized,
          AVG(DATEDIFF(day, t.start_date, t.due_date)) as avg_days_per_task
        FROM T01_task_master_heirarchical t
        WHERE t.assigned_to = @employeeId
          AND t.status != 'Deleted'
          AND (@period IS NULL OR FORMAT(t.created_at, 'yyyy-MM') = @period)
      `;

      const result = await pool
        .request()
        .input("employeeId", parseInt(employeeId))
        .input("period", period || null)
        .query(kpiQuery);

      // Save KPI to database
      if (result.recordset.length > 0) {
        const kpiData = result.recordset[0];
        await pool
          .request()
          .input("employee_id", parseInt(employeeId))
          .input("kpi_period", period || new Date().toISOString().slice(0, 7))
          .input("tasks_completed", kpiData.tasks_completed)
          .input("tasks_assigned", kpiData.tasks_assigned)
          .input("on_time_completion_rate", kpiData.completion_rate)
          .input("hours_utilized", kpiData.total_hours_utilized).query(`
            INSERT INTO EP04_employee_kpi 
            (employee_id, kpi_period, tasks_completed, tasks_assigned, on_time_completion_rate, hours_utilized)
            VALUES (@employee_id, @kpi_period, @tasks_completed, @tasks_assigned, @on_time_completion_rate, @hours_utilized)
          `);
      }

      res.json({
        success: true,
        data: result.recordset[0] || {},
      });
    } catch (error) {
      console.error("Calculate KPI error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get performance criteria
   * @route   GET /api/performance/criteria
   * @access  Private
   */
  getPerformanceCriteria: async (req, res) => {
    try {
      const { status } = req.query;
      const pool = await getConnection();
      let request = pool.request();

      let query = "SELECT * FROM EP02_performance_criteria";

      if (status !== undefined) {
        query += " WHERE status = @status";
        request.input("status", parseInt(status));
      }

      query += " ORDER BY criteria_name";

      const result = await request.query(query);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get performance criteria error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = performanceController;
