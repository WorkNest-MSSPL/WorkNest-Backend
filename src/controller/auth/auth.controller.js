const bcrypt = require("bcryptjs");
const { getConnection } = require("../../config/database.js");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("../../config/jwtUtils.js");

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
    let pool;
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      pool = await getConnection();

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

      // Generate new tokens
      const newAccessToken = generateAccessToken({
        userId: user.user_id,
        employeeId: user.employee_id,
        roleId: user.role_id,
      });

      const newRefreshToken = generateRefreshToken({
        userId: user.user_id,
      });

      const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Update with new refresh token (FIXED: removed extra comma and used parameterized query)
      await pool
        .request()
        .input("userId", user.user_id)
        .input("newRefreshToken", newRefreshToken) // FIXED: using new token
        .input("refreshTokenExpiry", refreshTokenExpiry).query(`
        UPDATE auth_user_credentials
        SET refresh_token = @newRefreshToken,
            refresh_token_expiry = @refreshTokenExpiry
        WHERE user_id = @userId
      `);

      res.json({
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error("Refresh token error:", error);

      // More detailed error logging
      if (error.message) {
        console.error("Error message:", error.message);
      }
      if (error.code) {
        console.error("Error code:", error.code);
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        // Remove error details in production, keep for debugging
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      // Ensure database connection is closed
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          console.error("Error closing connection:", closeError);
        }
      }
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

  //Verify token
  verifyToken: async (req, res) => {
    try {
      const rawHeader = req.headers.authorization;
      console.log("🔹 Authorization header received:", rawHeader);

      const token = rawHeader?.split(" ")[1];
      console.log("🔹 Extracted token:", token);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access token required",
        });
      }

      let decoded;
      try {
        decoded = verifyAccessToken(token);
        console.log("✅ Decoded token:", decoded);
      } catch (err) {
        console.error("❌ Token verification failed:", err.message);
        return res.status(403).json({
          success: false,
          message: "Invalid or expired token",
        });
      }

      const pool = await getConnection();
      console.log("🔹 Running DB query for userId:", decoded.userId);

      const userResult = await pool.request().input("userId", decoded.userId)
        .query(`
        SELECT uc.*, em.first_name, em.last_name, em.employee_code, rm.role_name
        FROM auth_user_credentials uc
        INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
        INNER JOIN M13_role_master rm ON uc.role_id = rm.role_id
        WHERE uc.user_id = @userId AND uc.status = 1
      `);

      console.log("🔹 Query result:", userResult.recordset);

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
      console.error("❌ Unexpected error in verifyToken:", error.message);
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
  },
};

module.exports = authController;

// const bcrypt = require("bcryptjs");
// const { getConnection } = require("../../config/database.js");
// const {
//   generateAccessToken,
//   generateRefreshToken,
//   verifyAccessToken,
//   verifyRefreshToken,
// } = require("../../config/jwtUtils.js");

// const authController = {
//   // Login user - returns only tokens
//   login: async (req, res) => {
//     try {
//       const { loginId, password } = req.body;

//       if (!loginId || !password) {
//         return res.status(400).json({
//           success: false,
//           message: "Login ID and password are required",
//         });
//       }

//       const pool = await getConnection();

//       // Check if user exists by username, email, or phone
//       const userResult = await pool.request().input("loginId", loginId).query(`
//         SELECT uc.*, em.first_name, em.last_name, em.employee_code, em.status as emp_status
//         FROM auth_user_credentials uc
//         INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
//         WHERE (uc.username = @loginId OR uc.email = @loginId OR uc.phone = @loginId)
//         AND uc.status = 1 AND em.status = 1
//       `);

//       if (userResult.recordset.length === 0) {
//         return res.status(401).json({
//           success: false,
//           message: "Invalid credentials",
//         });
//       }

//       const user = userResult.recordset[0];

//       // Verify password
//       const isValidPassword = await bcrypt.compare(
//         password,
//         user.password_hash
//       );
//       if (!isValidPassword) {
//         return res.status(401).json({
//           success: false,
//           message: "Invalid credentials",
//         });
//       }

//       // Generate tokens
//       const accessToken = generateAccessToken({
//         userId: user.user_id,
//         employeeId: user.employee_id,
//         roleId: user.role_id,
//       });

//       const refreshToken = generateRefreshToken({
//         userId: user.user_id,
//       });

//       // Store refresh token in database
//       await pool
//         .request()
//         .input("userId", user.user_id)
//         .input("refreshToken", refreshToken)
//         .input(
//           "refreshTokenExpiry",
//           new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
//         ).query(`
//           UPDATE auth_user_credentials
//           SET refresh_token = @refreshToken,
//               refresh_token_expiry = @refreshTokenExpiry,
//               last_login = GETDATE()
//           WHERE user_id = @userId
//         `);

