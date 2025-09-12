const { getConnection, sql } = require("../../config/database.js");

const userPermissionController = {
  // Get all user permissions
  getUserPermissions: async (req, res) => {
    try {
      const pool = await getConnection();

      // Get all users first
      const usersResult = await pool.query(`
        SELECT 
          uc.user_id, uc.username, uc.email, uc.phone, uc.status as user_status,
          em.employee_id, em.employee_code, em.first_name, em.last_name,
          rm.role_id, rm.role_name
        FROM auth_user_credentials uc
        INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
        INNER JOIN M13_role_master rm ON uc.role_id = rm.role_id
        ORDER BY uc.username
      `);

      const users = usersResult.recordset;
      const result = [];

      for (const user of users) {
        // Get permissions for each user
        const permissionsResult = await pool
          .request()
          .input("userId", user.user_id).query(`
            SELECT 
              up.user_permission_id,
              up.menu_id,
              mm.menu_code,
              mm.menu_name,
              mm.parent_menu_id,
              mm.url,
              mm.icon,
              up.is_view,
              up.is_add,
              up.is_update,
              up.is_delete,
              up.is_print,
              up.is_import,
              up.is_export,
              up.is_post,
              up.is_release,
              up.status,
              up.created_at,
              up.updated_at
            FROM auth_user_permissions up
            INNER JOIN M14_menu_master mm ON up.menu_id = mm.menu_id
            WHERE up.user_id = @userId
            ORDER BY mm.menu_name
          `);

        result.push({
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          user_status: user.user_status,
          employee_id: user.employee_id,
          employee_code: user.employee_code,
          first_name: user.first_name,
          last_name: user.last_name,
          role_id: user.role_id,
          role_name: user.role_name,
          permissions: permissionsResult.recordset,
        });
      }

      res.json({
        success: true,
        userPermissions: result,
      });
    } catch (error) {
      console.error("Get user permissions error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get user permissions by user ID with improved response format
  getUserPermissionsByUserId: async (req, res) => {
    try {
      const { userId } = req.params;
      const pool = await getConnection();

      // Get user details
      const userResult = await pool.request().input("userId", userId).query(`
          SELECT 
            uc.user_id, uc.username, uc.email, uc.phone, uc.status as user_status,
            em.employee_id, em.employee_code, em.first_name, em.last_name,
            rm.role_id, rm.role_name
          FROM auth_user_credentials uc
          INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
          INNER JOIN M13_role_master rm ON uc.role_id = rm.role_id
          WHERE uc.user_id = @userId
        `);

      if (userResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const user = userResult.recordset[0];

      // Get permissions for the user
      const permissionsResult = await pool.request().input("userId", userId)
        .query(`
          SELECT 
            up.user_permission_id,
            up.menu_id,
            mm.menu_code,
            mm.menu_name,
            mm.parent_menu_id,
            mm.url,
            mm.icon,
            up.is_view,
            up.is_add,
            up.is_update,
            up.is_delete,
            up.is_print,
            up.is_import,
            up.is_export,
            up.is_post,
            up.is_release,
            up.status,
            up.created_at,
            up.updated_at
          FROM auth_user_permissions up
          INNER JOIN M14_menu_master mm ON up.menu_id = mm.menu_id
          WHERE up.user_id = @userId
          ORDER BY mm.menu_name
        `);

      res.json({
        success: true,
        user: {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          user_status: user.user_status,
          employee_id: user.employee_id,
          employee_code: user.employee_code,
          first_name: user.first_name,
          last_name: user.last_name,
          role_id: user.role_id,
          role_name: user.role_name,
        },
        permissions: permissionsResult.recordset,
      });
    } catch (error) {
      console.error("Get user permissions by user ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Create or update user permissions
  setUserPermissions: async (req, res) => {
    let transaction;
    try {
      const { userId, permissions } = req.body;

      if (!userId || !permissions || !Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          message: "User ID and permissions array are required",
        });
      }

      const pool = await getConnection();

      // Start transaction
      transaction = await pool.transaction();
      await transaction.begin();

      // First, disable all existing permissions for this user
      await transaction.request().input("userId", sql.Int, userId).query(`
        UPDATE auth_user_permissions 
        SET status = 0, updated_at = GETDATE()
        WHERE user_id = @userId
      `);

      // Insert or update new permissions
      for (const permission of permissions) {
        const {
          menuId,
          isView = false,
          isAdd = false,
          isUpdate = false,
          isDelete = false,
          isPrint = false,
          isImport = false,
          isExport = false,
          isPost = false,
          isRelease = false,
        } = permission;

        // Check if permission already exists
        const checkResult = await transaction
          .request()
          .input("userId", sql.Int, userId)
          .input("menuId", sql.Int, menuId).query(`
          SELECT user_permission_id 
          FROM auth_user_permissions 
          WHERE user_id = @userId AND menu_id = @menuId
        `);

        if (checkResult.recordset.length > 0) {
          // Update existing permission
          await transaction
            .request()
            .input("userId", sql.Int, userId)
            .input("menuId", sql.Int, menuId)
            .input("isView", sql.Bit, isView)
            .input("isAdd", sql.Bit, isAdd)
            .input("isUpdate", sql.Bit, isUpdate)
            .input("isDelete", sql.Bit, isDelete)
            .input("isPrint", sql.Bit, isPrint)
            .input("isImport", sql.Bit, isImport)
            .input("isExport", sql.Bit, isExport)
            .input("isPost", sql.Bit, isPost)
            .input("isRelease", sql.Bit, isRelease).query(`
            UPDATE auth_user_permissions 
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
            WHERE user_id = @userId AND menu_id = @menuId
          `);
        } else {
          // Insert new permission
          await transaction
            .request()
            .input("userId", sql.Int, userId)
            .input("menuId", sql.Int, menuId)
            .input("isView", sql.Bit, isView)
            .input("isAdd", sql.Bit, isAdd)
            .input("isUpdate", sql.Bit, isUpdate)
            .input("isDelete", sql.Bit, isDelete)
            .input("isPrint", sql.Bit, isPrint)
            .input("isImport", sql.Bit, isImport)
            .input("isExport", sql.Bit, isExport)
            .input("isPost", sql.Bit, isPost)
            .input("isRelease", sql.Bit, isRelease).query(`
            INSERT INTO auth_user_permissions 
            (user_id, menu_id, is_view, is_add, is_update, is_delete, is_print, 
             is_import, is_export, is_post, is_release, status, created_at)
            VALUES (@userId, @menuId, @isView, @isAdd, @isUpdate, @isDelete, @isPrint, 
                    @isImport, @isExport, @isPost, @isRelease, 1, GETDATE())
          `);
        }
      }

      await transaction.commit();

      res.json({
        success: true,
        message: "User permissions updated successfully",
      });
    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error("Transaction rollback error:", rollbackError);
        }
      }
      console.error("Set user permissions error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  // Delete user permission
  deleteUserPermission: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getConnection();

      const result = await pool.request().input("userPermissionId", sql.Int, id)
        .query(`
          DELETE FROM auth_user_permissions 
          WHERE user_permission_id = @userPermissionId
        `);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
          success: false,
          message: "User permission not found",
        });
      }

      res.json({
        success: true,
        message: "User permission deleted successfully",
      });
    } catch (error) {
      console.error("Delete user permission error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
};

module.exports = userPermissionController;
