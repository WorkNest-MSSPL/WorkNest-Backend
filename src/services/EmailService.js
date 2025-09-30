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

  // Offer Letter Delivery Template
  getOfferLetterTemplate(offerData, candidateData, jobDetails) {
    const formattedSalary = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(offerData.offered_salary);

    const formattedDate = new Date(offerData.offer_date).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    return {
      subject: `Offer Letter: ${offerData.offered_position} at ${jobDetails.company_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 700px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background-color: #f8f9fa; border-radius: 0 0 10px 10px; }
            .offer-details { background-color: white; padding: 25px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .footer { background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 8px; margin-top: 20px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .detail-item { background-color: #f8f9fa; padding: 12px; border-radius: 5px; border-left: 4px solid #667eea; }
            @media (max-width: 600px) {
              .details-grid { grid-template-columns: 1fr; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Congratulations!</h1>
              <h2>Offer of Employment</h2>
              <p>${jobDetails.company_name} is pleased to extend this offer</p>
            </div>
            
            <div class="content">
              <p>Dear <strong>${candidateData.candidate_name}</strong>,</p>
              
              <p>We are delighted to offer you the position of <strong>${
                offerData.offered_position
              }</strong> at <strong>${
        jobDetails.company_name
      }</strong>. After careful consideration, we believe your skills and experience will be a valuable addition to our team.</p>
              
              <div class="offer-details">
                <h3 style="color: #667eea; margin-top: 0;">Offer Details</h3>
                
                <div class="details-grid">
                  <div class="detail-item">
                    <strong>Position:</strong><br>
                    ${offerData.offered_position}
                  </div>
                  <div class="detail-item">
                    <strong>Annual Salary:</strong><br>
                    ${formattedSalary}
                  </div>
                  <div class="detail-item">
                    <strong>Offer Date:</strong><br>
                    ${formattedDate}
                  </div>
                  <div class="detail-item">
                    <strong>Offer ID:</strong><br>
                    #${offerData.offer_id}
                  </div>
                </div>
                
                <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin-top: 20px;">
                  <h4 style="color: #2e7d32; margin-top: 0;">Next Steps</h4>
                  <p>Please review the attached offer letter document and respond to this offer by clicking the button below:</p>
                  
                  <div style="text-align: center;">
                    <a href="${
                      process.env.PORTAL_URL || "https://your-portal.com"
                    }/offer-response/${offerData.offer_id}" class="cta-button">
                      Review & Respond to Offer
                    </a>
                  </div>
                </div>
              </div>
              
              <p><strong>Important Documents:</strong></p>
              <ul>
                <li>📄 <a href="${
                  offerData.document_url
                }" style="color: #667eea;">Download Official Offer Letter</a></li>
                <li>📋 Company Policies & Benefits Overview</li>
                <li>📝 Onboarding Checklist</li>
              </ul>
              
              <p>We are excited about the possibility of you joining our team and look forward to your positive response.</p>
              
              <p>Best regards,<br>
              <strong>${
                jobDetails.hiring_manager || "Hiring Manager"
              }</strong><br>
              <strong>${jobDetails.company_name}</strong><br>
              📞 ${jobDetails.contact_phone || "Contact HR Department"}<br>
              📧 ${jobDetails.contact_email || "hr@company.com"}</p>
            </div>
            
            <div class="footer">
              <p>This offer is contingent upon satisfactory completion of background checks and other pre-employment requirements.</p>
              <p style="font-size: 12px; opacity: 0.8;">
                ${jobDetails.company_name} • ${
        jobDetails.company_address || "Corporate Office"
      }<br>
                © ${new Date().getFullYear()} ${
        jobDetails.company_name
      }. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  // Offer Status Update Template
  getOfferStatusUpdateTemplate(
    offerData,
    candidateData,
    jobDetails,
    oldStatus,
    newStatus
  ) {
    const statusColors = {
      Pending: "#ff9800",
      Accepted: "#4caf50",
      Rejected: "#f44336",
      Negotiating: "#2196f3",
      Expired: "#9e9e9e",
      Withdrawn: "#607d8b",
    };

    return {
      subject: `Offer Status Updated: ${offerData.offered_position} - ${newStatus}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 5px; }
            .content { padding: 20px; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; }
            .details { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Offer Status Update</h2>
            </div>
            <div class="content">
              <p>Dear ${candidateData.candidate_name},</p>
              
              <p>The status of your offer for <strong>${
                offerData.offered_position
              }</strong> at <strong>${
        jobDetails.company_name
      }</strong> has been updated.</p>
              
              <div class="details">
                <p><strong>Status Change:</strong></p>
                <p>
                  <span class="status-badge" style="background-color: ${
                    statusColors[oldStatus]
                  }">${oldStatus}</span>
                  → 
                  <span class="status-badge" style="background-color: ${
                    statusColors[newStatus]
                  }">${newStatus}</span>
                </p>
                
                <p><strong>Offer Details:</strong></p>
                <ul>
                  <li><strong>Position:</strong> ${
                    offerData.offered_position
                  }</li>
                  <li><strong>Offer ID:</strong> #${offerData.offer_id}</li>
                  <li><strong>Update Date:</strong> ${new Date().toLocaleDateString()}</li>
                </ul>
              </div>
              
              ${
                newStatus === "Accepted"
                  ? `
              <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3 style="color: #2e7d32; margin-top: 0;">Welcome to the Team! 🎉</h3>
                <p>We're thrilled to have you on board! Our HR team will contact you shortly with onboarding details.</p>
              </div>
              `
                  : ""
              }
              
              ${
                newStatus === "Rejected"
                  ? `
              <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p>Thank you for your consideration. We appreciate your interest in ${jobDetails.company_name} and wish you the best in your job search.</p>
              </div>
              `
                  : ""
              }
              
              <p>If you have any questions, please contact our HR department.</p>
              
              <p>Best regards,<br>${jobDetails.company_name} Hiring Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }
}

module.exports = new EmailService();
