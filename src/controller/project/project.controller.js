const { getConnection, sql } = require("../../config/database.js");
const { getUserId } = require("../../utils/UserInfo.js");

const projectController = {
  /**
   * @desc    Create a new project with budget allocation
   * @route   POST /api/projects
   * @access  Private (Project Manager/Admin)
   */
  createProject: async (req, res) => {
    let transaction;
    try {
      const {
        project_code,
        project_name,
        description,
        client_name,
        start_date,
        end_date,
        total_budget,
        project_manager_id,
        budget_categories,
      } = req.body;

      const userId = getUserId(req);

      if (!project_code || !project_name || !start_date) {
        return res.status(400).json({
          success: false,
          message: "Project code, name, and start date are required",
        });
      }

      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check if project code exists
      const existingProject = await pool
        .request()
        .input("project_code", project_code)
        .query(
          "SELECT project_id FROM M25_project_master WHERE project_code = @project_code"
        );

      if (existingProject.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Project code already exists",
        });
      }

      // Create project
      const projectResult = await pool
        .request()
        .input("project_code", project_code)
        .input("project_name", project_name)
        .input("description", description || null)
        .input("client_name", client_name || null)
        .input("start_date", start_date)
        .input("end_date", end_date || null)
        .input("total_budget", total_budget || 0)
        .input("allocated_budget", 0)
        .input("project_manager_id", project_manager_id || null)
        .input("created_by", userId).query(`
          INSERT INTO M25_project_master 
          (project_code, project_name, description, client_name, start_date, end_date, 
           total_budget, allocated_budget, project_manager_id, created_by)
          OUTPUT INSERTED.project_id, INSERTED.project_code, INSERTED.created_at
          VALUES (@project_code, @project_name, @description, @client_name, @start_date, @end_date,
                  @total_budget, @allocated_budget, @project_manager_id, @created_by)
        `);

      const projectId = projectResult.recordset[0].project_id;
      let totalAllocated = 0;

      // Create budget categories
      if (budget_categories && budget_categories.length > 0) {
        for (const category of budget_categories) {
          await pool
            .request()
            .input("project_id", projectId)
            .input("budget_category", category.category)
            .input("allocated_amount", category.allocated_amount)
            .input("budget_description", category.description || null)
            .input("fiscal_year", new Date().getFullYear()).query(`
              INSERT INTO M27_project_budget 
              (project_id, budget_category, allocated_amount, spent_amount, budget_description, fiscal_year)
              VALUES (@project_id, @budget_category, @allocated_amount, 0, @budget_description, @fiscal_year)
            `);
          totalAllocated += parseFloat(category.allocated_amount);
        }

        // Update allocated budget
        await pool
          .request()
          .input("project_id", projectId)
          .input("allocated_budget", totalAllocated)
          .query(
            "UPDATE M25_project_master SET allocated_budget = @allocated_budget WHERE project_id = @project_id"
          );
      }

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: "Project created successfully",
        data: projectResult.recordset[0],
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Create project error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  /**
   * @desc    Get all projects with filters
   * @route   GET /api/projects
   * @access  Private
   */
  getAllProjects: async (req, res) => {
    try {
      const {
        status,
        client_name,
        start_date_from,
        start_date_to,
        project_manager_id,
      } = req.query;
      const pool = await getConnection();
      let request = pool.request();
      let whereConditions = [];

      let query = `
        SELECT 
          p.*,
          emp.first_name + ' ' + ISNULL(emp.last_name, '') as project_manager_name,
          COUNT(DISTINCT pm.member_id) as team_size,
          COUNT(DISTINCT t.task_id) as total_tasks
        FROM M25_project_master p
        LEFT JOIN E01_employee_master emp ON p.project_manager_id = emp.employee_id
        LEFT JOIN M26_project_members_heirarchical pm ON p.project_id = pm.project_id AND pm.status = 1
        LEFT JOIN T01_task_master_heirarchical t ON p.project_id = t.project_id
      `;

      if (status !== undefined) {
        whereConditions.push("p.status = @status");
        request.input("status", parseInt(status));
      }

      if (client_name) {
        whereConditions.push("p.client_name LIKE @client_name");
        request.input("client_name", `%${client_name}%`);
      }

      if (start_date_from) {
        whereConditions.push("p.start_date >= @start_date_from");
        request.input("start_date_from", start_date_from);
      }

      if (start_date_to) {
        whereConditions.push("p.start_date <= @start_date_to");
        request.input("start_date_to", start_date_to);
      }

      if (project_manager_id) {
        whereConditions.push("p.project_manager_id = @project_manager_id");
        request.input("project_manager_id", parseInt(project_manager_id));
      }

      if (whereConditions.length > 0) {
        query += " WHERE " + whereConditions.join(" AND ");
      }

      query +=
        " GROUP BY p.project_id, p.project_code, p.project_name, p.description, " +
        "p.client_name, p.start_date, p.end_date, p.status, p.total_budget, " +
        "p.allocated_budget, p.actual_spent, p.created_at, p.updated_at, " +
        "p.created_by, p.updated_by, p.project_manager_id, emp.first_name, emp.last_name " +
        "ORDER BY p.created_at DESC";

      const result = await request.query(query);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get project by ID
   * @route   GET /api/projects/:id
   * @access  Private
   */
  // getProjectById: async (req, res) => {
  //   try {
  //     const { id } = req.params;
  //     const pool = await getConnection();

  //     const projectResult = await pool
  //       .request()
  //       .input("project_id", parseInt(id)).query(`
  //         SELECT
  //           p.*,
  //           emp.first_name + ' ' + ISNULL(emp.last_name, '') as project_manager_name
  //         FROM M25_project_master p
  //         LEFT JOIN E01_employee_master emp ON p.project_manager_id = emp.employee_id
  //         WHERE p.project_id = @project_id
  //       `);

  //     if (projectResult.recordset.length === 0) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "Project not found",
  //       });
  //     }

  //     // Get budget details
  //     const budgetResult = await pool
  //       .request()
  //       .input("project_id", parseInt(id))
  //       .query(
  //         "SELECT * FROM M27_project_budget WHERE project_id = @project_id"
  //       );

  //     // Get modules
  //     const modulesResult = await pool
  //       .request()
  //       .input("project_id", parseInt(id))
  //       .query(
  //         "SELECT * FROM M28_project_modules WHERE project_id = @project_id ORDER BY module_sequence"
  //       );

  //     // Get team members
  //     const teamResult = await pool.request().input("project_id", parseInt(id))
  //       .query(`
  //         SELECT
  //           pm.*,
  //           emp.first_name + ' ' + ISNULL(emp.last_name, '') as employee_name,
  //           des.designation_name
  //         FROM M26_project_members_heirarchical pm
  //         INNER JOIN E01_employee_master emp ON pm.employee_id = emp.employee_id
  //         INNER JOIN M03_designation_master des ON pm.designation_id = des.designation_id
  //         WHERE pm.project_id = @project_id AND pm.status = 1
  //       `);

  //     res.json({
  //       success: true,
  //       data: {
  //         ...projectResult.recordset[0],
  //         budget_categories: budgetResult.recordset,
  //         modules: modulesResult.recordset,
  //         team_members: teamResult.recordset,
  //       },
  //     });
  //   } catch (error) {
  //     console.error("Get project by ID error:", error);
  //     res.status(500).json({
  //       success: false,
  //       message: "Internal server error",
  //     });
  //   }
  // },

  // In projectController.js - update getProjectById function
  getProjectById: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getConnection();

      // Get project basic info
      const projectResult = await pool
        .request()
        .input("project_id", parseInt(id)).query(`
        SELECT 
          p.*,
          emp.first_name + ' ' + ISNULL(emp.last_name, '') as project_manager_name
        FROM M25_project_master p
        LEFT JOIN E01_employee_master emp ON p.project_manager_id = emp.employee_id
        WHERE p.project_id = @project_id
      `);

      if (projectResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Get budget details
      const budgetResult = await pool
        .request()
        .input("project_id", parseInt(id))
        .query(
          "SELECT * FROM M27_project_budget WHERE project_id = @project_id"
        );

      // Get project modules with hierarchy
      const modulesResult = await pool
        .request()
        .input("project_id", parseInt(id)).query(`
        SELECT 
          m.*,
          parent.module_name as parent_module_name,
          COUNT(DISTINCT t.task_id) as task_count
        FROM M28_project_modules m
        LEFT JOIN M28_project_modules parent ON m.parent_module_id = parent.module_id
        LEFT JOIN T01_task_master_heirarchical t ON m.module_id = t.module_id AND t.status != 'Deleted'
        WHERE m.project_id = @project_id
        GROUP BY m.module_id, m.project_id, m.module_name, m.module_code, m.description, 
                 m.start_date, m.end_date, m.status, m.module_budget, m.parent_module_id, 
                 m.module_sequence, m.created_at, m.updated_at, parent.module_name
        ORDER BY m.module_sequence
      `);

      const modules = buildModuleHierarchy(modulesResult.recordset);

      // Get team members
      const teamResult = await pool.request().input("project_id", parseInt(id))
        .query(`
        SELECT 
          pm.*,
          emp.first_name + ' ' + ISNULL(emp.last_name, '') as employee_name,
          des.designation_name
        FROM M26_project_members_heirarchical pm
        INNER JOIN E01_employee_master emp ON pm.employee_id = emp.employee_id
        INNER JOIN M03_designation_master des ON pm.designation_id = des.designation_id
        WHERE pm.project_id = @project_id AND pm.status = 1
      `);

      res.json({
        success: true,
        data: {
          ...projectResult.recordset[0],
          budget_categories: budgetResult.recordset,
          modules: modules,
          team_members: teamResult.recordset,
        },
      });
    } catch (error) {
      console.error("Get project by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Update project
   * @route   PUT /api/projects/:id
   * @access  Private (Project Manager/Admin)
   */
  updateProject: async (req, res) => {
    let transaction;
    try {
      const { id } = req.params;
      const updates = req.body;

      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      const userId = getUserId(req);

      // Check if project exists
      const existingProject = await pool
        .request()
        .input("project_id", parseInt(id))
        .query(
          "SELECT project_id FROM M25_project_master WHERE project_id = @project_id"
        );

      if (existingProject.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Build dynamic update
      const updateFields = [];
      const request = pool.request();
      request.input("project_id", parseInt(id));
      request.input("updated_by", userId);

      const allowedFields = [
        "project_name",
        "description",
        "client_name",
        "start_date",
        "end_date",
        "status",
        "total_budget",
        "allocated_budget",
        "actual_spent",
        "project_manager_id",
      ];

      allowedFields.forEach((field) => {
        if (updates[field] !== undefined) {
          updateFields.push(`${field} = @${field}`);
          request.input(field, updates[field]);
        }
      });

      if (updateFields.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      updateFields.push("updated_at = GETDATE()");
      updateFields.push("updated_by = @updated_by");

      await request.query(
        `UPDATE M25_project_master SET ${updateFields.join(
          ", "
        )} WHERE project_id = @project_id`
      );
      await transaction.commit();

      res.json({
        success: true,
        message: "Project updated successfully",
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Update project error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Delete project
   * @route   DELETE /api/projects/:id
   * @access  Private (Admin)
   */
  deleteProject: async (req, res) => {
    let transaction;
    try {
      const { id } = req.params;
      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check if project exists
      const existingProject = await pool
        .request()
        .input("project_id", parseInt(id))
        .query(
          "SELECT project_id FROM M25_project_master WHERE project_id = @project_id"
        );

      if (existingProject.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      // Soft delete by updating status
      await pool
        .request()
        .input("project_id", parseInt(id))
        .input("updated_by", req.user.employee_id)
        .query(
          "UPDATE M25_project_master SET status = 0, updated_at = GETDATE(), updated_by = @updated_by WHERE project_id = @project_id"
        );

      await transaction.commit();

      res.json({
        success: true,
        message: "Project deleted successfully",
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Delete project error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

// Add this helper function to projectController.js
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

module.exports = projectController;
