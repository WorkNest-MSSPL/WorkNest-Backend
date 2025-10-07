const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const taxDeclarationOperations = async (req, res) => {
  const {
    type,
    declaration_id,
    employee_id,
    financial_year,
    tax_regime = 1, // Default to 1 as in procedure
    section_80C, // Changed from section_80c to match procedure
    section_80D, // Changed from section_80d to match procedure
    section_24,
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
      .input("declaration_id", sql.Int, declaration_id || null)
      .input("employee_id", sql.Int, employee_id || null)
      .input("financial_year", sql.NVarChar(10), financial_year || null) // Changed to 10 as in procedure
      .input("tax_regime", sql.TinyInt, tax_regime) // Changed to TinyInt as in procedure
      .input("section_80C", sql.Decimal(18, 2), section_80C || 0) // Changed parameter name and default to 0
      .input("section_80D", sql.Decimal(18, 2), section_80D || 0) // Changed parameter name and default to 0
      .input("section_24", sql.Decimal(18, 2), section_24 || 0) // Default to 0 as in procedure
      .input("created_by", sql.Int, userId); // Only created_by is used in procedure

    const result = await request.execute("usp_PR20_tax_declaration_ops");

    // Handle different response structures based on operation type
    let responseData = {};

    if (type === 1 || type === 3) {
      // For create/update (type 1) and get by employee (type 3)
      const messageRecordset = result.recordsets[0];
      const dataRecordset = result.recordsets[1];

      responseData = {
        success: messageRecordset[0]?.isSuccess === 1,
        message:
          messageRecordset[0]?.message || "Operation completed successfully",
        data: dataRecordset || [],
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
    console.error("Error in tax declaration operations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = { taxDeclarationOperations };

// const { getConnection, sql } = require("../../config/database.js");
// const path = require("path");
// const { validateLicense } = require(path.join(__dirname, "checker.obf"));
// const { getUserId } = require("../../utils/UserInfo.js");

// const taxDeclarationOperations = async (req, res) => {
//   const {
//     type,
//     declaration_id,
//     employee_id,
//     financial_year,
//     tax_regime,
//     section_80c,
//     section_80d,
//     section_24,
//     other_deductions,
//     total_deductions,
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
//       .input("declaration_id", sql.Int, declaration_id || null)
//       .input("employee_id", sql.Int, employee_id || null)
//       .input("financial_year", sql.NVarChar(20), financial_year || null)
//       .input("tax_regime", sql.NVarChar(20), tax_regime || null)
//       .input("section_80c", sql.Decimal(18, 2), section_80c || null)
//       .input("section_80d", sql.Decimal(18, 2), section_80d || null)
//       .input("section_24", sql.Decimal(18, 2), section_24 || null)
//       .input("other_deductions", sql.Decimal(18, 2), other_deductions || null)
//       .input("total_deductions", sql.Decimal(18, 2), total_deductions || null)
//       .input("created_by", sql.Int, userId)
//       .input("updated_by", sql.Int, userId)
//       .execute("usp_PR20_tax_declaration_ops");

//     res.status(200).json({
//       success: true,
//       message: "Operation completed successfully",
//       data: result.recordsets[1],
//     });
//   } catch (error) {
//     console.error("Error in tax declaration operations:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
//     });
//   }
// };

// module.exports = { taxDeclarationOperations };
