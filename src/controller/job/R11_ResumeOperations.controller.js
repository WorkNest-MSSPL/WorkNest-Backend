const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const resumeOperations = async (req, res) => {
  const {
    job_posting_id,
    start_date,
    end_date,
    min_ats_score,
    selected_candidates = [] // from frontend
  } = req.body;

  const {
    page = 1,
    pageSize = 10,
    sortBy = "ats_score",
    sortOrder = "desc"
  } = req.query;

  //Allowed statuses - add dropdown in frontend
  const allowedStatuses = [
    "Received",
    "Shortlisted",
    "Interview",
    "Offered",
    "Rejected",
    "Hired"
  ];

  try {
    //license check
    validateLicense();

    //auth
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    //Database
    const pool = await getConnection();

    //Fetch resumes from stored procedure
    const result = await pool
      .request()
      .input("job_posting_id", sql.Int, job_posting_id || null)
      .input("start_date", sql.Date, start_date || null)
      .input("end_date", sql.Date, end_date || null)
      .execute("usp_R11_get_resumes_by_date_and_job");

    let data = result.recordset || [];

    //filter by ats score
    if (min_ats_score !== undefined && !isNaN(min_ats_score)) {
      data = data.filter(r =>
        r.ats_score !== null && parseFloat(r.ats_score) >= parseFloat(min_ats_score)
      );
    }

    // addingSorting
    data.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === 'string') {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortOrder === "asc"
        ? aValue - bValue
        : bValue - aValue;
    });

    //   pagination status
    const total = data.length;
    const startIndex = (parseInt(page) - 1) * parseInt(pageSize);
    const endIndex = startIndex + parseInt(pageSize);
    const paginatedData = data.slice(startIndex, endIndex);

    //Update status of selected candidates
    let updatedCount = 0;

    for (const candidate of selected_candidates) {
      const { application_id, status } = candidate;

      if (!application_id || !status) continue;

      if (!allowedStatuses.includes(status)) {
        console.warn(`Invalid status "${status}" for application_id ${application_id}`);
        continue; //skip invalid code
      }

      await pool.request()
        .input("application_id", sql.Int, application_id)
        .input("status", sql.NVarChar(20), status)
        .query(`
          UPDATE R03_job_applications
          SET status = @status,
              updated_at = GETDATE()
          WHERE application_id = @application_id
        `);

      updatedCount++;
    }

    //get teh final response
    res.status(200).json({
      success: true,
      message: paginatedData.length
        ? "Resumes fetched successfully"
        : "No resumes found for the given filters",
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      updatedCandidates: updatedCount,
      data: paginatedData
    });

  } catch (error) {
    console.error("Error in resumeOperations:", error);

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
  resumeOperations,
};
