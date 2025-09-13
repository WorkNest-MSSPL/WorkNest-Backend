// services/EmailService.js
const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: "webmail.multifacet-software.com", // Your webmail host
      port: 587, // Typically 587 for TLS, 465 for SSL
      secure: false, // true for 465, false for other ports
      auth: {
        user: "no_reply@multifacet-software.com",
        pass: "R#msspl109",
      },
      debug: true,
      logger: true,
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false,
      },
    });
  }
  // Send email method
  async sendEmail(mailOptions) {
    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Email sent: %s", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Error sending email:", error);
      return { success: false, error: error.message };
    }
  }

  // Candidate confirmation email template
  getCandidateConfirmationTemplate(applicationData, jobDetails) {
    return {
      subject: `Application Confirmation: ${jobDetails.job_title} at ${jobDetails.company_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 5px; }
            .content { padding: 20px; }
            .footer { background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; border-radius: 5px; }
            .details { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Application Received</h2>
            </div>
            <div class="content">
              <p>Dear ${applicationData.candidate_name},</p>
              <p>Thank you for applying for the <strong>${
                jobDetails.job_title
              }</strong> position at <strong>${
        jobDetails.company_name
      }</strong>.</p>
              <p>We have received your application and will review it carefully. If your qualifications match our requirements, we will contact you for the next steps in the hiring process.</p>
              
              <div class="details">
                <p><strong>Application Details:</strong></p>
                <ul>
                  <li><strong>Position:</strong> ${jobDetails.job_title}</li>
                  <li><strong>Company:</strong> ${jobDetails.company_name}</li>
                  <li><strong>Application Date:</strong> ${new Date(
                    applicationData.application_date
                  ).toLocaleDateString()}</li>
                  <li><strong>Application ID:</strong> ${
                    applicationData.application_id
                  }</li>
                </ul>
              </div>
              
              <p>Best regards,<br>${jobDetails.company_name} Hiring Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  // Hiring team notification template
  getHiringTeamTemplate(applicationData, jobDetails) {
    return {
      subject: `New Application: ${applicationData.candidate_name} for ${jobDetails.job_title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #e8f4fc; padding: 20px; text-align: center; border-radius: 5px; }
            .content { padding: 20px; }
            .footer { background-color: #e8f4fc; padding: 10px; text-align: center; font-size: 12px; border-radius: 5px; }
            .candidate-info { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Job Application</h2>
            </div>
            <div class="content">
              <p>A new application has been submitted for the <strong>${
                jobDetails.job_title
              }</strong> position.</p>
              
              <div class="candidate-info">
                <p><strong>Candidate Details:</strong></p>
                <ul>
                  <li><strong>Name:</strong> ${
                    applicationData.candidate_name
                  }</li>
                  <li><strong>Email:</strong> ${applicationData.email}</li>
                  <li><strong>Phone:</strong> ${
                    applicationData.phone || "Not provided"
                  }</li>
                  <li><strong>Location:</strong> ${
                    applicationData.currlocation || "Not provided"
                  }</li>
                  <li><strong>Application Date:</strong> ${new Date(
                    applicationData.application_date
                  ).toLocaleDateString()}</li>
                  <li><strong>Application ID:</strong> ${
                    applicationData.application_id
                  }</li>
                </ul>
              </div>
              
              <p>Please review this application in the hiring portal.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from the hiring system.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }
}

module.exports = new EmailService();
