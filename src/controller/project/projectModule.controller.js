const { getConnection, sql } = require("../../config/database.js");

const projectModuleController = {
  /**
   * @desc    Create a project module
   * @route   POST /api/projects/:projectId/modules
   * @access  Private (Project Manager/Admin)
   */
  createProjectModule: async (req, res) => {
    let transaction;
    try {
      const { projectId } = req.params;
      const {
        module_name,
        module_code,
        description,
        start_date,
        end_date,
        module_budget,
        parent_module_id,
        module_sequence,
      } = req.body;

      if (!module_name || !module_code) {
        return res.status(400).json({
          success: false,
          message: "Module name and code are required",
        });
      }

      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Verify project exists
      const projectCheck = await pool
        .request()
        .input("project_id", parseInt(projectId))
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

      // Check if module code is unique within project
      const existingModule = await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("module_code", module_code)
        .query(
          "SELECT module_id FROM M28_project_modules WHERE project_id = @project_id AND module_code = @module_code"
        );

      if (existingModule.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Module code already exists in this project",
        });
      }

      // Check parent module if provided
      if (parent_module_id) {
        const parentCheck = await pool
          .request()
          .input("parent_module_id", parseInt(parent_module_id))
          .input("project_id", parseInt(projectId))
          .query(
            "SELECT module_id FROM M28_project_modules WHERE module_id = @parent_module_id AND project_id = @project_id"
          );

        if (parentCheck.recordset.length === 0) {
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: "Parent module not found in this project",
          });
        }
      }

      // Determine module sequence if not provided
      let finalSequence = module_sequence;
      if (!module_sequence) {
        const sequenceQuery = parent_module_id
          ? "SELECT ISNULL(MAX(module_sequence), 0) + 1 as next_sequence FROM M28_project_modules WHERE project_id = @project_id AND parent_module_id = @parent_module_id"
          : "SELECT ISNULL(MAX(module_sequence), 0) + 1 as next_sequence FROM M28_project_modules WHERE project_id = @project_id AND parent_module_id IS NULL";

        const sequenceResult = await pool
          .request()
          .input("project_id", parseInt(projectId))
          .input(
            "parent_module_id",
            parent_module_id ? parseInt(parent_module_id) : null
          )
          .query(sequenceQuery);

        finalSequence = sequenceResult.recordset[0].next_sequence;
      }

      // Create module
      const moduleResult = await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("module_name", module_name)
        .input("module_code", module_code)
        .input("description", description || null)
        .input("start_date", start_date || null)
        .input("end_date", end_date || null)
        .input("module_budget", module_budget || 0)
        .input(
          "parent_module_id",
          parent_module_id ? parseInt(parent_module_id) : null
        )
        .input("module_sequence", finalSequence).query(`
          INSERT INTO M28_project_modules 
          (project_id, module_name, module_code, description, start_date, end_date, module_budget, parent_module_id, module_sequence)
          OUTPUT INSERTED.module_id, INSERTED.module_code, INSERTED.created_at
          VALUES (@project_id, @module_name, @module_code, @description, @start_date, @end_date, @module_budget, @parent_module_id, @module_sequence)
        `);

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: "Project module created successfully",
        data: moduleResult.recordset[0],
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Create project module error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get all modules for a project
   * @route   GET /api/projects/:projectId/modules
   * @access  Private
   */
  getProjectModules: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { status, include_submodules } = req.query;

      const pool = await getConnection();
      let request = pool.request();
      request.input("project_id", parseInt(projectId));

      let query = `
        SELECT 
          m.*,
          parent.module_name as parent_module_name,
          parent.module_code as parent_module_code,
          COUNT(DISTINCT t.task_id) as task_count,
          SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(t.actual_hours) as total_hours_spent
        FROM M28_project_modules m
        LEFT JOIN M28_project_modules parent ON m.parent_module_id = parent.module_id
        LEFT JOIN T01_task_master_heirarchical t ON m.module_id = t.module_id AND t.status != 'Deleted'
        WHERE m.project_id = @project_id
      `;

      if (status !== undefined) {
        query += " AND m.status = @status";
        request.input("status", parseInt(status));
      }

      query +=
        " GROUP BY m.module_id, m.project_id, m.module_name, m.module_code, m.description, " +
        "m.start_date, m.end_date, m.status, m.module_budget, m.parent_module_id, " +
        "m.module_sequence, m.created_at, m.updated_at, parent.module_name, parent.module_code " +
        "ORDER BY m.module_sequence, m.created_at";

      const result = await request.query(query);

      let modules = result.recordset;
      if (include_submodules === "true") {
        modules = buildModuleHierarchy(result.recordset);
      }

      res.json({
        success: true,
        data: modules,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get project modules error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get module by ID
   * @route   GET /api/projects/:projectId/modules/:moduleId
   * @access  Private
   */
  getProjectModuleById: async (req, res) => {
    try {
      const { projectId, moduleId } = req.params;
      const pool = await getConnection();

      const moduleResult = await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("module_id", parseInt(moduleId)).query(`
          SELECT 
            m.*,
            parent.module_name as parent_module_name,
            parent.module_code as parent_module_code,
            p.project_name,
            p.project_code
          FROM M28_project_modules m
          INNER JOIN M25_project_master p ON m.project_id = p.project_id
          LEFT JOIN M28_project_modules parent ON m.parent_module_id = parent.module_id
          WHERE m.project_id = @project_id AND m.module_id = @module_id
        `);

      if (moduleResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Project module not found",
        });
      }

      // Get submodules
      const submodulesResult = await pool
        .request()
        .input("parent_module_id", parseInt(moduleId)).query(`
          SELECT * FROM M28_project_modules 
          WHERE parent_module_id = @parent_module_id 
          ORDER BY module_sequence
        `);

      // Get tasks in this module
      const tasksResult = await pool
        .request()
        .input("module_id", parseInt(moduleId)).query(`
          SELECT 
            t.*,
            emp.first_name + ' ' + ISNULL(emp.last_name, '') as assigned_to_name
          FROM T01_task_master_heirarchical t
          INNER JOIN E01_employee_master emp ON t.assigned_to = emp.employee_id
          WHERE t.module_id = @module_id AND t.status != 'Deleted'
          ORDER BY t.task_sequence
        `);

      // Calculate module progress and budget utilization
      const statsResult = await pool
        .request()
        .input("module_id", parseInt(moduleId)).query(`
          SELECT 
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(estimated_hours) as total_estimated_hours,
            SUM(actual_hours) as total_actual_hours,
            AVG(completion_percentage) as avg_completion
          FROM T01_task_master_heirarchical 
          WHERE module_id = @module_id AND status != 'Deleted'
        `);

      res.json({
        success: true,
        data: {
          ...moduleResult.recordset[0],
          submodules: submodulesResult.recordset,
          tasks: tasksResult.recordset,
          statistics: statsResult.recordset[0] || {},
        },
      });
    } catch (error) {
      console.error("Get project module error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Update project module
   * @route   PUT /api/projects/:projectId/modules/:moduleId
   * @access  Private (Project Manager/Admin)
   */
  updateProjectModule: async (req, res) => {
    try {
      const { projectId, moduleId } = req.params;
      const updates = req.body;

      const pool = await getConnection();

      // Check if module exists
      const existingModule = await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("module_id", parseInt(moduleId))
        .query(
          "SELECT module_id FROM M28_project_modules WHERE project_id = @project_id AND module_id = @module_id"
        );

      if (existingModule.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Project module not found",
        });
      }

      // Build dynamic update
      const updateFields = [];
      const request = pool.request();
      request.input("project_id", parseInt(projectId));
      request.input("module_id", parseInt(moduleId));

      const allowedFields = [
        "module_name",
        "description",
        "start_date",
        "end_date",
        "module_budget",
        "parent_module_id",
        "module_sequence",
        "status",
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

      await request.query(
        `UPDATE M28_project_modules SET ${updateFields.join(
          ", "
        )} WHERE project_id = @project_id AND module_id = @module_id`
      );

      res.json({
        success: true,
        message: "Project module updated successfully",
      });
    } catch (error) {
      console.error("Update project module error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Delete project module
   * @route   DELETE /api/projects/:projectId/modules/:moduleId
   * @access  Private (Project Manager/Admin)
   */
  deleteProjectModule: async (req, res) => {
    let transaction;
    try {
      const { projectId, moduleId } = req.params;
      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check if module exists
      const existingModule = await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("module_id", parseInt(moduleId))
        .query(
          "SELECT module_id FROM M28_project_modules WHERE project_id = @project_id AND module_id = @module_id"
        );

      if (existingModule.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Project module not found",
        });
      }

      // Check if module has submodules
      const submodulesCheck = await pool
        .request()
        .input("parent_module_id", parseInt(moduleId))
        .query(
          "SELECT COUNT(*) as submodule_count FROM M28_project_modules WHERE parent_module_id = @parent_module_id"
        );

      if (submodulesCheck.recordset[0].submodule_count > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete module that has submodules. Please delete submodules first.",
        });
      }

      // Check if module has tasks
      const tasksCheck = await pool
        .request()
        .input("module_id", parseInt(moduleId))
        .query(
          "SELECT COUNT(*) as task_count FROM T01_task_master_heirarchical WHERE module_id = @module_id AND status != 'Deleted'"
        );

      if (tasksCheck.recordset[0].task_count > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete module that has tasks. Please reassign or delete tasks first.",
        });
      }

      // Delete module
      await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("module_id", parseInt(moduleId))
        .query(
          "DELETE FROM M28_project_modules WHERE project_id = @project_id AND module_id = @module_id"
        );

      await transaction.commit();

      res.json({
        success: true,
        message: "Project module deleted successfully",
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Delete project module error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get module statistics and progress
   * @route   GET /api/projects/:projectId/modules/:moduleId/statistics
   * @access  Private
   */
  getModuleStatistics: async (req, res) => {
    try {
      const { projectId, moduleId } = req.params;
      const pool = await getConnection();

      // Module basic info
      const moduleInfo = await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("module_id", parseInt(moduleId)).query(`
          SELECT 
            m.module_name,
            m.module_code,
            m.module_budget,
            m.start_date,
            m.end_date,
            DATEDIFF(day, m.start_date, m.end_date) as total_days,
            DATEDIFF(day, m.start_date, GETDATE()) as days_elapsed
          FROM M28_project_modules m
          WHERE m.project_id = @project_id AND m.module_id = @module_id
        `);

      if (moduleInfo.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Project module not found",
        });
      }

      // Task statistics
      const taskStats = await pool
        .request()
        .input("module_id", parseInt(moduleId)).query(`
          SELECT 
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tasks,
            SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_tasks,
            SUM(estimated_hours) as total_estimated_hours,
            SUM(actual_hours) as total_actual_hours,
            AVG(completion_percentage) as avg_completion_percentage,
            SUM(CASE WHEN due_date < GETDATE() AND status != 'Completed' THEN 1 ELSE 0 END) as overdue_tasks
          FROM T01_task_master_heirarchical 
          WHERE module_id = @module_id AND status != 'Deleted'
        `);

      // Budget utilization
      const budgetStats = await pool
        .request()
        .input("module_id", parseInt(moduleId)).query(`
          SELECT 
            SUM(tb.allocated_cost) as total_allocated_cost,
            SUM(tb.actual_cost) as total_actual_cost,
            SUM(tb.allocated_hours) as total_allocated_hours,
            SUM(tb.actual_hours) as total_actual_hours
          FROM T09_task_budget tb
          INNER JOIN T01_task_master_heirarchical t ON tb.task_id = t.task_id
          WHERE t.module_id = @module_id AND t.status != 'Deleted'
        `);

      // Team member contributions
      const teamStats = await pool
        .request()
        .input("module_id", parseInt(moduleId)).query(`
          SELECT 
            t.assigned_to,
            emp.first_name + ' ' + ISNULL(emp.last_name, '') as employee_name,
            COUNT(t.task_id) as tasks_assigned,
            SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as tasks_completed,
            SUM(t.actual_hours) as hours_worked
          FROM T01_task_master_heirarchical t
          INNER JOIN E01_employee_master emp ON t.assigned_to = emp.employee_id
          WHERE t.module_id = @module_id AND t.status != 'Deleted'
          GROUP BY t.assigned_to, emp.first_name, emp.last_name
          ORDER BY hours_worked DESC
        `);

      res.json({
        success: true,
        data: {
          module_info: moduleInfo.recordset[0],
          task_statistics: taskStats.recordset[0] || {},
          budget_utilization: budgetStats.recordset[0] || {},
          team_contributions: teamStats.recordset,
        },
      });
    } catch (error) {
      console.error("Get module statistics error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

// Helper function to build module hierarchy
function buildModuleHierarchy(modules) {
  const moduleMap = new Map();
  const rootModules = [];

  modules.forEach((module) => {
    module.submodules = [];
    moduleMap.set(module.module_id, module);
  });

  modules.forEach((module) => {
    if (module.parent_module_id && moduleMap.has(module.parent_module_id)) {
      moduleMap.get(module.parent_module_id).submodules.push(module);
    } else {
      rootModules.push(module);
    }
  });

  return rootModules;
}

module.exports = projectModuleController;
