const { getConnection, sql } = require("../../config/database.js");

const taskController = {
  /**
   * @desc    Create a task
   * @route   POST /api/tasks
   * @access  Private
   */
  createTask: async (req, res) => {
    let transaction;
    try {
      const {
        task_code,
        title,
        description,
        project_id,
        module_id,
        parent_task_id,
        assigned_to,
        task_type,
        priority,
        start_date,
        due_date,
        estimated_hours,
        is_milestone,
        dependencies,
      } = req.body;

      if (!task_code || !title || !project_id || !assigned_to) {
        return res.status(400).json({
          success: false,
          message: "Task code, title, project ID, and assigned to are required",
        });
      }

      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check task code uniqueness
      const existingTask = await pool
        .request()
        .input("task_code", task_code)
        .input("project_id", parseInt(project_id))
        .query(
          "SELECT task_id FROM T01_task_master_heirarchical WHERE task_code = @task_code AND project_id = @project_id"
        );

      if (existingTask.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Task code already exists in this project",
        });
      }

      // Verify project
      const projectCheck = await pool
        .request()
        .input("project_id", parseInt(project_id))
        .query(
          "SELECT project_id FROM M25_project_master WHERE project_id = @project_id AND status = 1"
        );

      if (projectCheck.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Project not found or inactive",
        });
      }

      if (module_id) {
        const moduleCheck = await pool
          .request()
          .input("module_id", parseInt(module_id))
          .input("project_id", parseInt(project_id))
          .query(
            "SELECT module_id FROM M28_project_modules WHERE module_id = @module_id AND project_id = @project_id"
          );

        if (moduleCheck.recordset.length === 0) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: "Module not found in this project",
          });
        }
      }

      // Verify assignee
      const assigneeCheck = await pool
        .request()
        .input("employee_id", parseInt(assigned_to))
        .query(
          "SELECT employee_id FROM E01_employee_master WHERE employee_id = @employee_id AND status = 'Active'"
        );

      if (assigneeCheck.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Assigned employee not found or inactive",
        });
      }

      // Check parent task
      if (parent_task_id) {
        const parentCheck = await pool
          .request()
          .input("parent_task_id", parseInt(parent_task_id))
          .input("project_id", parseInt(project_id))
          .query(
            "SELECT task_id FROM T01_task_master_heirarchical WHERE task_id = @parent_task_id AND project_id = @project_id"
          );

        if (parentCheck.recordset.length === 0) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: "Parent task not found in this project",
          });
        }
      }

      // Get sequence number
      const sequenceQuery = parent_task_id
        ? "SELECT ISNULL(MAX(task_sequence), 0) + 1 as next_sequence FROM T01_task_master_heirarchical WHERE parent_task_id = @parent_task_id"
        : "SELECT ISNULL(MAX(task_sequence), 0) + 1 as next_sequence FROM T01_task_master_heirarchical WHERE project_id = @project_id AND parent_task_id IS NULL";

      const sequenceResult = await pool
        .request()
        .input("project_id", parseInt(project_id))
        .input(
          "parent_task_id",
          parent_task_id ? parseInt(parent_task_id) : null
        )
        .query(sequenceQuery);

      // Create task
      const taskResult = await pool
        .request()
        .input("task_code", task_code)
        .input("title", title)
        .input("description", description || null)
        .input("project_id", parseInt(project_id))
        .input("module_id", module_id ? parseInt(module_id) : null)
        .input(
          "parent_task_id",
          parent_task_id ? parseInt(parent_task_id) : null
        )
        .input("assigned_by", req.user.employee_id)
        .input("assigned_to", parseInt(assigned_to))
        .input("task_type", task_type || "General")
        .input("priority", priority || "Medium")
        .input("status", "Pending")
        .input("start_date", start_date || null)
        .input("due_date", due_date || null)
        .input("estimated_hours", estimated_hours || null)
        .input("task_sequence", sequenceResult.recordset[0].next_sequence)
        .input("is_milestone", is_milestone || false)
        .input("created_by", req.user.employee_id).query(`
          INSERT INTO T01_task_master_heirarchical 
          (task_code, title, description, project_id, module_id, parent_task_id, 
           assigned_by, assigned_to, task_type, priority, status, start_date, due_date, 
           estimated_hours, task_sequence, is_milestone, created_by)
          OUTPUT INSERTED.task_id, INSERTED.task_code, INSERTED.created_at
          VALUES (@task_code, @title, @description, @project_id, @module_id, @parent_task_id,
                  @assigned_by, @assigned_to, @task_type, @priority, @status, @start_date, @due_date,
                  @estimated_hours, @task_sequence, @is_milestone, @created_by)
        `);

      const taskId = taskResult.recordset[0].task_id;

      // Create dependencies
      if (dependencies && dependencies.length > 0) {
        for (const dependency of dependencies) {
          await pool
            .request()
            .input("task_id", taskId)
            .input(
              "depends_on_task_id",
              parseInt(dependency.depends_on_task_id)
            )
            .input("dependency_type", dependency.dependency_type)
            .input("lag_days", dependency.lag_days || 0).query(`
              INSERT INTO T08_task_dependencies 
              (task_id, depends_on_task_id, dependency_type, lag_days)
              VALUES (@task_id, @depends_on_task_id, @dependency_type, @lag_days)
            `);
        }
      }

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: "Task created successfully",
        data: taskResult.recordset[0],
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Create task error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get all tasks with filters
   * @route   GET /api/tasks
   * @access  Private
   */
  getAllTasks: async (req, res) => {
    try {
      const {
        project_id,
        assigned_to,
        status,
        priority,
        parent_task_id,
        include_subtasks,
      } = req.query;
      const pool = await getConnection();
      let request = pool.request();
      let whereConditions = [];

      let query = `
        SELECT 
          t.*,
          p.project_name,
          p.project_code,
          assigned_by_emp.first_name + ' ' + ISNULL(assigned_by_emp.last_name, '') as assigned_by_name,
          assigned_to_emp.first_name + ' ' + ISNULL(assigned_to_emp.last_name, '') as assigned_to_name,
          parent_task.title as parent_task_title,
          COUNT(subtasks.task_id) as subtask_count,
          SUM(CASE WHEN subtasks.status = 'Completed' THEN 1 ELSE 0 END) as completed_subtasks
        FROM T01_task_master_heirarchical t
        INNER JOIN M25_project_master p ON t.project_id = p.project_id
        INNER JOIN E01_employee_master assigned_by_emp ON t.assigned_by = assigned_by_emp.employee_id
        INNER JOIN E01_employee_master assigned_to_emp ON t.assigned_to = assigned_to_emp.employee_id
        LEFT JOIN T01_task_master_heirarchical parent_task ON t.parent_task_id = parent_task.task_id
        LEFT JOIN T01_task_master_heirarchical subtasks ON t.task_id = subtasks.parent_task_id
      `;

      if (project_id) {
        whereConditions.push("t.project_id = @project_id");
        request.input("project_id", parseInt(project_id));
      }

      if (assigned_to) {
        whereConditions.push("t.assigned_to = @assigned_to");
        request.input("assigned_to", parseInt(assigned_to));
      }

      if (status) {
        whereConditions.push("t.status = @status");
        request.input("status", status);
      }

      if (priority) {
        whereConditions.push("t.priority = @priority");
        request.input("priority", priority);
      }

      if (parent_task_id !== undefined) {
        if (parent_task_id === "null") {
          whereConditions.push("t.parent_task_id IS NULL");
        } else {
          whereConditions.push("t.parent_task_id = @parent_task_id");
          request.input("parent_task_id", parseInt(parent_task_id));
        }
      }

      if (whereConditions.length > 0) {
        query += " WHERE " + whereConditions.join(" AND ");
      }

      query +=
        " GROUP BY t.task_id, t.task_code, t.title, t.description, t.project_id, " +
        "t.module_id, t.parent_task_id, t.assigned_by, t.assigned_to, t.task_type, " +
        "t.priority, t.status, t.start_date, t.due_date, t.estimated_hours, " +
        "t.actual_hours, t.completion_percentage, t.task_sequence, t.is_milestone, " +
        "t.created_at, t.updated_at, p.project_name, p.project_code, " +
        "assigned_by_emp.first_name, assigned_by_emp.last_name, " +
        "assigned_to_emp.first_name, assigned_to_emp.last_name, parent_task.title " +
        "ORDER BY t.task_sequence, t.created_at";

      const result = await request.query(query);

      let tasks = result.recordset;
      if (include_subtasks === "true") {
        tasks = buildTaskHierarchy(result.recordset);
      }

      res.json({
        success: true,
        data: tasks,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get tasks error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get task by ID
   * @route   GET /api/tasks/:id
   * @access  Private
   */
  getTaskById: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getConnection();

      const taskResult = await pool.request().input("task_id", parseInt(id))
        .query(`
          SELECT 
            t.*,
            p.project_name,
            p.project_code,
            assigned_by_emp.first_name + ' ' + ISNULL(assigned_by_emp.last_name, '') as assigned_by_name,
            assigned_to_emp.first_name + ' ' + ISNULL(assigned_to_emp.last_name, '') as assigned_to_name,
            parent_task.title as parent_task_title
          FROM T01_task_master_heirarchical t
          INNER JOIN M25_project_master p ON t.project_id = p.project_id
          INNER JOIN E01_employee_master assigned_by_emp ON t.assigned_by = assigned_by_emp.employee_id
          INNER JOIN E01_employee_master assigned_to_emp ON t.assigned_to = assigned_to_emp.employee_id
          LEFT JOIN T01_task_master_heirarchical parent_task ON t.parent_task_id = parent_task.task_id
          WHERE t.task_id = @task_id
        `);

      if (taskResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Task not found",
        });
      }

      // Get dependencies
      const dependenciesResult = await pool
        .request()
        .input("task_id", parseInt(id)).query(`
          SELECT td.*, dep_task.title as depends_on_task_title
          FROM T08_task_dependencies td
          INNER JOIN T01_task_master_heirarchical dep_task ON td.depends_on_task_id = dep_task.task_id
          WHERE td.task_id = @task_id
        `);

      // Get subtasks
      const subtasksResult = await pool
        .request()
        .input("parent_task_id", parseInt(id))
        .query(
          "SELECT * FROM T01_task_master_heirarchical WHERE parent_task_id = @parent_task_id ORDER BY task_sequence"
        );

      // Get comments
      const commentsResult = await pool.request().input("task_id", parseInt(id))
        .query(`
          SELECT tc.*, emp.first_name + ' ' + ISNULL(emp.last_name, '') as commented_by_name
          FROM T02_task_comments tc
          INNER JOIN E01_employee_master emp ON tc.commented_by = emp.employee_id
          WHERE tc.task_id = @task_id AND tc.status = 1
          ORDER BY tc.commented_at DESC
        `);

      // Get attachments
      const attachmentsResult = await pool
        .request()
        .input("task_id", parseInt(id)).query(`
          SELECT ta.*, emp.first_name + ' ' + ISNULL(emp.last_name, '') as uploaded_by_name
          FROM T03_task_attachments ta
          INNER JOIN E01_employee_master emp ON ta.uploaded_by = emp.employee_id
          WHERE ta.task_id = @task_id AND ta.status = 1
          ORDER BY ta.uploaded_at DESC
        `);

      res.json({
        success: true,
        data: {
          ...taskResult.recordset[0],
          dependencies: dependenciesResult.recordset,
          subtasks: subtasksResult.recordset,
          comments: commentsResult.recordset,
          attachments: attachmentsResult.recordset,
        },
      });
    } catch (error) {
      console.error("Get task by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Update task
   * @route   PUT /api/tasks/:id
   * @access  Private
   */
  updateTask: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const pool = await getConnection();

      // Check if task exists
      const existingTask = await pool
        .request()
        .input("task_id", parseInt(id))
        .query(
          "SELECT task_id FROM T01_task_master_heirarchical WHERE task_id = @task_id"
        );

      if (existingTask.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Task not found",
        });
      }

      // Build dynamic update
      const updateFields = [];
      const request = pool.request();
      request.input("task_id", parseInt(id));
      request.input("updated_by", req.user.employee_id);

      const allowedFields = [
        "title",
        "description",
        "module_id",
        "assigned_to",
        "task_type",
        "priority",
        "status",
        "start_date",
        "due_date",
        "estimated_hours",
        "actual_hours",
        "completion_percentage",
        "is_milestone",
      ];

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
        `UPDATE T01_task_master_heirarchical SET ${updateFields.join(
          ", "
        )} WHERE task_id = @task_id`
      );

      res.json({
        success: true,
        message: "Task updated successfully",
      });
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Delete task
   * @route   DELETE /api/tasks/:id
   * @access  Private
   */
  deleteTask: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getConnection();

      // Check if task exists
      const existingTask = await pool
        .request()
        .input("task_id", parseInt(id))
        .query(
          "SELECT task_id FROM T01_task_master_heirarchical WHERE task_id = @task_id"
        );

      if (existingTask.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Task not found",
        });
      }

      // Check if task has subtasks
      const subtasksCheck = await pool
        .request()
        .input("parent_task_id", parseInt(id))
        .query(
          "SELECT COUNT(*) as subtask_count FROM T01_task_master_heirarchical WHERE parent_task_id = @parent_task_id"
        );

      if (subtasksCheck.recordset[0].subtask_count > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete task that has subtasks. Please delete subtasks first.",
        });
      }

      // Soft delete
      await pool
        .request()
        .input("task_id", parseInt(id))
        .input("updated_by", req.user.employee_id)
        .query(
          "UPDATE T01_task_master_heirarchical SET status = 'Deleted', updated_at = GETDATE(), updated_by = @updated_by WHERE task_id = @task_id"
        );

      res.json({
        success: true,
        message: "Task deleted successfully",
      });
    } catch (error) {
      console.error("Delete task error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

// Helper function to build task hierarchy
function buildTaskHierarchy(tasks) {
  const taskMap = new Map();
  const rootTasks = [];

  tasks.forEach((task) => {
    task.subtasks = [];
    taskMap.set(task.task_id, task);
  });

  tasks.forEach((task) => {
    if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
      taskMap.get(task.parent_task_id).subtasks.push(task);
    } else {
      rootTasks.push(task);
    }
  });

  return rootTasks;
}

module.exports = taskController;
