const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const reimbursementOperations = async (req, res) => {
  const {
    type,
    reimbursement_id,
    employee_id,
    reimbursement_type_id,
    claim_date,
    claimed_amount, // Using claimed_amount as primary amount field
    claim_description, // Changed from description to match procedure
    approval_status = 0, // Default to 1 as in procedure
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
      .input("reimbursement_id", sql.Int, reimbursement_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("reimbursement_type_id", sql.Int, reimbursement_type_id || null)
      .input("claim_date", sql.Date, claim_date || null)
      .input("claimed_amount", sql.Decimal(18, 2), claimed_amount || null) // Using claimed_amount
      .input("claim_description", sql.NVarChar(500), claim_description || null) // Changed parameter name
      .input("approval_status", sql.TinyInt, approval_status) // Changed to TinyInt
      .input("created_by", sql.Int, userId); // Only created_by is used

    const result = await request.execute("usp_PR33_reimbursement_ops");

    // Handle different response structures based on operation type
    let responseData = {};

    if (type === 1) {
      // For create reimbursement - success message in first recordset, data in second
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
          messageRecordset[0]?.message ||
          "Reimbursement status updated successfully",
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
    console.error("Error in reimbursement operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { reimbursementOperations };

// const { getConnection, sql } = require("../../config/database.js");
// const path = require("path");
// const { validateLicense } = require(path.join(__dirname, "checker.obf"));
// const { getUserId } = require("../../utils/UserInfo.js");

// const reimbursementOperations = async (req, res) => {
//   const {
//     type,
//     reimbursement_id,
//     employee_id,
//     reimbursement_type_id,
//     claim_date,
//     claim_amount,
//     claimed_amount,
//     description,
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
//       .input("reimbursement_id", sql.Int, reimbursement_id || null)
//       .input("employee_id", sql.Int, employee_id || null)
//       .input("reimbursement_type_id", sql.Int, reimbursement_type_id || null)
//       .input("claim_date", sql.Date, claim_date || null)
//       .input("claim_amount", sql.Decimal(18, 2), claim_amount || null)
//       .input("claimed_amount", sql.Decimal(18, 2), claimed_amount || null)
//       .input("description", sql.NVarChar(500), description || null)
//       .input("approval_status", sql.Int, approval_status || 1)
//       .input("approved_by", sql.Int, approved_by || null)
//       .input("approved_date", sql.Date, approved_date || null)
//       .input("created_by", sql.Int, userId)
//       .input("updated_by", sql.Int, userId)
//       .execute("usp_PR33_reimbursement_ops");

//     res.status(200).json({
//       success: true,
//       message: "Operation completed successfully",
//       data: result.recordsets[1],
//     });
//   } catch (error) {
//     console.error("Error in reimbursement operations:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
//     });
//   }
// };

// module.exports = { reimbursementOperations };
