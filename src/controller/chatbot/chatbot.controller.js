const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const axios = require("axios");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

// Role-based table configuration
const RoleBasedTables = {
  HR: [
    "E01_employee_master",
    "R01_job_category_master",
    "R02_job_postings",
    "R03_job_applications",
  ],
  EMPLOYEE: [
    "E01_employee_master",
    "R01_job_category_master",
    "R02_job_postings",
  ],
  PUBLIC: ["R01_job_category_master", "R02_job_postings"],
  VISITOR: ["V01_visitor_master"],
};

const chatBotOperations = async (req, res) => {
  const {
    question,
    role = "PUBLIC", // Default role if not provided
    // Remove is_public from destructuring as we'll set it automatically
  } = req.body;

  try {
    // Validate license
    validateLicense();

    // Get user ID from request
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Validate role
    const userRole = role.toUpperCase();
    if (!RoleBasedTables[userRole]) {
      return res.status(400).json({
        success: false,
        message: "Invalid role provided",
        available_roles: Object.keys(RoleBasedTables),
      });
    }

    // Get tables based on role
    const allowedTables = RoleBasedTables[userRole];

    // Automatically set is_public based on role
    const isPublic = userRole === "PUBLIC" || userRole === "VISITOR";

    // If no tables are allowed and this is a public query, return error
    if (allowedTables.length === 0 && !isPublic) {
      return res.status(403).json({
        success: false,
        message: "Access denied. No permitted tables available for your role.",
        role: userRole,
      });
    }

    // Validate that question is provided
    if (!question || question.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    // Prepare payload for external API
    const chatPayload = {
      question: question.trim(),
      requested_tables: allowedTables,
      is_public: isPublic, // Automatically set based on role
    };

    // Only include employee_id for HR and EMPLOYEE roles
    if (userRole === "HR" || userRole === "EMPLOYEE") {
      chatPayload.employee_id = userId;
    }

    console.log("Sending to chatbot API:", {
      role: userRole,
      tables: allowedTables,
      employee_id:
        userRole === "HR" || userRole === "EMPLOYEE" ? userId : "not_sent",
      is_public: isPublic,
      question:
        question.substring(0, 100) + (question.length > 100 ? "..." : ""),
    });

    // Call external chatbot API
    const response = await axios.post(
      "https://worknestchatbot.mssplonline.com/api/chat",
      chatPayload,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 30000, // 30 seconds timeout
      }
    );

    // Return the response from external API
    res.json({
      success: true,
      data: response.data,
      meta: {
        role: userRole,
        allowed_tables: allowedTables,
        employee_id:
          userRole === "HR" || userRole === "EMPLOYEE" ? userId : null,
        is_public: isPublic,
        question:
          question.substring(0, 100) + (question.length > 100 ? "..." : ""),
      },
    });
  } catch (error) {
    console.error("Error in chatBotOperations:", error);

    // Handle license validation errors
    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    // Handle axios errors (external API errors)
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      return res.status(error.response.status).json({
        success: false,
        message: "Chatbot service error",
        error: error.response.data,
        status: error.response.status,
      });
    } else if (error.request) {
      // The request was made but no response was received
      return res.status(503).json({
        success: false,
        message: "Chatbot service unavailable",
        error: "No response received from chatbot service",
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  chatBotOperations,
};

// const { getConnection, sql } = require("../../config/database.js");
// const path = require("path");
// const { validateLicense } = require(path.join(__dirname, "checker.obf"));
// const { getUserId } = require("../../utils/UserInfo.js");

// const RequestedTable = {
//   HR: [
//     "E01_employee_master",
//     "E02_employee_personal_details",
//     "E03_employee_contact_details",
//     "E04_employee_job_details",
//     "E05_employee_bank_details",
//     "E06_employee_documents",
//     "M01_country_master",
//     "M02_department_master",
//     "M03_designation_master",
//     "M04_branch_master",
//     "M05_location_master",
//     "M06_employment_type_master",
//   ],
// };

// const chatBotOperations = async (req, res) => {
//   const {
//     type,
//     question,
//     requested_tables,
//     employee_id,
//     is_public = true,
//   } = req.body;

//   try {
//     validateLicense();
//     const userId = getUserId(req);
//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "User authentication required",
//       });
//     }

//     const pool = await getConnection();
//     let result;
//   } catch (error) {
//     console.error("Error in leaveApprovalOperations:", error);

//     if (error.message?.includes("License validation failed")) {
//       return res.status(403).json({
//         success: false,
//         message: "License validation failed",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };

// module.exports = {
//   chatBotOperations,
// };
