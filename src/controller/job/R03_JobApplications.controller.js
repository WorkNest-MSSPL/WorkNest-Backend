const { getConnection, sql } = require("../../config/database.js");
const EmailService = require("../../services/EmailService.js");

const jobApplicationsController = {
  // Create job application
  // createJobApplication: async (req, res) => {
  //   let transaction;
  //   try {
  //     const {
  //       job_posting_id,
  //       candidate_name,
  //       email,
  //       phone,
  //       cover_letter,
  //       profile_img,
  //       resumeBase64,
  //       currlocation,
  //     } = req.body;

  //     // Required field validation
  //     if (!job_posting_id || !candidate_name || !email) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Job posting ID, candidate name, and email are required",
  //       });
  //     }

  //     const pool = await getConnection();

  //     // Start transaction for data consistency
  //     transaction = new sql.Transaction(pool);
  //     await transaction.begin();

  //     // Check if job posting exists and is open
  //     const jobPostingCheck = await pool
  //       .request()
  //       .input("job_posting_id", job_posting_id)
  //       .query(
  //         "SELECT * FROM R02_job_postings WHERE job_posting_id = @job_posting_id AND status = 'Open'"
  //       );

  //     if (jobPostingCheck.recordset.length === 0) {
  //       await transaction.rollback();
  //       return res.status(404).json({
  //         success: false,
  //         message: "Job posting not found or not open for applications",
  //       });
  //     }

  //     // Check if email already applied for this job
  //     const duplicateCheck = await pool
  //       .request()
  //       .input("job_posting_id", job_posting_id)
  //       .input("email", email)
  //       .query(
  //         "SELECT application_id FROM R03_job_applications WHERE job_posting_id = @job_posting_id AND email = @email"
  //       );

  //     if (duplicateCheck.recordset.length > 0) {
  //       await transaction.rollback();
  //       return res.status(409).json({
  //         success: false,
  //         message: "Candidate has already applied for this job posting",
  //       });
  //     }

  //     // Get current datetime for accurate timestamp
  //     const currentDateTime = new Date();
  //     const applicationDate = new Date(
  //       currentDateTime.toISOString().split("T")[0]
  //     ); // Date only for application_date

  //     // Insert job application with explicit timestamps
  //     const result = await pool
  //       .request()
  //       .input("job_posting_id", job_posting_id)
  //       .input("candidate_name", candidate_name)
  //       .input("email", email)
  //       .input("phone", phone || null)
  //       .input("cover_letter", cover_letter || null)
  //       .input("profile_img", profile_img || null)
  //       .input("resumeBase64", resumeBase64 || null)
  //       .input("currlocation", currlocation || null)
  //       .input("application_date", currentDateTime)
  //       .input("created_at", currentDateTime)
  //       .input("updated_at", currentDateTime).query(`
  //         INSERT INTO R03_job_applications
  //         (job_posting_id, candidate_name, email, phone, cover_letter,
  //          profile_img, resumeBase64, currlocation, application_date, created_at, updated_at)
  //         OUTPUT INSERTED.application_id, INSERTED.application_date,
  //                INSERTED.created_at, INSERTED.updated_at
  //         VALUES (@job_posting_id, @candidate_name, @email, @phone, @cover_letter,
  //                 @profile_img, @resumeBase64, @currlocation, @application_date,
  //                 @created_at, @updated_at)
  //       `);

  //     await transaction.commit();

  //     res.status(201).json({
  //       success: true,
  //       message: "Job application submitted successfully",
  //       application: {
  //         application_id: result.recordset[0].application_id,
  //         application_date: result.recordset[0].application_date,
  //         created_at: result.recordset[0].created_at,
  //         updated_at: result.recordset[0].updated_at,
  //       },
  //     });
  //   } catch (error) {
  //     if (transaction) {
  //       try {
  //         await transaction.rollback();
  //       } catch (rollbackError) {
  //         console.error("Transaction rollback error:", rollbackError);
  //       }
  //     }
  //     console.error("Create job application error:", error);
  //     res.status(500).json({
  //       success: false,
  //       message: "Internal server error",
  //       error: error.message,
  //     });
  //   }
  // }

  createJobApplication: async (req, res) => {
    let transaction;
    try {
      const {
        job_posting_id,
        candidate_name,
        email,
        phone,
        cover_letter,
        profile_img,
        resumeBase64,
        currlocation,
      } = req.body;

      // Required field validation
      if (!job_posting_id || !candidate_name || !email) {
        return res.status(400).json({
          success: false,
          message: "Job posting ID, candidate name, and email are required",
        });
      }

      const pool = await getConnection();

      // Start transaction for data consistency
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Check if job posting exists and is open
      const jobPostingCheck = await pool
        .request()
        .input("job_posting_id", job_posting_id)
        .query(
          "SELECT jp.*, cm.company_name FROM R02_job_postings jp " +
            "INNER JOIN M01_company_master cm ON jp.company_id = cm.company_id " +
            "WHERE jp.job_posting_id = @job_posting_id AND jp.status = 'Open'"
        );

      if (jobPostingCheck.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Job posting not found or not open for applications",
        });
      }

      const jobDetails = jobPostingCheck.recordset[0];

      // Check if email already applied for this job
      const duplicateCheck = await pool
        .request()
        .input("job_posting_id", job_posting_id)
        .input("email", email)
        .query(
          "SELECT application_id FROM R03_job_applications WHERE job_posting_id = @job_posting_id AND email = @email"
        );

      if (duplicateCheck.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "Candidate has already applied for this job posting",
        });
      }

      // Get current datetime for accurate timestamp
      const currentDateTime = new Date();
      const applicationDate = new Date(
        currentDateTime.toISOString().split("T")[0]
      ); // Date only for application_date

      // Insert job application with explicit timestamps
      const result = await pool
        .request()
        .input("job_posting_id", job_posting_id)
        .input("candidate_name", candidate_name)
        .input("email", email)
        .input("phone", phone || null)
        .input("cover_letter", cover_letter || null)
        .input("profile_img", profile_img || null)
        .input("resumeBase64", resumeBase64 || null)
        .input("currlocation", currlocation || null)
        .input("application_date", currentDateTime)
        .input("created_at", currentDateTime)
        .input("updated_at", currentDateTime).query(`
        INSERT INTO R03_job_applications 
        (job_posting_id, candidate_name, email, phone, cover_letter, 
         profile_img, resumeBase64, currlocation, application_date, created_at, updated_at)
        OUTPUT INSERTED.application_id, INSERTED.application_date, 
               INSERTED.created_at, INSERTED.updated_at
        VALUES (@job_posting_id, @candidate_name, @email, @phone, @cover_letter, 
                @profile_img, @resumeBase64, @currlocation, @application_date, 
                @created_at, @updated_at)
      `);

      const applicationData = {
        application_id: result.recordset[0].application_id,
        candidate_name,
        email,
        phone,
        currlocation,
        application_date: result.recordset[0].application_date,
      };

      await transaction.commit();

      // Send emails after successful transaction
      try {
        // 1. Send confirmation email to candidate
        const candidateTemplate = EmailService.getCandidateConfirmationTemplate(
          applicationData,
          jobDetails
        );
        await EmailService.sendEmail({
          from: '"Hiring Team" <no_reply@multifacet-software.com>',
          to: email,
          subject: candidateTemplate.subject,
          html: candidateTemplate.html,
        });

        // 2. Send notification to hiring team
        const hiringTemplate = EmailService.getHiringTeamTemplate(
          applicationData,
          jobDetails
        );

        // Prepare resume attachment if available
        const attachments = [];
        if (resumeBase64) {
          attachments.push({
            filename: `Resume_${candidate_name.replace(/\s+/g, "_")}.pdf`,
            content: resumeBase64,
            encoding: "base64",
          });
        }

        await EmailService.sendEmail({
          from: '"Job Portal System" <no_reply@multifacet-software.com>',
          to: "aditya240202@gmail.com", // Replace with actual hiring team email
          subject: hiringTemplate.subject,
          html: hiringTemplate.html,
          attachments: attachments,
        });

        console.log("Application confirmation emails sent successfully");
      } catch (emailError) {
        // Log email error but don't fail the request
        console.error("Email sending failed:", emailError);
      }

      res.status(201).json({
        success: true,
        message: "Job application submitted successfully",
        application: {
          application_id: applicationData.application_id,
          application_date: applicationData.application_date,
          created_at: result.recordset[0].created_at,
          updated_at: result.recordset[0].updated_at,
        },
      });
    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error("Transaction rollback error:", rollbackError);
        }
      }
      console.error("Create job application error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
  // Get all job applications with filters
  getJobApplications: async (req, res) => {
    try {
      const {
        job_posting_id,
        candidate_name,
        email,
        phone,
        application_date_from,
        application_date_to,
        status,
        created_at_from,
        created_at_to,
      } = req.body;

      const pool = await getConnection();
      let request = pool.request();
      let whereConditions = [];
      let query = `
        SELECT 
          app.application_id,
          app.job_posting_id,
          app.candidate_name,
          app.email,
          app.phone,
          app.cover_letter,
          app.application_date,
          app.status,
          app.created_at,
          app.updated_at,
          app.currlocation,
          job.job_title,
          job.location as job_location,
          job.employment_type,
          comp.company_name,
          FORMAT(app.created_at, 'yyyy-MM-dd HH:mm:ss') as formatted_created_at,
          FORMAT(app.updated_at, 'yyyy-MM-dd HH:mm:ss') as formatted_updated_at
        FROM R03_job_applications app
        INNER JOIN R02_job_postings job ON app.job_posting_id = job.job_posting_id
        INNER JOIN M01_company_master comp ON job.company_id = comp.company_id
      `;

      // Add filters
      if (job_posting_id) {
        whereConditions.push("app.job_posting_id = @job_posting_id");
        request.input("job_posting_id", parseInt(job_posting_id));
      }

      if (candidate_name) {
        whereConditions.push("app.candidate_name LIKE @candidate_name");
        request.input("candidate_name", `%${candidate_name}%`);
      }

      if (email) {
        whereConditions.push("app.email = @email");
        request.input("email", email);
      }

      if (phone) {
        whereConditions.push("app.phone LIKE @phone");
        request.input("phone", `%${phone}%`);
      }

      if (application_date_from) {
        whereConditions.push("app.application_date >= @application_date_from");
        request.input("application_date_from", application_date_from);
      }

      if (application_date_to) {
        whereConditions.push("app.application_date <= @application_date_to");
        request.input("application_date_to", application_date_to);
      }

      if (status) {
        whereConditions.push("app.status = @status");
        request.input("status", status);
      }

      // Additional filters for created_at
      if (created_at_from) {
        whereConditions.push("app.created_at >= @created_at_from");
        request.input("created_at_from", `${created_at_from} 00:00:00`);
      }

      if (created_at_to) {
        whereConditions.push("app.created_at <= @created_at_to");
        request.input("created_at_to", `${created_at_to} 23:59:59`);
      }

      // Add WHERE clause if filters exist
      if (whereConditions.length > 0) {
        query += " WHERE " + whereConditions.join(" AND ");
      }

      // Add ORDER BY with precise datetime sorting
      query += " ORDER BY app.created_at DESC, app.application_date DESC";

      const result = await request.query(query);

      res.json({
        success: true,
        applications: result.recordset,
        count: result.recordset.length,
      });
    } catch (error) {
      console.error("Get job applications error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get job application by ID
  getJobApplicationById: async (req, res) => {
    try {
      const { id } = req.params;
      const pool = await getConnection();

      const result = await pool.request().input("application_id", id).query(`
        SELECT 
          app.application_id,
          app.job_posting_id,
          app.candidate_name,
          app.email,
          app.phone,
          app.cover_letter,
          app.application_date,
          app.status,
          app.created_at,
          app.updated_at,
          app.profile_img,
          app.resumeBase64,
          app.currlocation,
          job.job_title,
          job.job_description,
          job.responsibilities,
          job.requirements,
          job.qualifications,
          job.skills_required,
          job.location as job_location,
          job.employment_type,
          comp.company_name,
          comp.company_id,
          FORMAT(app.created_at, 'yyyy-MM-dd HH:mm:ss') as formatted_created_at,
          FORMAT(app.updated_at, 'yyyy-MM-dd HH:mm:ss') as formatted_updated_at
        FROM R03_job_applications app
        INNER JOIN R02_job_postings job ON app.job_posting_id = job.job_posting_id
        INNER JOIN M01_company_master comp ON job.company_id = comp.company_id
        WHERE app.application_id = @application_id
      `);

      if (result.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job application not found",
        });
      }

      res.json({
        success: true,
        application: result.recordset[0],
      });
    } catch (error) {
      console.error("Get job application error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Utility function to get current datetime in SQL Server format
  getCurrentDateTime: () => {
    const now = new Date();
    return now.toISOString().slice(0, 19).replace("T", " ");
  },
};

module.exports = jobApplicationsController;

// const { getConnection, sql } = require("../../config/database.js");
// const path = require("path");
// const { validateLicense } = require(path.join(__dirname, "checker.obf"));
// const { getUserId } = require("../../utils/UserInfo.js");

// const jobApplicationOperations = async (req, res) => {
//   const {
//     type,
//     application_id,
//     job_posting_id,
//     candidate_name,
//     email,
//     phone,
//     resume_url,
//     cover_letter,
//     application_date,
//     status,
//     skills = [],
//   } = req.body;

//   try {
//     validateLicense();

//     // Get user ID from the request
//     const userId = getUserId(req);
//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "User authentication required",
//       });
//     }

//     const pool = await getConnection();

//     // Create TVP for skills
//     const skillsTVP = new sql.Table();
//     skillsTVP.columns.add("skill_id", sql.Int);
//     skillsTVP.columns.add("skill_level", sql.NVarChar(50));

//     // Add skills to TVP
//     skills.forEach((skill) => {
//       skillsTVP.rows.add(skill.skill_id, skill.skill_level);
//     });

//     const result = await pool
//       .request()
//       .input("type", sql.Int, type)
//       .input("application_id", sql.Int, application_id || null)
//       .input("job_posting_id", sql.Int, job_posting_id || null)
//       .input("candidate_name", sql.NVarChar(200), candidate_name || null)
//       .input("email", sql.NVarChar(200), email || null)
//       .input("phone", sql.NVarChar(20), phone || null)
//       .input("resume_url", sql.NVarChar(500), resume_url || null)
//       .input("cover_letter", sql.NVarChar(sql.MAX), cover_letter || null)
//       .input("application_date", sql.Date, application_date || null)
//       .input("status", sql.NVarChar(20), status || null)
//       .input("skills", skillsTVP)
//       .execute("USP_ManageJobApplications");

//     // Handle response based on operation type
//     let success = false;
//     let message = "";
//     let data = null;
//     let statusCode = 200;

//     // Check if we have any recordsets
//     if (result.recordsets && result.recordsets.length > 0) {
//       const firstRecordset = result.recordsets[0];

//       // For type 1 (insert), we get application_id directly
//       if (type === 1 && firstRecordset.length > 0) {
//         success = true;
//         data = firstRecordset[0];
//         message = "Application created successfully";
//         statusCode = 201;
//       }
//       // For type 2, 4 (update operations)
//       else if ((type === 2 || type === 4) && firstRecordset.length > 0) {
//         success = true;
//         message =
//           firstRecordset[0].message || "Operation completed successfully";
//       }
//       // For type 3, 5, 6 (select operations)
//       else if (
//         (type === 3 || type === 5 || type === 6) &&
//         firstRecordset.length > 0
//       ) {
//         success = true;

//         // Parse skills JSON string to array
//         const applications = firstRecordset.map((app) => {
//           if (app.skills) {
//             try {
//               app.skills = JSON.parse(app.skills);
//             } catch (e) {
//               app.skills = [];
//             }
//           } else {
//             app.skills = [];
//           }
//           return app;
//         });

//         data = type === 3 ? applications[0] : applications;
//         message = "Data retrieved successfully";
//       }
//     }

//     // Handle empty results for select operations
//     if (
//       (type === 3 || type === 5 || type === 6) &&
//       (!data || (Array.isArray(data) && data.length === 0))
//     ) {
//       success = true;
//       message = "No applications found";
//       data = type === 3 ? null : [];
//     }

//     // Set appropriate HTTP status code for errors
//     if (!success) {
//       statusCode = 400;
//     }

//     res.status(statusCode).json({
//       success,
//       message,
//       data,
//     });
//   } catch (error) {
//     console.error(
//       "Error executing USP_ManageJobApplications procedure:",
//       error
//     );

//     // Handle specific error cases
//     if (error.message?.includes("License validation failed")) {
//       return res.status(403).json({
//         success: false,
//         message: "License validation failed",
//       });
//     }

//     // Handle database validation errors
//     if (
//       error.message?.includes("invalid") ||
//       error.message?.includes("Invalid")
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: error.message,
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
//   jobApplicationOperations,
// };
