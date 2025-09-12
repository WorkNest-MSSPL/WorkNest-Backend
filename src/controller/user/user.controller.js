const bcrypt = require("bcryptjs");
const { getConnection, sql } = require("../../config/database.js");

const userController = {
  // Create user
  createUser: async (req, res) => {
    let transaction;
    try {
      const { employeeId, username, password, roleId } = req.body;

      if (!employeeId || !username || !password || !roleId) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }

      const pool = await getConnection();

      // Start transaction
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check if employee exists and is active
      const employeeResult = await pool
        .request()
        .input("employeeId", employeeId)
        .query(
          "SELECT * FROM E01_employee_master WHERE employee_id = @employeeId AND status = 1"
        );

      if (employeeResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Employee not found or inactive",
        });
      }

      // Check if username already exists
      const usernameCheck = await pool
        .request()
        .input("username", username)
        .query(
          "SELECT user_id FROM auth_user_credentials WHERE username = @username"
        );

      if (usernameCheck.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Username already exists",
        });
      }

      // Get employee email and phone from contact table
      const contactResult = await pool
        .request()
        .input("employeeId", employeeId)
        .query(
          "SELECT email, phone FROM E02_employee_contact WHERE employee_id = @employeeId"
        );

      if (contactResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Employee contact details not found",
        });
      }

      const { email, phone } = contactResult.recordset[0];

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const userResult = await pool
        .request()
        .input("employeeId", employeeId)
        .input("username", username)
        .input("passwordHash", passwordHash)
        .input("email", email)
        .input("phone", phone)
        .input("roleId", roleId).query(`
          INSERT INTO auth_user_credentials 
          (employee_id, username, password_hash, email, phone, role_id)
          OUTPUT INSERTED.user_id
          VALUES (@employeeId, @username, @passwordHash, @email, @phone, @roleId)
        `);

      const userId = userResult.recordset[0].user_id;

      // Copy role permissions to user permissions
      const rolePermissionsResult = await pool.request().input("roleId", roleId)
        .query(`
          SELECT menu_id, is_view, is_add, is_update, is_delete, is_print, 
                 is_import, is_export, is_post, is_release
          FROM auth_role_permissions 
          WHERE role_id = @roleId AND status = 1
        `);

      const rolePermissions = rolePermissionsResult.recordset;

      // Insert user permissions based on role permissions
      for (const permission of rolePermissions) {
        await pool
          .request()
          .input("userId", userId)
          .input("menuId", permission.menu_id)
          .input("isView", permission.is_view)
          .input("isAdd", permission.is_add)
          .input("isUpdate", permission.is_update)
          .input("isDelete", permission.is_delete)
          .input("isPrint", permission.is_print)
          .input("isImport", permission.is_import)
          .input("isExport", permission.is_export)
          .input("isPost", permission.is_post)
          .input("isRelease", permission.is_release).query(`
            INSERT INTO auth_user_permissions 
            (user_id, menu_id, is_view, is_add, is_update, is_delete, is_print, 
             is_import, is_export, is_post, is_release, status)
            VALUES (@userId, @menuId, @isView, @isAdd, @isUpdate, @isDelete, @isPrint, 
                    @isImport, @isExport, @isPost, @isRelease, 1)
          `);
      }

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: "User created successfully with permissions",
        userId: userId,
      });
    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error("Transaction rollback error:", rollbackError);
        }
      }
      console.error("Create user error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  // Get all users
  getUsers: async (req, res) => {
    try {
      const pool = await getConnection();

      const result = await pool.query(`
        SELECT 
          uc.user_id, uc.username, uc.email, uc.phone, uc.status as user_status,
          em.employee_id, em.employee_code, em.first_name, em.last_name,
          rm.role_id, rm.role_name
        FROM auth_user_credentials uc
        INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
        INNER JOIN M13_role_master rm ON uc.role_id = rm.role_id
        ORDER BY uc.created_at DESC
      `);

      res.json({
        success: true,
        users: result.recordset,
      });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get user by ID
  getUserById: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getConnection();

      const result = await pool.request().input("userId", id).query(`
        SELECT 
          uc.user_id, uc.username, uc.email, uc.phone, uc.status as user_status,
          em.employee_id, em.employee_code, em.first_name, em.last_name,
          rm.role_id, rm.role_name
        FROM auth_user_credentials uc
        INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
        INNER JOIN M13_role_master rm ON uc.role_id = rm.role_id
        WHERE uc.user_id = @userId
      `);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        user: result.recordset[0],
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = userController;
