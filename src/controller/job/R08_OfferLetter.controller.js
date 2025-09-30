const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");
const EmailService = require("../../services/EmailService.js");

const offerLettersOperations = async (req, res) => {
  const {
    type,
    offer_id,
    application_id,
    offered_position,
    offered_salary,
    offer_date,
    acceptance_status,
    document_url,
    send_email = true, // New parameter to control email sending
  } = req.body;

  try {
    validateLicense();

    // Get user ID from request
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const pool = await getConnection();

    const result = await pool
      .request()
      .input("Type", sql.Int, type)
      .input("offer_id", sql.Int, offer_id || null)
      .input("application_id", sql.Int, application_id || null)
      .input("offered_position", sql.NVarChar(200), offered_position || null)
      .input("offered_salary", sql.Decimal(12, 2), offered_salary || null)
      .input("offer_date", sql.Date, offer_date || null)
      .input("acceptance_status", sql.NVarChar(20), acceptance_status || null)
      .input("document_url", sql.NVarChar(500), document_url || null)
      .execute("usp_R08_offer_letters_ops");

    let success = false;
    let message = "";
    let data = null;
    let statusCode = 200;

    if (result.recordsets && result.recordsets.length > 0) {
      const firstRecordset = result.recordsets[0];
      if (firstRecordset.length > 0) {
        const firstRow = firstRecordset[0];

        if (
          firstRow.hasOwnProperty("isSuccess") &&
          firstRow.hasOwnProperty("message")
        ) {
          success = Boolean(firstRow.isSuccess);
          message = firstRow.message || "";
        } else {
          success = true;
          data = firstRecordset;
        }

        if (
          [3, 4, 5].includes(parseInt(type)) &&
          result.recordsets.length > 0
        ) {
          data = result.recordsets[0];
        }
      }
    }

    if (!success && data && data.length > 0) {
      success = true;
    }

    // Set status codes
    if (parseInt(type) === 1 && success) {
      statusCode = 201;

      // Send offer letter email for new offers
      if (send_email && data && data.length > 0) {
        await sendOfferLetterEmail(data[0]);
      }
    } else if (parseInt(type) === 5 && success) {
      // Send status update email for status changes
      if (send_email && data && data.length > 0) {
        await sendOfferStatusUpdateEmail(data[0], acceptance_status);
      }
    } else if (!success) {
      statusCode = 400;
    }

    // Default messages for non-SELECT ops
    if (success && !data) {
      switch (parseInt(type)) {
        case 1:
          message = message || "Offer letter created successfully";
          break;
        case 2:
          message = message || "Offer letter updated successfully";
          break;
        case 5:
          message = message || "Offer status updated successfully";
          break;
      }
    }

    res.status(statusCode).json({
      success,
      message,
      data: data || null,
    });
  } catch (error) {
    console.error(
      "Error executing usp_R08_offer_letters_ops procedure:",
      error
    );

    // License validation error
    if (error.message?.includes("License validation failed")) {
      return res.status(403).json({
        success: false,
        message: "License validation failed",
      });
    }

    // SQL constraint violations
    if (error.number === 547 || error.message?.includes("constraint")) {
      return res.status(400).json({
        success: false,
        message: "Cannot perform operation due to constraint violation",
      });
    }

    // Duplicate record errors
    if (
      error.number === 2601 ||
      error.number === 2627 ||
      error.message?.includes("duplicate") ||
      error.message?.includes("already exists")
    ) {
      return res.status(400).json({
        success: false,
        message: "Duplicate offer record exists for this application",
      });
    }

    // Date validation errors
    if (error.message?.toLowerCase().includes("date")) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    // Decimal/number validation errors
    if (
      error.message?.toLowerCase().includes("salary") ||
      error.message?.toLowerCase().includes("decimal")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper function to send offer letter email
async function sendOfferLetterEmail(offerData) {
  try {
    // Fetch candidate and job details from database
    const pool = await getConnection();
    const candidateResult = await pool
      .request()
      .input("offer_id", sql.Int, offerData.offer_id).query(`
        SELECT a.candidate_name, a.email, a.phone, p.job_title, 
               c.company_name, c.company_address, c.contact_email, c.contact_phone
        FROM R08_offer_letters o
        INNER JOIN R03_job_applications a ON o.application_id = a.application_id
        INNER JOIN R02_job_postings p ON a.job_posting_id = p.job_posting_id
        INNER JOIN R01_companies c ON p.company_id = c.company_id
        WHERE o.offer_id = @offer_id
      `);

    if (candidateResult.recordset.length === 0) {
      console.warn(
        "Candidate details not found for offer:",
        offerData.offer_id
      );
      return;
    }

    const candidateInfo = candidateResult.recordset[0];
    const jobDetails = {
      job_title: candidateInfo.job_title,
      company_name: candidateInfo.company_name,
      company_address: candidateInfo.company_address,
      contact_email: candidateInfo.contact_email,
      contact_phone: candidateInfo.contact_phone,
    };

    // Get email template
    const emailTemplate = EmailService.getOfferLetterTemplate(
      offerData,
      candidateInfo,
      jobDetails
    );

    // Send email
    const mailOptions = {
      from: '"HR Department" <no_reply@multifacet-software.com>',
      to: candidateInfo.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    };

    const emailResult = await EmailService.sendEmail(mailOptions);

    if (emailResult.success) {
      console.log(`Offer letter email sent to ${candidateInfo.email}`);
    } else {
      console.error(
        `Failed to send offer email to ${candidateInfo.email}:`,
        emailResult.error
      );
    }
  } catch (error) {
    console.error("Error sending offer letter email:", error);
    // Don't throw error - email failure shouldn't break the main operation
  }
}

// Helper function to send status update email
async function sendOfferStatusUpdateEmail(offerData, newStatus) {
  try {
    // Fetch current status and candidate details
    const pool = await getConnection();
    const result = await pool
      .request()
      .input("offer_id", sql.Int, offerData.offer_id).query(`
        SELECT o.acceptance_status as old_status, 
               a.candidate_name, a.email, p.job_title,
               c.company_name, c.contact_email
        FROM R08_offer_letters o
        INNER JOIN R03_job_applications a ON o.application_id = a.application_id
        INNER JOIN R02_job_postings p ON a.job_posting_id = p.job_posting_id
        INNER JOIN R01_companies c ON p.company_id = c.company_id
        WHERE o.offer_id = @offer_id
      `);

    if (result.recordset.length === 0) return;

    const {
      old_status,
      candidate_name,
      email,
      job_title,
      company_name,
      contact_email,
    } = result.recordset[0];

    // Only send email if status actually changed
    if (old_status !== newStatus) {
      const emailTemplate = EmailService.getOfferStatusUpdateTemplate(
        offerData,
        { candidate_name, email },
        { company_name, job_title },
        old_status,
        newStatus
      );

      const mailOptions = {
        from: '"HR Department" <no_reply@multifacet-software.com>',
        to: email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      };

      await EmailService.sendEmail(mailOptions);
      console.log(`Offer status update email sent to ${email}`);
    }
  } catch (error) {
    console.error("Error sending status update email:", error);
    // Don't throw error - email failure shouldn't break the main operation
  }
}

module.exports = {
  offerLettersOperations,
};
