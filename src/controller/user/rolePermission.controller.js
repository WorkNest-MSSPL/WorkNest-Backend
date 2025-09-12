const { getConnection, sql } = require("../../config/database.js");

const rolePermissionController = {
  // Get all role permissions
  getRolePermissions: async (req, res) => {
    try {
      const pool = await getConnection();

      // Get all roles first
      const rolesResult = await pool.query(`
        SELECT role_id, role_name, status 
        FROM M13_role_master 
        ORDER BY role_name
      `);

      const roles = rolesResult.recordset;
      const result = [];

      for (const role of roles) {
        // Get permissions for each role
        const permissionsResult = await pool
          .request()
          .input("roleId", role.role_id).query(`
            SELECT 
              rp.role_permission_id,
              rp.menu_id,
              mm.menu_code,
              mm.menu_name,
              mm.parent_menu_id,
              mm.url,
              mm.icon,
              rp.is_view,
              rp.is_add,
              rp.is_update,
              rp.is_delete,
              rp.is_print,
              rp.is_import,
              rp.is_export,
              rp.is_post,
              rp.is_release,
              rp.status,
              rp.created_at,
              rp.updated_at
            FROM auth_role_permissions rp
            INNER JOIN M14_menu_master mm ON rp.menu_id = mm.menu_id
            WHERE rp.role_id = @roleId
            ORDER BY mm.menu_name
          `);

        result.push({
          role_id: role.role_id,
          role_name: role.role_name,
          role_status: role.status,
          permissions: permissionsResult.recordset,
        });
      }

      res.json({
        success: true,
        rolePermissions: result,
      });
    } catch (error) {
      console.error("Get role permissions error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get role permissions by role ID with improved response format
  getRolePermissionsByRoleId: async (req, res) => {
    try {
      const { roleId } = req.params;
      const pool = await getConnection();

      // Get role details
      const roleResult = await pool.request().input("roleId", roleId).query(`
          SELECT role_id, role_name, status 
          FROM M13_role_master 
          WHERE role_id = @roleId
        `);

      if (roleResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Role not found",
        });
      }

      const role = roleResult.recordset[0];

      // Get permissions for the role
      const permissionsResult = await pool.request().input("roleId", roleId)
        .query(`
          SELECT 
            rp.role_permission_id,
            rp.menu_id,
            mm.menu_code,
            mm.menu_name,
            mm.parent_menu_id,
            mm.url,
            mm.icon,
            rp.is_view,
            rp.is_add,
            rp.is_update,
            rp.is_delete,
            rp.is_print,
            rp.is_import,
            rp.is_export,
            rp.is_post,
            rp.is_release,
            rp.status,
            rp.created_at,
            rp.updated_at
          FROM auth_role_permissions rp
          INNER JOIN M14_menu_master mm ON rp.menu_id = mm.menu_id
          WHERE rp.role_id = @roleId
          ORDER BY mm.menu_name
        `);

      res.json({
        success: true,
        role: {
          role_id: role.role_id,
          role_name: role.role_name,
          role_status: role.status,
        },
        permissions: permissionsResult.recordset,
      });
    } catch (error) {
      console.error("Get role permissions by role ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Create or update role permissions
  setRolePermissions: async (req, res) => {
    try {
      const { roleId, permissions } = req.body;

      if (!roleId || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          message: "Role ID and permissions array are required",
        });
      }

      const pool = await getConnection();

      // Start transaction
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // First, disable all existing permissions for this role
        await transaction.request().input("roleId", roleId).query(`
                        UPDATE auth_role_permissions 
                        SET status = 0, updated_at = GETDATE()
                        WHERE role_id = @roleId
                    `);

        // Insert or update new permissions
        for (const permission of permissions) {
          const {
            menuId,
            isView,
            isAdd,
            isUpdate,
            isDelete,
            isPrint,
            isImport,
            isExport,
            isPost,
            isRelease,
          } = permission;

          // Check if permission already exists
          const existingPermission = await transaction
            .request()
            .input("roleId", roleId)
            .input("menuId", menuId).query(`
                            SELECT role_permission_id 
                            FROM auth_role_permissions 
                            WHERE role_id = @roleId AND menu_id = @menuId
                        `);

          if (existingPermission.recordset.length > 0) {
            // Update existing permission
            await transaction
              .request()
              .input("roleId", roleId)
              .input("menuId", menuId)
              .input("isView", isView || false)
              .input("isAdd", isAdd || false)
              .input("isUpdate", isUpdate || false)
              .input("isDelete", isDelete || false)
              .input("isPrint", isPrint || false)
              .input("isImport", isImport || false)
              .input("isExport", isExport || false)
              .input("isPost", isPost || false)
              .input("isRelease", isRelease || false).query(`
                                UPDATE auth_role_permissions 
                                SET is_view = @isView,
                                    is_add = @isAdd,
                                    is_update = @isUpdate,
                                    is_delete = @isDelete,
                                    is_print = @isPrint,
                                    is_import = @isImport,
                                    is_export = @isExport,
                                    is_post = @isPost,
                                    is_release = @isRelease,
                                    status = 1,
                                    updated_at = GETDATE()
                                WHERE role_id = @roleId AND menu_id = @menuId
                            `);
          } else {
            // Insert new permission
            await transaction
              .request()
              .input("roleId", roleId)
              .input("menuId", menuId)
              .input("isView", isView || false)
              .input("isAdd", isAdd || false)
              .input("isUpdate", isUpdate || false)
              .input("isDelete", isDelete || false)
              .input("isPrint", isPrint || false)
              .input("isImport", isImport || false)
              .input("isExport", isExport || false)
              .input("isPost", isPost || false)
              .input("isRelease", isRelease || false).query(`
                                INSERT INTO auth_role_permissions 
                                (role_id, menu_id, is_view, is_add, is_update, is_delete, is_print, 
                                 is_import, is_export, is_post, is_release, status)
                                VALUES (@roleId, @menuId, @isView, @isAdd, @isUpdate, @isDelete, @isPrint, 
                                        @isImport, @isExport, @isPost, @isRelease, 1)
                            `);
          }
        }

        await transaction.commit();

        res.json({
          success: true,
          message: "Role permissions updated successfully",
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error("Set role permissions error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Delete role permission
  deleteRolePermission: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getConnection();

      const result = await pool.request().input("rolePermissionId", id).query(`
                    DELETE FROM auth_role_permissions 
                    WHERE role_permission_id = @rolePermissionId
                `);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
          success: false,
          message: "Role permission not found",
        });
      }

      res.json({
        success: true,
        message: "Role permission deleted successfully",
      });
    } catch (error) {
      console.error("Delete role permission error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = rolePermissionController;
