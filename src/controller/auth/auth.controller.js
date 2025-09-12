const bcrypt = require("bcryptjs");
const { getConnection } = require("../../config/database.js");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../config//jwtUtils.js");

const authController = {
  // Login user
  login: async (req, res) => {
    try {
      const { loginId, password } = req.body;

      if (!loginId || !password) {
        return res.status(400).json({
          success: false,
          message: "Login ID and password are required",
        });
      }

      const pool = await getConnection();

      // Check if user exists by username, email, or phone
      const userResult = await pool.request().input("loginId", loginId).query(`
        SELECT uc.*, em.first_name, em.last_name, em.employee_code, em.status as emp_status
        FROM auth_user_credentials uc
        INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
        WHERE (uc.username = @loginId OR uc.email = @loginId OR uc.phone = @loginId)
        AND uc.status = 1 AND em.status = 1
      `);

      if (userResult.recordset.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const user = userResult.recordset[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash
      );
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Get user permissions with proper menu information
      const permissionsResult = await pool
        .request()
        .input("userId", user.user_id)
        .input("roleId", user.role_id).query(`
          SELECT 
            mm.menu_id, 
            mm.menu_code, 
            mm.menu_name, 
            mm.parent_menu_id, 
            mm.url, 
            mm.icon,
            mm.status as menu_status,
            COALESCE(up.is_view, rp.is_view, 0) as is_view,
            COALESCE(up.is_add, rp.is_add, 0) as is_add,
            COALESCE(up.is_update, rp.is_update, 0) as is_update,
            COALESCE(up.is_delete, rp.is_delete, 0) as is_delete,
            COALESCE(up.is_print, rp.is_print, 0) as is_print,
            COALESCE(up.is_import, rp.is_import, 0) as is_import,
            COALESCE(up.is_export, rp.is_export, 0) as is_export,
            COALESCE(up.is_post, rp.is_post, 0) as is_post,
            COALESCE(up.is_release, rp.is_release, 0) as is_release
          FROM M14_menu_master mm
          LEFT JOIN auth_role_permissions rp ON mm.menu_id = rp.menu_id AND rp.role_id = @roleId AND rp.status = 1
          LEFT JOIN auth_user_permissions up ON mm.menu_id = up.menu_id AND up.user_id = @userId AND up.status = 1
          WHERE mm.status = 1
          ORDER BY mm.menu_name
        `);

      const permissions = permissionsResult.recordset;

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.user_id,
        employeeId: user.employee_id,
        roleId: user.role_id,
      });

      const refreshToken = generateRefreshToken({
        userId: user.user_id,
      });

      // Store refresh token in database
      await pool
        .request()
        .input("userId", user.user_id)
        .input("refreshToken", refreshToken)
        .input(
          "refreshTokenExpiry",
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ).query(`
          UPDATE auth_user_credentials 
          SET refresh_token = @refreshToken, 
              refresh_token_expiry = @refreshTokenExpiry,
              last_login = GETDATE()
          WHERE user_id = @userId
        `);

      res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          userId: user.user_id,
          employeeId: user.employee_id,
          employeeCode: user.employee_code,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          roleId: user.role_id,
        },
        permissions: permissions.map((permission) => ({
          menu_id: permission.menu_id,
          menu_code: permission.menu_code,
          menu_name: permission.menu_name,
          parent_menu_id: permission.parent_menu_id,
          url: permission.url,
          icon: permission.icon,
          menu_status: permission.menu_status,
          is_view: Boolean(permission.is_view),
          is_add: Boolean(permission.is_add),
          is_update: Boolean(permission.is_update),
          is_delete: Boolean(permission.is_delete),
          is_print: Boolean(permission.is_print),
          is_import: Boolean(permission.is_import),
          is_export: Boolean(permission.is_export),
          is_post: Boolean(permission.is_post),
          is_release: Boolean(permission.is_release),
        })),
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  // Refresh token
  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      const pool = await getConnection();

      // Verify refresh token in database
      const userResult = await pool
        .request()
        .input("refreshToken", refreshToken).query(`
                    SELECT user_id, employee_id, role_id, refresh_token_expiry
                    FROM auth_user_credentials 
                    WHERE refresh_token = @refreshToken AND status = 1
                `);

      if (userResult.recordset.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Invalid refresh token",
        });
      }

      const user = userResult.recordset[0];

      // Check if refresh token is expired
      if (new Date(user.refresh_token_expiry) < new Date()) {
        return res.status(403).json({
          success: false,
          message: "Refresh token expired",
        });
      }

      // Generate new access token
      const newAccessToken = generateAccessToken({
        userId: user.user_id,
        employeeId: user.employee_id,
        roleId: user.role_id,
      });

      res.json({
        success: true,
        accessToken: newAccessToken,
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Logout
  logout: async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const pool = await getConnection();

      await pool.request().input("userId", userId).query(`
                    UPDATE auth_user_credentials 
                    SET refresh_token = NULL, 
                        refresh_token_expiry = NULL
                    WHERE user_id = @userId
                `);

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Verify token
  verifyToken: async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access token required",
        });
      }

      const { verifyAccessToken } = require("../utils/jwtUtils");
      const decoded = verifyAccessToken(token);

      const pool = await getConnection();

      const userResult = await pool.request().input("userId", decoded.userId)
        .query(`
                    SELECT uc.*, em.first_name, em.last_name, em.employee_code, rm.role_name
                    FROM auth_user_credentials uc
                    INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
                    INNER JOIN M13_role_master rm ON uc.role_id = rm.role_id
                    WHERE uc.user_id = @userId AND uc.status = 1
                `);

      if (userResult.recordset.length === 0) {
        return res.status(403).json({
          success: false,
          message: "User not found or inactive",
        });
      }

      res.json({
        success: true,
        user: userResult.recordset[0],
      });
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
  },
};

module.exports = authController;