//       // Return only tokens
//       res.json({
//         success: true,
//         accessToken,
//         refreshToken,
//       });
//     } catch (error) {
//       console.error("Login error:", error);
//       res.status(500).json({
//         success: false,
//         message: "Internal server error",
//         error: error.message,
//       });
//     }
//   },

//   // Get user profile and permissions
//   getProfile: async (req, res) => {
//     try {
//       const token = req.headers.authorization?.split(" ")[1];

//       if (!token) {
//         return res.status(401).json({
//           success: false,
//           message: "Access token required",
//         });
//       }

//       // Verify access token
//       const decoded = verifyAccessToken(token);
//       console.log("decoded", decoded);
//       if (!decoded) {
//         return res.status(403).json({
//           success: false,
//           message: "Invalid or expired access token",
//         });
//       }

//       const pool = await getConnection();

//       // Get user details
//       const userResult = await pool.request().input("userId", decoded.userId)
//         .query(`
//           SELECT uc.*, em.first_name, em.last_name, em.employee_code, em.status as emp_status, rm.role_name
//           FROM auth_user_credentials uc
//           INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
//           INNER JOIN M13_role_master rm ON uc.role_id = rm.role_id
//           WHERE uc.user_id = @userId AND uc.status = 1 AND em.status = 1
//         `);

//       if (userResult.recordset.length === 0) {
//         return res.status(404).json({
//           success: false,
//           message: "User not found or inactive",
//         });
//       }

//       const user = userResult.recordset[0];

//       // Get user permissions with proper menu information
//       const permissionsResult = await pool
//         .request()
//         .input("userId", user.user_id)
//         .input("roleId", user.role_id).query(`
//           SELECT
//             mm.menu_id,
//             mm.menu_code,
//             mm.menu_name,
//             mm.parent_menu_id,
//             mm.url,
//             mm.icon,
//             mm.status as menu_status,
//             COALESCE(up.is_view, rp.is_view, 0) as is_view,
//             COALESCE(up.is_add, rp.is_add, 0) as is_add,
//             COALESCE(up.is_update, rp.is_update, 0) as is_update,
//             COALESCE(up.is_delete, rp.is_delete, 0) as is_delete,
//             COALESCE(up.is_print, rp.is_print, 0) as is_print,
//             COALESCE(up.is_import, rp.is_import, 0) as is_import,
//             COALESCE(up.is_export, rp.is_export, 0) as is_export,
//             COALESCE(up.is_post, rp.is_post, 0) as is_post,
//             COALESCE(up.is_release, rp.is_release, 0) as is_release
//           FROM M14_menu_master mm
//           LEFT JOIN auth_role_permissions rp ON mm.menu_id = rp.menu_id AND rp.role_id = @roleId AND rp.status = 1
//           LEFT JOIN auth_user_permissions up ON mm.menu_id = up.menu_id AND up.user_id = @userId AND up.status = 1
//           WHERE mm.status = 1
//           ORDER BY mm.menu_name
//         `);

//       const permissions = permissionsResult.recordset;

//       res.json({
//         success: true,
//         user: {
//           userId: user.user_id,
//           employeeId: user.employee_id,
//           employeeCode: user.employee_code,
//           firstName: user.first_name,
//           lastName: user.last_name,
//           username: user.username,
//           email: user.email,
//           phone: user.phone,
//           roleId: user.role_id,
//           roleName: user.role_name,
//         },
//         permissions: permissions.map((permission) => ({
//           menu_id: permission.menu_id,
//           menu_code: permission.menu_code,
//           menu_name: permission.menu_name,
//           parent_menu_id: permission.parent_menu_id,
//           url: permission.url,
//           icon: permission.icon,
//           menu_status: permission.menu_status,
//           is_view: Boolean(permission.is_view),
//           is_add: Boolean(permission.is_add),
//           is_update: Boolean(permission.is_update),
//           is_delete: Boolean(permission.is_delete),
//           is_print: Boolean(permission.is_print),
//           is_import: Boolean(permission.is_import),
//           is_export: Boolean(permission.is_export),
//           is_post: Boolean(permission.is_post),
//           is_release: Boolean(permission.is_release),
//         })),
//       });
//     } catch (error) {
//       console.error("Get profile error:", error);

//       if (
//         error.name === "TokenExpiredError" ||
//         error.name === "JsonWebTokenError"
//       ) {
//         return res.status(403).json({
//           success: false,
//           message: "Invalid or expired token",
//         });
//       }

//       res.status(500).json({
//         success: false,
//         message: "Internal server error",
//         error:
//           process.env.NODE_ENV === "development" ? error.message : undefined,
//       });
//     }
//   },

