const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

// ✅ 1. GET resumes with filters + job posting info
const getResumes = async (req, res) => {
  const {
    application_id,
    job_posting_id,
    start_date,
    end_date,
    min_ats_score,
  } = req.query;

  try {
    validateLicense();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pool = await getConnection();

    let query = `
      SELECT 
        a.application_id,
        a.job_posting_id,
        a.candidate_name,
        a.email,
        a.phone,
        a.status,
        a.application_date,
        r.ats_score,
        p.job_title,
        p.location,
        p.employment_type,
        p.department_id,
        p.posted_date,
        p.closing_date
      FROM R03_job_applications a
      LEFT JOIN R11_resumes r ON a.application_id = r.application_id
      LEFT JOIN R02_job_postings p ON a.job_posting_id = p.job_posting_id
      WHERE 1=1
    `;

    if (application_id) query += ` AND a.application_id = @application_id`;
    if (job_posting_id) query += ` AND a.job_posting_id = @job_posting_id`;
    if (start_date && end_date)
      query += ` AND a.application_date BETWEEN @start_date AND @end_date`;
    if (min_ats_score) query += ` AND r.ats_score >= @min_ats_score`;

    const request = pool.request();
    if (application_id)
      request.input("application_id", sql.Int, application_id);
    if (job_posting_id)
      request.input("job_posting_id", sql.Int, job_posting_id);
    if (start_date) request.input("start_date", sql.Date, start_date);
    if (end_date) request.input("end_date", sql.Date, end_date);
    if (min_ats_score) request.input("min_ats_score", sql.Float, min_ats_score);

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: result.recordset.length
        ? "Resumes fetched successfully"
        : "No resumes found",
      total: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ✅ 2. GET resume by application_id + full profile + base64 resume + job post info
const getResumeById = async (req, res) => {
  const { application_id } = req.params;

  try {
    const pool = await getConnection();

    const result = await pool
      .request()
      .input("application_id", sql.Int, application_id).query(`
        SELECT 
          a.application_id,
          a.job_posting_id,
          a.candidate_name,
          a.email,
          a.phone,
          a.status,
          a.currlocation,
          a.cover_letter,
          a.profile_img,
          a.resumeBase64,
          a.application_date,
          r.education,
          r.experience_years,
          r.designation,
          r.previous_company,
          r.previous_company_location,
          r.previous_role,
          r.skills,
          r.certifications,
          r.extracurricular_activities,
          r.ats_score,
          s.total_score,
          s.skills_match_score,
          s.experience_score,
          s.education_score,
          s.certifications_score,
          s.extracurricular_score,
          s.matched_skills,
          s.unmatched_skills,
          p.job_title,
          p.location,
          p.employment_type,
          p.department_id,
          p.posted_date,
          p.closing_date,
          p.description,
          p.skills_required
        FROM R03_job_applications a
        LEFT JOIN R11_resumes r ON a.application_id = r.application_id
        LEFT JOIN R12_ats_score_results s ON r.id = s.resume_id
        LEFT JOIN R02_job_postings p ON a.job_posting_id = p.job_posting_id
        WHERE a.application_id = @application_id
      `);

    const resume = result.recordset[0];
    if (!resume) {
      return res
        .status(404)
        .json({ success: false, message: "Resume not found" });
    }

    res.status(200).json({ success: true, data: resume });
  } catch (error) {
    console.error("Error fetching resume by ID:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ✅ 3. UPDATE status (direct query, no SP)
const updateResumeStatus = async (req, res) => {
  const { application_id } = req.params;
  const { status } = req.body;

  const allowedStatuses = [
    "Received",
    "Shortlisted",
    "Interview",
    "Offered",
    "Rejected",
    "Hired",
  ];

  if (!allowedStatuses.includes(status)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status value" });
  }

  try {
    const pool = await getConnection();

    await pool
      .request()
      .input("application_id", sql.Int, application_id)
      .input("status", sql.NVarChar(20), status).query(`
        UPDATE R03_job_applications
        SET status = @status,
            updated_at = GETDATE()
        WHERE application_id = @application_id
      `);

    res.status(200).json({
      success: true,
      message: `Status updated to ${status} for application_id ${application_id}`,
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  getResumes,
  getResumeById,
  updateResumeStatus,
};

// const { getConnection, sql } = require("../../config/database.js");
// const path = require("path");
// const { validateLicense } = require(path.join(__dirname, "checker.obf"));
// const { getUserId } = require("../../utils/UserInfo.js");

// const resumeOperations = async (req, res) => {
//   const {
//     job_posting_id,
//     start_date,
//     end_date,
//     min_ats_score,
//     selected_candidates = [], // from frontend
//   } = req.body;

//   const {
//     page = 1,
//     pageSize = 10,
//     sortBy = "ats_score",
//     sortOrder = "desc",
//   } = req.query;

//   //Allowed statuses - add dropdown in frontend
//   const allowedStatuses = [
//     "Received",
//     "Shortlisted",
//     "Interview",
//     "Offered",
//     "Rejected",
//     "Hired",
//   ];

//   try {
//     //license check
//     validateLicense();

//     //auth
//     const userId = getUserId(req);
//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "User authentication required",
//       });
//     }

//     //Database
//     const pool = await getConnection();

//     //Fetch resumes from stored procedure
//     const result = await pool
//       .request()
//       .input("job_posting_id", sql.Int, job_posting_id || null)
//       .input("start_date", sql.Date, start_date || null)
//       .input("end_date", sql.Date, end_date || null)
//       .execute("usp_R11_get_resumes_by_date_and_job");

//     let data = result.recordset || [];

//     //filter by ats score
//     if (min_ats_score !== undefined && !isNaN(min_ats_score)) {
//       data = data.filter(
//         (r) =>
//           r.ats_score !== null &&
//           parseFloat(r.ats_score) >= parseFloat(min_ats_score)
//       );
//     }

//     // addingSorting
//     data.sort((a, b) => {
//       const aValue = a[sortBy];
//       const bValue = b[sortBy];

//       if (aValue == null) return 1;
//       if (bValue == null) return -1;

//       if (typeof aValue === "string") {
//         return sortOrder === "asc"
//           ? aValue.localeCompare(bValue)
//           : bValue.localeCompare(aValue);
//       }

//       return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
//     });

//     //   pagination status
//     const total = data.length;
//     const startIndex = (parseInt(page) - 1) * parseInt(pageSize);
//     const endIndex = startIndex + parseInt(pageSize);
//     const paginatedData = data.slice(startIndex, endIndex);

//     //Update status of selected candidates
//     let updatedCount = 0;

//     for (const candidate of selected_candidates) {
//       const { application_id, status } = candidate;

//       if (!application_id || !status) continue;

//       if (!allowedStatuses.includes(status)) {
//         console.warn(
//           `Invalid status "${status}" for application_id ${application_id}`
//         );
//         continue; //skip invalid code
//       }

//       await pool
//         .request()
//         .input("application_id", sql.Int, application_id)
//         .input("status", sql.NVarChar(20), status).query(`
//           UPDATE R03_job_applications
//           SET status = @status,
//               updated_at = GETDATE()
//           WHERE application_id = @application_id
//         `);

//       updatedCount++;
//     }

//     //get teh final response
//     res.status(200).json({
//       success: true,
//       message: paginatedData.length
//         ? "Resumes fetched successfully"
//         : "No resumes found for the given filters",
//       total,
//       page: parseInt(page),
//       pageSize: parseInt(pageSize),
//       updatedCandidates: updatedCount,
//       data: paginatedData,
//     });
//   } catch (error) {
//     console.error("Error in resumeOperations:", error);

//     if (error.message?.includes("License validation failed")) {
//       return res.status(403).json({
//         success: false,
//         message: "License validation failed",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };
// // get info through application id
// const getResumeById = async (req, res) => {
//   const { application_id } = req.params;

//   try {
//     const pool = await getConnection();

//     const result = await pool
//       .request()
//       .input("application_id", sql.Int, application_id).query(`
//         SELECT * FROM R03_job_applications WHERE application_id = @application_id
//       `);

//     const resume = result.recordset[0];

//     if (!resume) {
//       return res.status(404).json({
//         success: false,
//         message: "Resume not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: resume,
//     });
//   } catch (error) {
//     console.error("Error fetching resume by ID:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };
// // update
// const updateResumeById = async (req, res) => {
//   const { application_id } = req.params;
//   const {
//     candidate_name,
//     email,
//     phone,
//     status,
//     currlocation,
//     cover_letter,
//     resume_url,
//   } = req.body;

//   const allowedStatuses = [
//     "Received",
//     "Shortlisted",
//     "Interview",
//     "Offered",
//     "Rejected",
//     "Hired",
//   ];

//   if (status && !allowedStatuses.includes(status)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid status value",
//     });
//   }

//   try {
//     const pool = await getConnection();

//     await pool
//       .request()
//       .input("application_id", sql.Int, application_id)
//       .input("candidate_name", sql.NVarChar(200), candidate_name || null)
//       .input("email", sql.NVarChar(200), email || null)
//       .input("phone", sql.NVarChar(20), phone || null)
//       .input("status", sql.NVarChar(20), status || null)
//       .input("currlocation", sql.NVarChar(200), currlocation || null)
//       .input("cover_letter", sql.NVarChar(sql.MAX), cover_letter || null)
//       .input("resume_url", sql.NVarChar(500), resume_url || null).query(`
//         UPDATE R03_job_applications
//         SET
//           candidate_name = ISNULL(@candidate_name, candidate_name),
//           email = ISNULL(@email, email),
//           phone = ISNULL(@phone, phone),
//           status = ISNULL(@status, status),
//           currlocation = ISNULL(@currlocation, currlocation),
//           cover_letter = ISNULL(@cover_letter, cover_letter),
//           resume_url = ISNULL(@resume_url, resume_url),
//           updated_at = GETDATE()
//         WHERE application_id = @application_id
//       `);

//     res.status(200).json({
//       success: true,
//       message: "Resume updated successfully ",
//     });
//   } catch (error) {
//     console.error("Error updating resume:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };

// module.exports = {
//   resumeOperations,
//   getResumeById,
//   updateResumeById,
// };
