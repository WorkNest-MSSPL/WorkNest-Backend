const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

const getAttendanceData = async (req, res) => {
  const {
    start_date,
    end_date,
    employee_ids,
    shift_ids,
    statuses,
    min_work_duration,
    max_work_duration,
    include_multiple_punches,
    sort_column = "attendance_date",
    sort_order = "ASC",
    page_number = 1,
    page_size = 1000,
  } = req.body;

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

    const result = await pool
      .request()
      .input("StartDate", sql.Date, start_date || null)
      .input("EndDate", sql.Date, end_date || null)
      .input("EmployeeIDs", sql.NVarChar(sql.MAX), employee_ids || null)
      .input("ShiftIDs", sql.NVarChar(sql.MAX), shift_ids || null)
      .input("Statuses", sql.NVarChar(sql.MAX), statuses || null)
      .input("MinWorkDuration", sql.Int, min_work_duration || null)
      .input("MaxWorkDuration", sql.Int, max_work_duration || null)
      .input(
        "IncludeMultiplePunches",
        sql.Bit,
        include_multiple_punches || null
      )
      .input("SortColumn", sql.NVarChar(50), sort_column)
      .input("SortOrder", sql.NVarChar(4), sort_order)
      .input("PageNumber", sql.Int, page_number)
      .input("PageSize", sql.Int, page_size)
      .execute("usp_GetAttendanceDataForVisualization");

    let data = [];
    let totalRecords = 0;

    if (result.recordsets && result.recordsets.length > 0) {
      data = result.recordsets[0];

      // Extract total records from first row if available
      if (data.length > 0 && data[0].TotalRecords) {
        totalRecords = data[0].TotalRecords;

        // Remove TotalRecords from each row for cleaner response
        data = data.map(({ TotalRecords, ...rest }) => rest);
      }
    }

    res.status(200).json({
      success: true,
      message: "Attendance data retrieved successfully",
      data: {
        records: data,
        pagination: {
          page: parseInt(page_number),
          page_size: parseInt(page_size),
          total_records: totalRecords,
          total_pages: Math.ceil(totalRecords / page_size),
        },
      },
    });
  } catch (error) {
    console.error("Error executing attendance visualization procedure:", error);

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

const getAttendanceSummary = async (req, res) => {
  const { start_date, end_date, employee_ids, shift_ids } = req.body;

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

    const result = await pool
      .request()
      .input("StartDate", sql.Date, start_date || null)
      .input("EndDate", sql.Date, end_date || null)
      .input("EmployeeIDs", sql.NVarChar(sql.MAX), employee_ids || null)
      .input("ShiftIDs", sql.NVarChar(sql.MAX), shift_ids || null)
      .execute("usp_GetAttendanceSummaryForVisualization");

    // The summary procedure returns multiple recordsets
    const [statusSummary, dailyTrend, workDurationStats] = result.recordsets;

    res.status(200).json({
      success: true,
      message: "Attendance summary retrieved successfully",
      data: {
        status_summary: statusSummary || [],
        daily_trend: dailyTrend || [],
        work_duration_stats: workDurationStats || [],
      },
    });
  } catch (error) {
    console.error("Error executing attendance summary procedure:", error);

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
  getAttendanceData,
  getAttendanceSummary,
};
