const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const loanOperations = async (req, res) => {
  const {
    type,
    loan_id,
    employee_id,
    loan_type_id,
    loan_amount,
    interest_rate,
    tenure_months,
    emi_amount,
    loan_date, // Changed from start_date
    first_emi_date, // New parameter
    loan_reason, // New parameter
    approval_status = 1, // Default to 1 as in procedure
  } = req.body;

  try {
    validateLicense();

    const userId = 1;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const pool = await getConnection();

    const request = pool
      .request()
      .input("Type", sql.Int, type)
      .input("loan_id", sql.Int, loan_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("loan_type_id", sql.Int, loan_type_id || null)
      .input("loan_amount", sql.Decimal(18, 2), loan_amount || null)
      .input("interest_rate", sql.Decimal(5, 2), interest_rate || null)
      .input("tenure_months", sql.Int, tenure_months || null)
      .input("emi_amount", sql.Decimal(18, 2), emi_amount || null)
      .input("loan_date", sql.Date, loan_date || null)
      .input("first_emi_date", sql.Date, first_emi_date || null)
      .input("loan_reason", sql.NVarChar(500), loan_reason || null)
      .input("approval_status", sql.TinyInt, approval_status) // Changed to TinyInt
      .input("created_by", sql.Int, userId); // Only created_by is used

    const result = await request.execute("usp_PR28_employee_loan_ops");

    // Handle different response structures based on operation type
    let responseData = {};

    if (type === 1) {
      // For create loan - success message in first recordset, data in second
      const messageRecordset = result.recordsets[0];
      const dataRecordset = result.recordsets[1];

      responseData = {
        success: messageRecordset[0]?.isSuccess === 1,
        message:
          messageRecordset[0]?.message || "Operation completed successfully",
        data: dataRecordset || [],
      };
    } else if (type === 3) {
      // For get all by employee - success message in first recordset, data in second
      const messageRecordset = result.recordsets[0];
      const dataRecordset = result.recordsets[1];

      responseData = {
        success: messageRecordset[0]?.isSuccess === 1,
        message: messageRecordset[0]?.message || "Data retrieved successfully",
        data: dataRecordset || [],
      };
    } else if (type === 5) {
      // For approve/reject - only success message in first recordset
      const messageRecordset = result.recordsets[0];

      responseData = {
        success: messageRecordset[0]?.isSuccess === 1,
        message:
          messageRecordset[0]?.message || "Loan status updated successfully",
        data: [],
      };
    } else {
      // For other operation types
      responseData = {
        success: true,
        message: "Operation completed successfully",
        data: result.recordsets[0] || [],
      };
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error in loan operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { loanOperations };

// const { getConnection, sql } = require("../../config/database.js");
// const path = require("path");
// const { validateLicense } = require(path.join(__dirname, "checker.obf"));
// const { getUserId } = require("../../utils/UserInfo.js");

// const loanOperations = async (req, res) => {
//   const {
//     type,
//     loan_id,
//     employee_id,
//     loan_type_id,
//     loan_amount,
//     interest_rate,
//     tenure_months,
//     emi_amount,
//     start_date,
//     approval_status,
//     approved_by,
//     approved_date,
//   } = req.body;

//   try {
//     validateLicense();

//     const userId = 1;
//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "User authentication required",
//       });
//     }

//     const pool = await getConnection();

//     const result = await pool
//       .request()
//       .input("Type", sql.Int, type)
//       .input("loan_id", sql.Int, loan_id || null)
//       .input("employee_id", sql.Int, employee_id || null)
//       .input("loan_type_id", sql.Int, loan_type_id || null)
//       .input("loan_amount", sql.Decimal(18, 2), loan_amount || null)
//       .input("interest_rate", sql.Decimal(5, 2), interest_rate || null)
//       .input("tenure_months", sql.Int, tenure_months || null)
//       .input("emi_amount", sql.Decimal(18, 2), emi_amount || null)
//       .input("start_date", sql.Date, start_date || null)
//       .input("approval_status", sql.Int, approval_status || 1)
//       .input("approved_by", sql.Int, approved_by || null)
//       .input("approved_date", sql.Date, approved_date || null)
//       .input("created_by", sql.Int, userId)
//       .input("updated_by", sql.Int, userId)
//       .execute("usp_PR28_employee_loan_ops");

//     res.status(200).json({
//       success: true,
//       message: "Operation completed successfully",
//       data: result.recordsets[1],
//     });
//   } catch (error) {
//     console.error("Error in loan operations:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
//     });
//   }
// };

// module.exports = { loanOperations };
