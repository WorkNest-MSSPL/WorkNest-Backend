const { getConnection, sql } = require("../../config/database.js");
const { getUserId } = require("../../utils/UserInfo.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

const taxConfigurationController = {
  /**
   * @desc    Create tax configuration
   * @route   POST /api/payroll/tax-configurations
   * @access  Private (HR/Admin)
   */
  createTaxConfiguration: async (req, res) => {
    try {
      const {
        company_id,
        tax_name,
        rate,
        effective_from,
        effective_to = null,
      } = req.body;
      const userId = getUserId(req);

      if (!company_id || !tax_name || rate === undefined || !effective_from) {
        return res.status(400).json({
          success: false,
          message:
            "Company ID, tax name, rate and effective from date are required",
        });
      }

      const pool = await getConnection();

      // Check for overlapping tax configurations
      const overlappingTax = await pool
        .request()
        .input("company_id", company_id)
        .input("tax_name", tax_name)
        .input("effective_from", effective_from)
        .input("effective_to", effective_to).query(`
          SELECT * FROM P11_tax_configurations 
          WHERE company_id = @company_id 
            AND tax_name = @tax_name
            AND (
              (effective_to IS NULL AND @effective_to IS NULL) OR
              (effective_to IS NULL AND @effective_to >= effective_from) OR
              (@effective_to IS NULL AND effective_to >= @effective_from) OR
              (effective_from <= @effective_to AND effective_to >= @effective_from)
            )
        `);

      if (overlappingTax.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Tax configuration with same name already exists for overlapping period",
        });
      }

      // Insert tax configuration
      const result = await pool
        .request()
        .input("company_id", company_id)
        .input("tax_name", tax_name)
        .input("rate", parseFloat(rate))
        .input("effective_from", effective_from)
        .input("effective_to", effective_to).query(`
          INSERT INTO P11_tax_configurations (company_id, tax_name, rate, effective_from, effective_to)
          OUTPUT INSERTED.tax_config_id
          VALUES (@company_id, @tax_name, @rate, @effective_from, @effective_to)
        `);

      const taxConfigId = result.recordset[0].tax_config_id;

      res.status(201).json({
        success: true,
        message: "Tax configuration created successfully",
        data: {
          tax_config_id: taxConfigId,
        },
      });
    } catch (error) {
      console.error("Create tax configuration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get tax configurations for company
   * @route   GET /api/payroll/tax-configurations
   * @access  Private
   */
  getTaxConfigurations: async (req, res) => {
    try {
      const { company_id, effective_date } = req.query;
      const pool = await getConnection();

      let query = `
        SELECT tc.*, cm.company_name
        FROM P11_tax_configurations tc
        INNER JOIN M01_company_master cm ON tc.company_id = cm.company_id
        WHERE 1=1
      `;

      const request = pool.request();

      if (company_id) {
        query += " AND tc.company_id = @company_id";
        request.input("company_id", parseInt(company_id));
      }

      if (effective_date) {
        query +=
          " AND tc.effective_from <= @effective_date AND (tc.effective_to IS NULL OR tc.effective_to >= @effective_date)";
        request.input("effective_date", effective_date);
      }

      query += " ORDER BY tc.effective_from DESC, tc.tax_name";

      const result = await request.query(query);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get tax configurations error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Assign tax exemption to employee
   * @route   POST /api/employees/:employeeId/tax-exemptions
   * @access  Private (HR/Admin)
   */
  assignEmployeeTaxExemption: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { tax_config_id, exemption_amount = 0 } = req.body;

      if (!tax_config_id) {
        return res.status(400).json({
          success: false,
          message: "Tax configuration ID is required",
        });
      }

      const pool = await getConnection();

      // Check if employee exists
      const employee = await pool
        .request()
        .input("employee_id", parseInt(employeeId))
        .query(
          "SELECT * FROM E01_employee_master WHERE employee_id = @employee_id AND status = 'Active'"
        );

      if (employee.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Employee not found or inactive",
        });
      }

      // Check if tax configuration exists
      const taxConfig = await pool
        .request()
        .input("tax_config_id", tax_config_id)
        .query(
          "SELECT * FROM P11_tax_configurations WHERE tax_config_id = @tax_config_id"
        );

      if (taxConfig.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Tax configuration not found",
        });
      }

      // Check if already assigned
      const existingAssignment = await pool
        .request()
        .input("employee_id", parseInt(employeeId))
        .input("tax_config_id", tax_config_id)
        .query(
          "SELECT * FROM P12_employee_tax_details WHERE employee_id = @employee_id AND tax_config_id = @tax_config_id"
        );

      if (existingAssignment.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Tax configuration already assigned to employee",
        });
      }

      // Assign tax exemption
      await pool
        .request()
        .input("employee_id", parseInt(employeeId))
        .input("tax_config_id", tax_config_id)
        .input("exemption_amount", parseFloat(exemption_amount)).query(`
          INSERT INTO P12_employee_tax_details (employee_id, tax_config_id, exemption_amount)
          VALUES (@employee_id, @tax_config_id, @exemption_amount)
        `);

      res.status(201).json({
        success: true,
        message: "Tax exemption assigned to employee successfully",
      });
    } catch (error) {
      console.error("Assign employee tax exemption error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  /**
   * @desc    Get employee tax details
   * @route   GET /api/employees/:employeeId/tax-details
   * @access  Private
   */
  getEmployeeTaxDetails: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const pool = await getConnection();

      const result = await pool
        .request()
        .input("employee_id", parseInt(employeeId)).query(`
          SELECT 
            etd.*,
            tc.tax_name, tc.rate, tc.effective_from, tc.effective_to
          FROM P12_employee_tax_details etd
          INNER JOIN P11_tax_configurations tc ON etd.tax_config_id = tc.tax_config_id
          WHERE etd.employee_id = @employee_id
          ORDER BY tc.effective_from DESC
        `);

      res.json({
        success: true,
        data: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get employee tax details error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = { taxConfigurationController };