//   // Refresh token
//   refreshToken: async (req, res) => {
//     let pool;
//     try {
//       const { refreshToken } = req.body;

//       if (!refreshToken) {
//         return res.status(400).json({
//           success: false,
//           message: "Refresh token is required",
//         });
//       }

//       pool = await getConnection();

//       // Verify refresh token in database
//       const userResult = await pool
//         .request()
//         .input("refreshToken", refreshToken).query(`
//         SELECT user_id, employee_id, role_id, refresh_token_expiry
//         FROM auth_user_credentials
//         WHERE refresh_token = @refreshToken AND status = 1
//       `);

//       if (userResult.recordset.length === 0) {
//         return res.status(403).json({
//           success: false,
//           message: "Invalid refresh token",
//         });
//       }

//       const user = userResult.recordset[0];

//       // Check if refresh token is expired
//       if (new Date(user.refresh_token_expiry) < new Date()) {
//         return res.status(403).json({
//           success: false,
//           message: "Refresh token expired",
//         });
//       }

//       // Generate new tokens
//       const newAccessToken = generateAccessToken({
//         userId: user.user_id,
//         employeeId: user.employee_id,
//         roleId: user.role_id,
//       });

//       const newRefreshToken = generateRefreshToken({
//         userId: user.user_id,
//       });

//       const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

//       // Update with new refresh token
//       await pool
//         .request()
//         .input("userId", user.user_id)
//         .input("newRefreshToken", newRefreshToken)
//         .input("refreshTokenExpiry", refreshTokenExpiry).query(`
//         UPDATE auth_user_credentials
//         SET refresh_token = @newRefreshToken,
//             refresh_token_expiry = @refreshTokenExpiry
//         WHERE user_id = @userId
//       `);

//       res.json({
//         success: true,
//         accessToken: newAccessToken,
//         refreshToken: newRefreshToken,
//       });
//     } catch (error) {
//       console.error("Refresh token error:", error);

//       if (error.message) {
//         console.error("Error message:", error.message);
//       }
//       if (error.code) {
//         console.error("Error code:", error.code);
//       }

//       res.status(500).json({
//         success: false,
//         message: "Internal server error",
//         error:
//           process.env.NODE_ENV === "development" ? error.message : undefined,
//       });
//     } finally {
//       if (pool) {
//         try {
//           await pool.close();
//         } catch (closeError) {
//           console.error("Error closing connection:", closeError);
//         }
//       }
//     }
//   },

//   // Logout
//   logout: async (req, res) => {
//     try {
//       const { userId } = req.body;

//       if (!userId) {
//         return res.status(400).json({
//           success: false,
//           message: "User ID is required",
//         });
//       }

//       const pool = await getConnection();

//       await pool.request().input("userId", userId).query(`
//         UPDATE auth_user_credentials
//         SET refresh_token = NULL,
//             refresh_token_expiry = NULL
//         WHERE user_id = @userId
//       `);

//       res.json({
//         success: true,
//         message: "Logged out successfully",
//       });
//     } catch (error) {
//       console.error("Logout error:", error);
//       res.status(500).json({
//         success: false,
//         message: "Internal server error",
//       });
//     }
//   },

//   // Verify token (optional - for token validation only)
//   verifyToken: async (req, res) => {
//     try {
//       const token = req.headers.authorization?.split(" ")[1];

//       if (!token) {
//         return res.status(401).json({
//           success: false,
//           message: "Access token required",
//         });
//       }

//       const decoded = verifyAccessToken(token);

//       const pool = await getConnection();

//       const userResult = await pool.request().input("userId", decoded.userId)
//         .query(`
//           SELECT uc.user_id, em.first_name, em.last_name, em.employee_code, rm.role_name
//           FROM auth_user_credentials uc
//           INNER JOIN E01_employee_master em ON uc.employee_id = em.employee_id
//           INNER JOIN M13_role_master rm ON uc.role_id = rm.role_id
//           WHERE uc.user_id = @userId AND uc.status = 1
//         `);

//       if (userResult.recordset.length === 0) {
//         return res.status(403).json({
//           success: false,
//           message: "User not found or inactive",
//         });
//       }

//       res.json({
//         success: true,
//         message: "Token is valid",
//         user: {
//           userId: userResult.recordset[0].user_id,
//           firstName: userResult.recordset[0].first_name,
//           lastName: userResult.recordset[0].last_name,
//           employeeCode: userResult.recordset[0].employee_code,
//           roleName: userResult.recordset[0].role_name,
//         },
//       });
//     } catch (error) {
//       console.error("Token verification error:", error);
//       return res.status(403).json({
//         success: false,
//         message: "Invalid or expired token",
//       });
//     }
//   },
// };

// module.exports = authController;
