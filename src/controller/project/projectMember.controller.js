const { getConnection, sql } = require("../../config/database.js");
const { getUserId } = require("../../utils/UserInfo.js");

const projectMemberController = {
  /**
   * @desc    Add members to project
   * @route   POST /api/projects/:projectId/members
   * @access  Private (Project Manager/Admin)
   */
  addProjectMembers: async (req, res) => {
    let transaction;
    try {
      const { projectId } = req.params;
      const { members } = req.body;
      const userId = getUserId();

      if (!members || !Array.isArray(members)) {
        return res.status(400).json({
          success: false,
          message: "Members array is required",
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

      const results = [];
      const errors = [];

      for (const member of members) {
        try {
          // Check employee exists
          const employeeCheck = await pool
            .request()
            .input("employee_id", member.employee_id)
            .query(
              "SELECT employee_id FROM E01_employee_master WHERE employee_id = @employee_id AND status = 1"
            );

          if (employeeCheck.recordset.length === 0) {
            errors.push(
              `Employee ID ${member.employee_id} not found or inactive`
            );
            continue;
          }

          // Check designation exists
          const designationCheck = await pool
            .request()
            .input("designation_id", member.designation_id)
            .query(
              "SELECT designation_id FROM M03_designation_master WHERE designation_id = @designation_id AND status = 1"
            );

          if (designationCheck.recordset.length === 0) {
            errors.push(`Designation ID ${member.designation_id} not found`);
            continue;
          }

          // Check if already member
          const existingMember = await pool
            .request()
            .input("project_id", parseInt(projectId))
            .input("employee_id", member.employee_id)
            .query(
              "SELECT member_id FROM M26_project_members_heirarchical WHERE project_id = @project_id AND employee_id = @employee_id AND status = 1"
            );

          if (existingMember.recordset.length > 0) {
            errors.push(
              `Employee ID ${member.employee_id} is already a member`
            );
            continue;
          }

          const result = await pool
            .request()
            .input("project_id", parseInt(projectId))
            .input("employee_id", member.employee_id)
            .input("designation_id", member.designation_id)
            .input("role_in_project", member.role_in_project || null)
            .input("hourly_rate", member.hourly_rate || null)
            .input("created_by", userId).query(`
              INSERT INTO M26_project_members_heirarchical 
              (project_id, employee_id, designation_id, role_in_project, hourly_rate, created_by)
              OUTPUT INSERTED.member_id, INSERTED.assigned_date
              VALUES (@project_id, @employee_id, @designation_id, @role_in_project, @hourly_rate, @created_by)
            `);

          results.push(result.recordset[0]);
        } catch (error) {
          errors.push(
            `Error adding employee ${member.employee_id}: ${error.message}`
          );
        }
      }

      if (results.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Failed to add any members",
          errors: errors,
        });
      }

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: `Added ${results.length} member(s) successfully`,
        data: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Add project members error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get all project members
   * @route   GET /api/projects/:projectId/members
   * @access  Private
   */
  getProjectMembers: async (req, res) => {
    try {
      const { projectId } = req.params;
      const { status } = req.query;

      const pool = await getConnection();
      let request = pool.request();
      request.input("project_id", parseInt(projectId));

      let query = `
        SELECT 
          pm.*,
          emp.first_name + ' ' + ISNULL(emp.last_name, '') as employee_name,
          emp.employee_code,
          des.designation_name,
          des.designation_code
        FROM M26_project_members_heirarchical pm
        INNER JOIN E01_employee_master emp ON pm.employee_id = emp.employee_id
        INNER JOIN M03_designation_master des ON pm.designation_id = des.designation_id
        WHERE pm.project_id = @project_id
      `;

      if (status !== undefined) {
        query += " AND pm.status = @status";
        request.input("status", parseInt(status));
      }

      query += " ORDER BY pm.assigned_date DESC";

      const result = await request.query(query);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get project members error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get project member by ID
   * @route   GET /api/projects/:projectId/members/:memberId
   * @access  Private
   */
  getProjectMemberById: async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const pool = await getConnection();

      const result = await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("member_id", parseInt(memberId)).query(`
          SELECT 
            pm.*,
            emp.first_name + ' ' + ISNULL(emp.last_name, '') as employee_name,
            emp.employee_code,
            des.designation_name,
            des.designation_code
          FROM M26_project_members_heirarchical pm
          INNER JOIN E01_employee_master emp ON pm.employee_id = emp.employee_id
          INNER JOIN M03_designation_master des ON pm.designation_id = des.designation_id
          WHERE pm.project_id = @project_id AND pm.member_id = @member_id
        `);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Project member not found",
        });
      }

      res.json({
        success: true,
        data: result.recordset[0],
      });
    } catch (error) {
      console.error("Get project member error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Update project member
   * @route   PUT /api/projects/:projectId/members/:memberId
   * @access  Private (Project Manager/Admin)
   */
  updateProjectMember: async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const updates = req.body;

      const pool = await getConnection();

      // Check if member exists
      const existingMember = await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("member_id", parseInt(memberId))
        .query(
          "SELECT member_id FROM M26_project_members_heirarchical WHERE project_id = @project_id AND member_id = @member_id"
        );

      if (existingMember.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Project member not found",
        });
      }

      // Build dynamic update
      const updateFields = [];
      const request = pool.request();
      request.input("project_id", parseInt(projectId));
      request.input("member_id", parseInt(memberId));
      request.input("updated_by", req.user.employee_id);

      const allowedFields = [
        "designation_id",
        "role_in_project",
        "hourly_rate",
        "released_date",
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
      updateFields.push("updated_by = @updated_by");

      await request.query(
        `UPDATE M26_project_members_heirarchical SET ${updateFields.join(
          ", "
        )} WHERE project_id = @project_id AND member_id = @member_id`
      );

      res.json({
        success: true,
        message: "Project member updated successfully",
      });
    } catch (error) {
      console.error("Update project member error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Remove project member
   * @route   DELETE /api/projects/:projectId/members/:memberId
   * @access  Private (Project Manager/Admin)
   */
  removeProjectMember: async (req, res) => {
    try {
      const { projectId, memberId } = req.params;
      const pool = await getConnection();

      // Check if member exists
      const existingMember = await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("member_id", parseInt(memberId))
        .query(
          "SELECT member_id FROM M26_project_members_heirarchical WHERE project_id = @project_id AND member_id = @member_id"
        );

      if (existingMember.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Project member not found",
        });
      }

      // Soft delete
      await pool
        .request()
        .input("project_id", parseInt(projectId))
        .input("member_id", parseInt(memberId))
        .input("updated_by", req.user.employee_id)
        .query(
          "UPDATE M26_project_members_heirarchical SET status = 0, released_date = GETDATE(), updated_at = GETDATE(), updated_by = @updated_by WHERE project_id = @project_id AND member_id = @member_id"
        );

      res.json({
        success: true,
        message: "Project member removed successfully",
      });
    } catch (error) {
      console.error("Remove project member error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = projectMemberController;
