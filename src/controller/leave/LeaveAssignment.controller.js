const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const leaveAssignmentOperations = async (req, res) => {
  const { type, assignment_id, employee_id, leave_type_id, policy_id } =
    req.body;

  try {
    validateLicense();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const pool = await getConnection();
    let result;

    switch (parseInt(type)) {
      case 1: // ASSIGN LEAVE POLICY TO EMPLOYEE
        // Check if assignment already exists
        const existingAssignment = await pool
          .request()
          .input("employee_id", sql.Int, employee_id)
          .input("leave_type_id", sql.Int, leave_type_id).query(`
            SELECT * FROM L10_leave_type_assignment 
            WHERE employee_id = @employee_id AND leave_type_id = @leave_type_id
          `);

        if (existingAssignment.recordset.length > 0) {
          return res.status(400).json({
            success: false,
            message: "Leave type already assigned to this employee",
          });
        }

        result = await pool
          .request()
          .input("employee_id", sql.Int, employee_id)
          .input("leave_type_id", sql.Int, leave_type_id)
          .input("policy_id", sql.Int, policy_id).query(`
            INSERT INTO L10_leave_type_assignment 
            (employee_id, leave_type_id, policy_id, assigned_on)
            OUTPUT INSERTED.*
            VALUES (@employee_id, @leave_type_id, @policy_id, GETDATE())
          `);

        // Initialize leave balance for this assignment
        await pool
          .request()
          .input("employee_id", sql.Int, employee_id)
          .input("leave_type_id", sql.Int, leave_type_id).query(`
            INSERT INTO L03_employee_leave_balance 
            (employee_id, leave_type_id, opening_balance, accrued, used, carried_forward, closing_balance, last_updated)
            VALUES (@employee_id, @leave_type_id, 0, 0, 0, 0, 0, GETDATE())
          `);

        return res.status(201).json({
          success: true,
          message: "Leave policy assigned successfully",
          data: result.recordset[0],
        });

      case 2: // GET ASSIGNMENTS BY EMPLOYEE
        result = await pool.request().input("employee_id", sql.Int, employee_id)
          .query(`
            SELECT la.*, 
                   lt.leave_type_name, lt.leave_type_code,
                   lp.policy_name, lp.accrual_frequency
            FROM L10_leave_type_assignment la
            INNER JOIN M07_leave_type_master lt ON la.leave_type_id = lt.leave_type_id
            INNER JOIN L01_leave_policy lp ON la.policy_id = lp.policy_id
            WHERE la.employee_id = @employee_id
          `);

        return res.json({
          success: true,
          data: result.recordset,
        });

      case 3: // GET EMPLOYEES BY LEAVE TYPE
        result = await pool
          .request()
          .input("leave_type_id", sql.Int, leave_type_id).query(`
            SELECT la.*, 
                   e.employee_code, e.first_name, e.last_name,
                   d.department_name, des.designation_name
            FROM L10_leave_type_assignment la
            INNER JOIN E01_employee_master e ON la.employee_id = e.employee_id
            LEFT JOIN M02_department_master d ON e.department_id = d.department_id
            LEFT JOIN M03_designation_master des ON e.designation_id = des.designation_id
            WHERE la.leave_type_id = @leave_type_id
          `);

        return res.json({
          success: true,
          data: result.recordset,
        });

      case 4: // REMOVE ASSIGNMENT
        result = await pool
          .request()
          .input("assignment_id", sql.Int, assignment_id).query(`
            DELETE FROM L10_leave_type_assignment 
            WHERE assignment_id = @assignment_id
          `);

        return res.json({
          success: true,
          message: "Leave assignment removed successfully",
        });

      case 5: // BULK ASSIGN TO DEPARTMENT
        const {
          department_id,
          policy_id: bulkPolicyId,
          leave_type_ids,
        } = req.body;

        if (
          !department_id ||
          !bulkPolicyId ||
          !leave_type_ids ||
          !Array.isArray(leave_type_ids)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Department ID, Policy ID and Leave Type IDs array are required",
          });
        }

        // Get all employees in department
        const employees = await pool
          .request()
          .input("department_id", sql.Int, department_id).query(`
            SELECT employee_id FROM E01_employee_master 
            WHERE department_id = @department_id AND status = 'Active'
          `);

        let assignedCount = 0;
        let errors = [];

        // Assign each leave type to each employee
        for (const employee of employees.recordset) {
          for (const leaveTypeId of leave_type_ids) {
            try {
              await pool
                .request()
                .input("employee_id", sql.Int, employee.employee_id)
                .input("leave_type_id", sql.Int, leaveTypeId)
                .input("policy_id", sql.Int, bulkPolicyId).query(`
                  IF NOT EXISTS (SELECT 1 FROM L10_leave_type_assignment 
                               WHERE employee_id = @employee_id AND leave_type_id = @leave_type_id)
                  BEGIN
                    INSERT INTO L10_leave_type_assignment 
                    (employee_id, leave_type_id, policy_id, assigned_on)
                    VALUES (@employee_id, @leave_type_id, @policy_id, GETDATE())
                    
                    INSERT INTO L03_employee_leave_balance 
                    (employee_id, leave_type_id, opening_balance, accrued, used, carried_forward, closing_balance, last_updated)
                    VALUES (@employee_id, @leave_type_id, 0, 0, 0, 0, 0, GETDATE())
                  END
                `);
              assignedCount++;
            } catch (error) {
              errors.push(
                `Employee ${employee.employee_id}, Leave Type ${leaveTypeId}: ${error.message}`
              );
            }
          }
        }

        return res.json({
          success: true,
          message: `Bulk assignment completed. ${assignedCount} assignments made.`,
          errors: errors.length > 0 ? errors : undefined,
        });

      case 6: // GET ASSIGNMENTS BY EMPLOYEE
        result = await pool.request().query(`
            SELECT la.*, 
                   lt.leave_type_name, lt.leave_type_code,
                   lp.policy_name, lp.accrual_frequency
            FROM L10_leave_type_assignment la
            INNER JOIN M07_leave_type_master lt ON la.leave_type_id = lt.leave_type_id
            INNER JOIN L01_leave_policy lp ON la.policy_id = lp.policy_id
          `);

        return res.json({
          success: true,
          data: result.recordset,
        });

      case 7: // UPDATE LEAVE POLICY ASSIGNMENT
        try {
          const { assignment_id, employee_id, leave_type_id, policy_id } =
            req.body;

          if (!assignment_id || !employee_id || !leave_type_id || !policy_id) {
            return res.status(400).json({
              success: false,
              message:
                "Assignment ID, employee ID, leave type ID, and policy ID are required",
            });
          }

          // Check if assignment exists
          const checkAssignment = await pool
            .request()
            .input("assignment_id", sql.Int, assignment_id).query(`
        SELECT * FROM L10_leave_type_assignment WHERE assignment_id = @assignment_id
      `);

          if (checkAssignment.recordset.length === 0) {
            return res.status(404).json({
              success: false,
              message: "Leave policy assignment not found",
            });
          }

          // Check if the new combination already exists for another record
          const duplicateCheck = await pool
            .request()
            .input("assignment_id", sql.Int, assignment_id)
            .input("employee_id", sql.Int, employee_id)
            .input("leave_type_id", sql.Int, leave_type_id).query(`
        SELECT * FROM L10_leave_type_assignment 
        WHERE employee_id = @employee_id AND leave_type_id = @leave_type_id 
        AND assignment_id <> @assignment_id
      `);

          if (duplicateCheck.recordset.length > 0) {
            return res.status(400).json({
              success: false,
              message:
                "This leave type is already assigned to the employee under another assignment",
            });
          }

          // Perform update
          const result = await pool
            .request()
            .input("assignment_id", sql.Int, assignment_id)
            .input("employee_id", sql.Int, employee_id)
            .input("leave_type_id", sql.Int, leave_type_id)
            .input("policy_id", sql.Int, policy_id).query(`
        UPDATE L10_leave_type_assignment
        SET employee_id = @employee_id,
            leave_type_id = @leave_type_id,
            policy_id = @policy_id,
            assigned_on = GETDATE()
        OUTPUT INSERTED.*
        WHERE assignment_id = @assignment_id
      `);

          return res.status(200).json({
            success: true,
            message: "Leave policy assignment updated successfully",
            data: result.recordset[0],
          });
        } catch (err) {
          console.error("Error updating leave policy assignment:", err);
          return res.status(500).json({
            success: false,
            message: "Internal Server Error",
          });
        }

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid operation type",
        });
    }
  } catch (error) {
    console.error("Error in leaveAssignmentOperations:", error);

    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  leaveAssignmentOperations,
};
