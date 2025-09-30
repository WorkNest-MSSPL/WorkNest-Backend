const { getConnection, sql } = require("../../config/database.js");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));
const { getUserId } = require("../../utils/UserInfo.js");

// ✅ 1. GET Comprehensive Dashboard Data (FIXED)
const getDashboardData = async (req, res) => {
  const {
    timeframe = "month",
    start_date,
    end_date,
    department_id,
  } = req.query;

  try {
    validateLicense();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pool = await getConnection();

    // Set date range based on timeframe
    let dateFilter = "";
    let dateParams = {};

    if (start_date && end_date) {
      dateFilter = `AND date >= @start_date AND date <= @end_date`;
      dateParams = {
        start_date: sql.Date(start_date),
        end_date: sql.Date(end_date),
      };
    } else {
      const { startDate, endDate } = getDateRange(timeframe);
      dateFilter = `AND date >= @start_date AND date <= @end_date`;
      dateParams = {
        start_date: sql.Date(startDate),
        end_date: sql.Date(endDate),
      };
    }

    const request = pool.request();
    Object.keys(dateParams).forEach((key) => {
      request.input(key, dateParams[key].type, dateParams[key].value);
    });
    if (department_id) {
      request.input("department_id", sql.Int, department_id);
    }

    // 1. Hiring Process Metrics (FIXED - No ambiguous columns)
    const hiringMetrics = await request.query(`
      SELECT 
        -- Application Statistics
        (SELECT COUNT(*) FROM R03_job_applications 
         WHERE application_date BETWEEN @start_date AND @end_date) as total_applications,
        
        (SELECT COUNT(*) FROM R03_job_applications 
         WHERE status = 'Hired' AND application_date BETWEEN @start_date AND @end_date) as hired_candidates,
        
        (SELECT COUNT(*) FROM R02_job_postings 
         WHERE posted_date BETWEEN @start_date AND @end_date) as new_job_postings,
        
        (SELECT COUNT(*) FROM R02_job_postings 
         WHERE status = 'Open') as active_jobs,
        
        -- Status Distribution
        (SELECT COUNT(*) FROM R03_job_applications WHERE status = 'Received') as received,
        (SELECT COUNT(*) FROM R03_job_applications WHERE status = 'Shortlisted') as shortlisted,
        (SELECT COUNT(*) FROM R03_job_applications WHERE status = 'Interview') as interview,
        (SELECT COUNT(*) FROM R03_job_applications WHERE status = 'Offered') as offered,
        (SELECT COUNT(*) FROM R03_job_applications WHERE status = 'Rejected') as rejected,
        (SELECT COUNT(*) FROM R03_job_applications WHERE status = 'Hired') as hired
    `);

    // 2. Attendance Metrics (FIXED - Added table aliases)
    let attendanceQuery = `
      SELECT 
        -- Attendance Statistics
        COUNT(*) as total_records,
        SUM(CASE WHEN ap.status = 'Present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ap.status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ap.status = 'Half-Day' THEN 1 ELSE 0 END) as half_day_count,
        SUM(CASE WHEN ap.status = 'Overtime' THEN 1 ELSE 0 END) as overtime_count,
        
        -- Average Work Duration
        AVG(CAST(ap.total_work_duration_minutes as FLOAT)) as avg_work_duration,
        
        -- Department-wise breakdown
        em.department_id,
        dm.department_name,
        COUNT(*) as dept_total,
        SUM(CASE WHEN ap.status = 'Present' THEN 1 ELSE 0 END) as dept_present
      FROM A02_attendance_processed ap
      INNER JOIN E01_employee_master em ON ap.emp_id = em.employee_id
      LEFT JOIN M02_department_master dm ON em.department_id = dm.department_id
      WHERE ap.attendance_date BETWEEN @start_date AND @end_date
    `;

    if (department_id) {
      attendanceQuery += ` AND em.department_id = @department_id`;
    }

    attendanceQuery += ` GROUP BY em.department_id, dm.department_name ORDER BY dept_total DESC`;

    const attendanceMetrics = await request.query(attendanceQuery);

    // 3. Project Management Metrics (FIXED)
    const projectMetrics = await request.query(`
      SELECT 
        -- Project Statistics
        (SELECT COUNT(*) FROM M25_project_master 
         WHERE start_date BETWEEN @start_date AND @end_date) as new_projects,
        
        (SELECT COUNT(*) FROM M25_project_master WHERE status = 1) as active_projects,
        (SELECT COUNT(*) FROM M25_project_master WHERE status = 0) as completed_projects,
        
        -- Team Allocation
        (SELECT COUNT(DISTINCT employee_id) FROM M26_project_members 
         WHERE status = 1) as employees_on_projects,
        
        -- Budget Overview
        ISNULL(SUM(total_budget), 0) as total_budget,
        AVG(CAST(total_budget as FLOAT)) as avg_project_budget
      FROM M25_project_master
      WHERE start_date BETWEEN @start_date AND @end_date
    `);

    // 4. Task Management Metrics (FIXED - Added table alias)
    const taskMetrics = await request.query(`
      SELECT 
        -- Task Statistics
        COUNT(*) as total_tasks,
        SUM(CASE WHEN tm.status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN tm.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN tm.status = 'Pending' THEN 1 ELSE 0 END) as pending_tasks,
        SUM(CASE WHEN tm.status = 'On Hold' THEN 1 ELSE 0 END) as on_hold_tasks,
        
        -- Priority Distribution
        SUM(CASE WHEN tm.priority = 'High' THEN 1 ELSE 0 END) as high_priority,
        SUM(CASE WHEN tm.priority = 'Medium' THEN 1 ELSE 0 END) as medium_priority,
        SUM(CASE WHEN tm.priority = 'Low' THEN 1 ELSE 0 END) as low_priority,
        
        -- Overdue Tasks
        SUM(CASE WHEN tm.due_date < CAST(GETDATE() AS DATE) AND tm.status NOT IN ('Completed', 'Closed') THEN 1 ELSE 0 END) as overdue_tasks
      FROM T01_task_master tm
      WHERE tm.start_date BETWEEN @start_date AND @end_date
    `);

    // 5. DAR Metrics (FIXED - Added table alias)
    const darMetrics = await request.query(`
      SELECT 
        -- DAR Statistics
        COUNT(*) as total_dars,
        SUM(CASE WHEN dm.status = 'Approved' THEN 1 ELSE 0 END) as approved_dars,
        SUM(CASE WHEN dm.status = 'Submitted' THEN 1 ELSE 0 END) as submitted_dars,
        SUM(CASE WHEN dm.status = 'Draft' THEN 1 ELSE 0 END) as draft_dars,
        SUM(CASE WHEN dm.status = 'Rejected' THEN 1 ELSE 0 END) as rejected_dars,
        
        -- Hours Tracking
        ISNULL(SUM(dt.hours_spent), 0) as total_hours_logged,
        AVG(CAST(dt.hours_spent as FLOAT)) as avg_hours_per_dar
      FROM T04_dar_master dm
      LEFT JOIN T05_dar_tasks dt ON dm.dar_id = dt.dar_id
      WHERE dm.report_date BETWEEN @start_date AND @end_date
    `);

    // 6. Visitor Management Metrics (FIXED)
    const visitorMetrics = await request.query(`
      SELECT 
        -- Visitor Statistics
        (SELECT COUNT(*) FROM V01_visitor_master 
         WHERE created_at BETWEEN @start_date AND @end_date) as new_visitors,
        
        -- Today's Activity
        (SELECT COUNT(*) FROM V03_visitor_checkin 
         WHERE CAST(checkin_time AS DATE) = CAST(GETDATE() AS DATE)) as today_checkins,
        
        (SELECT COUNT(*) FROM V04_visitor_checkout co
         INNER JOIN V03_visitor_checkin ci ON co.checkin_id = ci.checkin_id
         WHERE CAST(co.checkout_time AS DATE) = CAST(GETDATE() AS DATE)) as today_checkouts,
         
        -- Currently Checked-in
        (SELECT COUNT(*) FROM V03_visitor_checkin ci
         LEFT JOIN V04_visitor_checkout co ON ci.checkin_id = co.checkin_id
         WHERE co.checkout_id IS NULL) as currently_checked_in
    `);

    // 7. Employee Statistics (FIXED - Added table alias)
    let employeeQuery = `
      SELECT 
        -- Employee Counts
        COUNT(*) as total_employees,
        SUM(CASE WHEN em.status = 'Active' THEN 1 ELSE 0 END) as active_employees,
        SUM(CASE WHEN em.status != 'Active' THEN 1 ELSE 0 END) as inactive_employees,
        
        -- Department Distribution
        dm.department_name,
        COUNT(*) as dept_employee_count
      FROM E01_employee_master em
      LEFT JOIN M02_department_master dm ON em.department_id = dm.department_id
      WHERE em.created_at BETWEEN @start_date AND @end_date
    `;

    if (department_id) {
      employeeQuery += ` AND em.department_id = @department_id`;
    }

    employeeQuery += ` GROUP BY dm.department_name ORDER BY dept_employee_count DESC`;

    const employeeMetrics = await request.query(employeeQuery);

    // 8. Recent Activities Timeline (FIXED - Added table aliases)
    const recentActivities = await request.query(`
      -- Combine recent activities from different modules
      SELECT 
        'Hiring' as module,
        'New Application' as activity_type,
        ja.candidate_name as title,
        ja.application_date as activity_date,
        '/recruitment/applications/' + CAST(ja.application_id as NVARCHAR) as link
      FROM R03_job_applications ja
      WHERE ja.application_date BETWEEN @start_date AND @end_date
      
      UNION ALL
      
      SELECT 
        'Attendance' as module,
        'Attendance Record' as activity_type,
        'Attendance for ' + CONVERT(NVARCHAR, ap.attendance_date, 103) as title,
        ap.attendance_date as activity_date,
        '/attendance/view/' + CAST(ap.attendance_id as NVARCHAR) as link
      FROM A02_attendance_processed ap
      WHERE ap.attendance_date BETWEEN @start_date AND @end_date
      
      UNION ALL
      
      SELECT 
        'Project' as module,
        'New Project' as activity_type,
        pm.project_name as title,
        pm.start_date as activity_date,
        '/projects/view/' + CAST(pm.project_id as NVARCHAR) as link
      FROM M25_project_master pm
      WHERE pm.start_date BETWEEN @start_date AND @end_date
      
      UNION ALL
      
      SELECT 
        'Task' as module,
        'Task Created' as activity_type,
        tm.title as title,
        tm.created_at as activity_date,
        '/tasks/view/' + CAST(tm.task_id as NVARCHAR) as link
      FROM T01_task_master tm
      WHERE tm.created_at BETWEEN @start_date AND @end_date
      
      ORDER BY activity_date DESC
      OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
    `);

    // 9. Performance Trends (FIXED)
    const performanceTrends = await request.query(`
      WITH DateSeries AS (
        SELECT DATEADD(DAY, -6, CAST(GETDATE() AS DATE)) as trend_date
        UNION ALL SELECT DATEADD(DAY, -5, CAST(GETDATE() AS DATE))
        UNION ALL SELECT DATEADD(DAY, -4, CAST(GETDATE() AS DATE))
        UNION ALL SELECT DATEADD(DAY, -3, CAST(GETDATE() AS DATE))
        UNION ALL SELECT DATEADD(DAY, -2, CAST(GETDATE() AS DATE))
        UNION ALL SELECT DATEADD(DAY, -1, CAST(GETDATE() AS DATE))
        UNION ALL SELECT CAST(GETDATE() AS DATE)
      )
      SELECT 
        ds.trend_date,
        -- Attendance Trend
        (SELECT COUNT(*) FROM A02_attendance_processed 
         WHERE attendance_date = ds.trend_date AND status = 'Present') as daily_attendance,
         
        -- Task Completion Trend
        (SELECT COUNT(*) FROM T01_task_master 
         WHERE CAST(updated_at AS DATE) = ds.trend_date AND status = 'Completed') as daily_completed_tasks,
         
        -- Application Trend
        (SELECT COUNT(*) FROM R03_job_applications 
         WHERE application_date = ds.trend_date) as daily_applications
      FROM DateSeries ds
      ORDER BY ds.trend_date
    `);

    // Compile all dashboard data
    const dashboardData = {
      success: true,
      message: "Dashboard data fetched successfully",
      timeframe: {
        selected: timeframe,
        start_date: dateParams.start_date.value,
        end_date: dateParams.end_date.value,
      },
      metrics: {
        hiring: hiringMetrics.recordset[0],
        attendance: attendanceMetrics.recordset,
        projects: projectMetrics.recordset[0],
        tasks: taskMetrics.recordset[0],
        dar: darMetrics.recordset[0],
        visitors: visitorMetrics.recordset[0],
        employees: employeeMetrics.recordset,
      },
      trends: {
        performance: performanceTrends.recordset,
      },
      activities: {
        recent: recentActivities.recordset,
      },
      summary: {
        total_modules: 7,
        data_points:
          hiringMetrics.recordset.length +
          attendanceMetrics.recordset.length +
          projectMetrics.recordset.length +
          taskMetrics.recordset.length +
          darMetrics.recordset.length +
          visitorMetrics.recordset.length +
          employeeMetrics.recordset.length,
      },
    };

    res.status(200).json(dashboardData);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ✅ 2. GET Module-specific Dashboard Data (FIXED)
const getModuleDashboard = async (req, res) => {
  const { module } = req.params;
  const { timeframe = "month", start_date, end_date } = req.query;

  try {
    validateLicense();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pool = await getConnection();
    const { startDate, endDate } = getDateRange(
      timeframe,
      start_date,
      end_date
    );

    const request = pool
      .request()
      .input("start_date", sql.Date, startDate)
      .input("end_date", sql.Date, endDate);

    let moduleData = {};
    let query = "";

    switch (module.toLowerCase()) {
      case "hiring":
        query = `
          SELECT 
            jp.job_title,
            jp.department_id,
            dm.department_name,
            COUNT(ja.application_id) as application_count,
            SUM(CASE WHEN ja.status = 'Hired' THEN 1 ELSE 0 END) as hired_count,
            AVG(r.ats_score) as avg_ats_score
          FROM R02_job_postings jp
          LEFT JOIN R03_job_applications ja ON jp.job_posting_id = ja.job_posting_id
          LEFT JOIN R11_resumes r ON ja.application_id = r.application_id
          LEFT JOIN M02_department_master dm ON jp.department_id = dm.department_id
          WHERE jp.posted_date BETWEEN @start_date AND @end_date
          GROUP BY jp.job_posting_id, jp.job_title, jp.department_id, dm.department_name
          ORDER BY application_count DESC
        `;
        break;

      case "attendance":
        query = `
          SELECT 
            em.employee_id,
            em.first_name + ' ' + ISNULL(em.last_name, '') as employee_name,
            dm.department_name,
            COUNT(ap.attendance_id) as total_days,
            SUM(CASE WHEN ap.status = 'Present' THEN 1 ELSE 0 END) as present_days,
            ROUND(CAST(SUM(CASE WHEN ap.status = 'Present' THEN 1 ELSE 0 END) as FLOAT) / 
                  NULLIF(COUNT(ap.attendance_id), 0) * 100, 2) as attendance_percentage,
            AVG(ap.total_work_duration_minutes) as avg_work_minutes
          FROM E01_employee_master em
          LEFT JOIN A02_attendance_processed ap ON em.employee_id = ap.emp_id 
            AND ap.attendance_date BETWEEN @start_date AND @end_date
          LEFT JOIN M02_department_master dm ON em.department_id = dm.department_id
          WHERE em.status = 'Active'
          GROUP BY em.employee_id, em.first_name, em.last_name, dm.department_name
          ORDER BY attendance_percentage DESC
        `;
        break;

      case "projects":
        query = `
          SELECT 
            pm.project_id,
            pm.project_name,
            pm.status as project_status,
            pm.start_date,
            pm.end_date,
            pm.total_budget,
            COUNT(pmem.member_id) as team_size,
            COUNT(tm.task_id) as total_tasks,
            SUM(CASE WHEN tm.status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
            CASE WHEN COUNT(tm.task_id) > 0 
                 THEN ROUND(CAST(SUM(CASE WHEN tm.status = 'Completed' THEN 1 ELSE 0 END) as FLOAT) / 
                           COUNT(tm.task_id) * 100, 2)
                 ELSE 0 END as completion_rate
          FROM M25_project_master pm
          LEFT JOIN M26_project_members pmem ON pm.project_id = pmem.project_id AND pmem.status = 1
          LEFT JOIN T01_task_master tm ON pm.project_id = tm.project_id
          WHERE pm.start_date BETWEEN @start_date AND @end_date
          GROUP BY pm.project_id, pm.project_name, pm.status, pm.start_date, pm.end_date, pm.total_budget
          ORDER BY pm.start_date DESC
        `;
        break;

      case "tasks":
        query = `
          SELECT 
            tm.task_id,
            tm.title,
            tm.priority,
            tm.status,
            tm.start_date,
            tm.due_date,
            pm.project_name,
            assigner.first_name + ' ' + ISNULL(assigner.last_name, '') as assigned_by,
            assignee.first_name + ' ' + ISNULL(assignee.last_name, '') as assigned_to,
            DATEDIFF(DAY, GETDATE(), tm.due_date) as days_remaining
          FROM T01_task_master tm
          LEFT JOIN M25_project_master pm ON tm.project_id = pm.project_id
          LEFT JOIN E01_employee_master assigner ON tm.assigned_by = assigner.employee_id
          LEFT JOIN E01_employee_master assignee ON tm.assigned_to = assignee.employee_id
          WHERE tm.created_at BETWEEN @start_date AND @end_date
          ORDER BY tm.priority DESC, tm.due_date ASC
        `;
        break;

      case "dar":
        query = `
          SELECT 
            dm.dar_id,
            dm.report_date,
            dm.status as dar_status,
            em.first_name + ' ' + ISNULL(em.last_name, '') as employee_name,
            COUNT(dt.dar_task_id) as total_tasks,
            SUM(dt.hours_spent) as total_hours,
            AVG(dt.progress_percentage) as avg_progress
          FROM T04_dar_master dm
          LEFT JOIN E01_employee_master em ON dm.employee_id = em.employee_id
          LEFT JOIN T05_dar_tasks dt ON dm.dar_id = dt.dar_id
          WHERE dm.report_date BETWEEN @start_date AND @end_date
          GROUP BY dm.dar_id, dm.report_date, dm.status, em.first_name, em.last_name
          ORDER BY dm.report_date DESC
        `;
        break;

      case "visitors":
        query = `
          SELECT 
            vm.visitor_id,
            vm.first_name + ' ' + ISNULL(vm.last_name, '') as visitor_name,
            vm.company_name,
            COUNT(vc.checkin_id) as total_visits,
            MAX(vc.checkin_time) as last_visit,
            (SELECT COUNT(*) FROM V03_visitor_checkin ci
             LEFT JOIN V04_visitor_checkout co ON ci.checkin_id = co.checkin_id
             WHERE ci.visitor_id = vm.visitor_id AND co.checkout_id IS NULL) as currently_checked_in
          FROM V01_visitor_master vm
          LEFT JOIN V03_visitor_checkin vc ON vm.visitor_id = vc.visitor_id
            AND vc.checkin_time BETWEEN @start_date AND @end_date
          GROUP BY vm.visitor_id, vm.first_name, vm.last_name, vm.company_name
          ORDER BY total_visits DESC
        `;
        break;

      default:
        return res.status(400).json({
          success: false,
          message:
            "Invalid module specified. Available modules: hiring, attendance, projects, tasks, dar, visitors",
        });
    }

    const result = await request.query(query);

    res.status(200).json({
      success: true,
      message: `${module} dashboard data fetched successfully`,
      module: module,
      timeframe: { start_date: startDate, end_date: endDate },
      data: result.recordset,
      total_records: result.recordset.length,
    });
  } catch (error) {
    console.error(`Error fetching ${module} dashboard data:`, error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ✅ 3. GET Quick Stats for Dashboard Widgets
const getQuickStats = async (req, res) => {
  try {
    validateLicense();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pool = await getConnection();
    const today = new Date().toISOString().split("T")[0];

    const stats = await pool.request().query(`
      SELECT 
        -- Hiring Stats
        (SELECT COUNT(*) FROM R03_job_applications WHERE CAST(application_date AS DATE) = '${today}') as today_applications,
        (SELECT COUNT(*) FROM R02_job_postings WHERE status = 'Open') as active_jobs,
        
        -- Attendance Stats
        (SELECT COUNT(*) FROM A02_attendance_processed WHERE attendance_date = '${today}' AND status = 'Present') as today_present,
        (SELECT COUNT(*) FROM A02_attendance_processed WHERE attendance_date = '${today}' AND status = 'Absent') as today_absent,
        
        -- Project Stats
        (SELECT COUNT(*) FROM M25_project_master WHERE status = 1) as active_projects,
        (SELECT COUNT(*) FROM T01_task_master WHERE due_date = '${today}' AND status NOT IN ('Completed', 'Closed')) as due_tasks_today,
        
        -- Visitor Stats
        (SELECT COUNT(*) FROM V03_visitor_checkin WHERE CAST(checkin_time AS DATE) = '${today}') as today_visitors,
        (SELECT COUNT(*) FROM V03_visitor_checkin ci 
         LEFT JOIN V04_visitor_checkout co ON ci.checkin_id = co.checkin_id 
         WHERE co.checkout_id IS NULL) as currently_checked_in,
         
        -- Employee Stats
        (SELECT COUNT(*) FROM E01_employee_master WHERE status = 'Active') as active_employees,
        (SELECT COUNT(*) FROM T04_dar_master WHERE report_date = '${today}') as today_dars
    `);

    res.status(200).json({
      success: true,
      message: "Quick stats fetched successfully",
      data: stats.recordset[0],
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching quick stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// ✅ 4. GET Department-wise Analytics
const getDepartmentAnalytics = async (req, res) => {
  const { department_id } = req.params;

  try {
    validateLicense();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const pool = await getConnection();
    const request = pool
      .request()
      .input("department_id", sql.Int, department_id);

    const analytics = await request.query(`
      SELECT 
        dm.department_id,
        dm.department_name,
        
        -- Employee Count
        (SELECT COUNT(*) FROM E01_employee_master 
         WHERE department_id = @department_id AND status = 'Active') as employee_count,
        
        -- Attendance Summary (Last 30 days)
        (SELECT COUNT(*) FROM A02_attendance_processed ap
         INNER JOIN E01_employee_master em ON ap.emp_id = em.employee_id
         WHERE em.department_id = @department_id 
         AND ap.attendance_date >= DATEADD(DAY, -30, GETDATE())
         AND ap.status = 'Present') as present_last_30_days,
        
        -- Active Projects
        (SELECT COUNT(*) FROM M25_project_master 
         WHERE status = 1) as active_projects,
         
        -- Pending Tasks
        (SELECT COUNT(*) FROM T01_task_master tm
         INNER JOIN E01_employee_master em ON tm.assigned_to = em.employee_id
         WHERE em.department_id = @department_id 
         AND tm.status NOT IN ('Completed', 'Closed')) as pending_tasks,
         
        -- Open Job Positions
        (SELECT COUNT(*) FROM R02_job_postings 
         WHERE department_id = @department_id AND status = 'Open') as open_positions
         
      FROM M02_department_master dm
      WHERE dm.department_id = @department_id
    `);

    if (analytics.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Department analytics fetched successfully",
      data: analytics.recordset[0],
    });
  } catch (error) {
    console.error("Error fetching department analytics:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Helper function to calculate date ranges
function getDateRange(timeframe, customStart, customEnd) {
  const today = new Date();
  let startDate, endDate;

  if (customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  switch (timeframe) {
    case "today":
      startDate = endDate = today.toISOString().split("T")[0];
      break;
    case "week":
      startDate = new Date(today.setDate(today.getDate() - 7))
        .toISOString()
        .split("T")[0];
      endDate = new Date().toISOString().split("T")[0];
      break;
    case "month":
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      endDate = new Date().toISOString().split("T")[0];
      break;
    case "quarter":
      const quarter = Math.floor(today.getMonth() / 3);
      startDate = new Date(today.getFullYear(), quarter * 3, 1)
        .toISOString()
        .split("T")[0];
      endDate = new Date().toISOString().split("T")[0];
      break;
    case "year":
      startDate = new Date(today.getFullYear(), 0, 1)
        .toISOString()
        .split("T")[0];
      endDate = new Date().toISOString().split("T")[0];
      break;
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      endDate = new Date().toISOString().split("T")[0];
  }

  return { startDate, endDate };
}

const getProjectDetailsWithCost = async (req, res) => {
  try {
    validateLicense();

    // Authenticate user
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const { project_id } = req.params; // assuming passed in URL /api/project/:project_id
    if (!project_id) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    const pool = await getConnection();

    // Call stored procedure
    const result = await pool
      .request()
      .input("project_id", sql.Int, project_id)
      .execute("usp_GetProjectDetailsWithCost");

    // Handle result
    let data = null;
    if (result.recordsets && result.recordsets.length > 0) {
      data = result.recordsets[0];
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Project not found or no data available",
      });
    }

    res.status(200).json({
      success: true,
      message: "Project details fetched successfully",
      data: data[0], // since SP returns a single project
    });
  } catch (error) {
    console.error("Error executing usp_GetProjectDetailsWithCost:", error);

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
  getDashboardData,
  getModuleDashboard,
  getQuickStats,
  getDepartmentAnalytics,
  getProjectDetailsWithCost,
};
