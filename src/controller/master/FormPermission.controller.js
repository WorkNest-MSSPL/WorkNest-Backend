const { getConnection, sql } = require("../../config/database.js");

const formPermissionController = {
  // Create Form with Bulk Fields
  createForm: async (req, res) => {
    let transaction;
    try {
      const { formName, fields } = req.body;

      if (
        !formName ||
        !fields ||
        !Array.isArray(fields) ||
        fields.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Form name and at least one field are required",
        });
      }

      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Get new FormID (auto-increment simulation)
      const maxFormIdResult = await pool.request().query(`
        SELECT ISNULL(MAX(FormID), 0) + 1 AS NewFormID FROM FORM_PERMISSION
      `);
      const formId = maxFormIdResult.recordset[0].NewFormID;

      // Insert fields
      for (let field of fields) {
        await pool
          .request()
          .input("FormID", formId)
          .input("FormName", formName)
          .input("FieldName", field.FieldName)
          .input("Is_Active", field.Is_Active ? 1 : 0).query(`
            INSERT INTO FORM_PERMISSION (FormID, FormName, FieldName, Is_Active)
            VALUES (@FormID, @FormName, @FieldName, @Is_Active)
          `);
      }

      await transaction.commit();
      res.status(201).json({
        success: true,
        message: "Form and fields created successfully",
        formId,
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Create form error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  // Update Form Fields
  updateForm: async (req, res) => {
    let transaction;
    try {
      const { formId, formName, fields } = req.body;

      if (!formId || !formName || !fields || !Array.isArray(fields)) {
        return res.status(400).json({
          success: false,
          message: "Form ID, form name, and fields array are required",
        });
      }

      const pool = await getConnection();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Get existing fields
      const existing = await pool
        .request()
        .input("FormID", formId)
        .query(`SELECT FieldID FROM FORM_PERMISSION WHERE FormID = @FormID`);
      const existingFieldIds = existing.recordset.map((f) => f.FieldID);

      // Upsert fields
      for (let field of fields) {
        if (field.FieldID && existingFieldIds.includes(field.FieldID)) {
          // Update existing field
          await pool
            .request()
            .input("FieldID", field.FieldID)
            .input("FormName", formName)
            .input("FieldName", field.FieldName)
            .input("Is_Active", field.Is_Active ? 1 : 0).query(`
            UPDATE FORM_PERMISSION
            SET FormName = @FormName,
                FieldName = @FieldName,
                Is_Active = @Is_Active
            WHERE FieldID = @FieldID
          `);
        } else {
          // Insert new field (do NOT provide FieldID)
          await pool
            .request()
            .input("FormID", formId)
            .input("FormName", formName)
            .input("FieldName", field.FieldName)
            .input("Is_Active", field.Is_Active ? 1 : 0).query(`
            INSERT INTO FORM_PERMISSION (FormID, FormName, FieldName, Is_Active)
            VALUES (@FormID, @FormName, @FieldName, @Is_Active)
          `);
        }
      }

      // Delete removed fields
      const incomingIds = fields.filter((f) => f.FieldID).map((f) => f.FieldID);
      const idsToDelete = existingFieldIds.filter(
        (id) => !incomingIds.includes(id)
      );

      for (let delId of idsToDelete) {
        await pool.request().input("FormID", formId).input("FieldID", delId)
          .query(`
          DELETE FROM FORM_PERMISSION WHERE FormID = @FormID AND FieldID = @FieldID
        `);
      }

      await transaction.commit();
      res.json({ success: true, message: "Form updated successfully" });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("Update form error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  // Delete Form
  deleteForm: async (req, res) => {
    try {
      const { formId } = req.params;

      if (!formId) {
        return res
          .status(400)
          .json({ success: false, message: "Form ID required" });
      }

      const pool = await getConnection();
      await pool
        .request()
        .input("FormID", formId)
        .query("DELETE FROM FORM_PERMISSION WHERE FormID = @FormID");

      res.json({ success: true, message: "Form deleted successfully" });
    } catch (error) {
      console.error("Delete form error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  // Get All Forms
  getForms: async (req, res) => {
    try {
      const pool = await getConnection();
      const result = await pool.request().query(`
        SELECT FormID, FormName, FieldID, FieldName, Is_Active FROM FORM_PERMISSION
        ORDER BY FormID, FieldID
      `);

      res.json({
        success: true,
        forms: result.recordset,
      });
    } catch (error) {
      console.error("Get forms error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
};

module.exports = { formPermissionController };
