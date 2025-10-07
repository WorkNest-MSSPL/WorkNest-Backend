const express = require("express");
const cors = require("cors");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

// obfuscated function
const app = express();

// Swagger setup
// const swaggerUi = require('swagger-ui-express');
// const swaggerDocument = require('./config/swagger-output.json');

//Import Routes
const masterRoutes = require("./routes/master.routes.js");
const employeeRoutes = require("./routes/employee.routes.js");
const taskRoutes = require("./routes/task.routes.js");
const visitorRoutes = require("./routes/visitor.routes.js");
const leaveRoutes = require("./routes/leave.routes.js");
const jobRoutes = require("./routes/job.routes.js");
const attendanceRoutes = require("./routes/attendance.routes.js");
const salaryRoutes = require("./routes/salary.routes.js");
const performanceRoutes = require("./routes/performance.routes.js");
const trainingRoutes = require("./routes/training.routes.js");
const dashboardRoutes = require("./routes/dashboard.routes.js");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const rolePermissionRoutes = require("./routes/rolePermission.routes");
const userPermissionRoutes = require("./routes/userPermission.routes");

const projectRoutes = require("./routes/project/project.routes.js");
const tasksRoutes = require("./routes/project/task.routes.js");
const darRoutes = require("./routes/project/dar.routes.js");
const empperformanceRoutes = require("./routes/project/performance.routes.js");
const empperformanceCriteriaRoutes = require("./routes/project/performanceCriteria.routes.js");

// Payroll Routes
const payrollRoutes = require("./routes/payroll.routes.js");

//middleware to process json and urlencoded data
const corsOptions = {
  origin: "*", // Allow all origins
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
// app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Middleware to validate license before each API
app.use((req, res, next) => {
  try {
    validateLicense();
    next();
  } catch (err) {
    res.status(403).send("❌ License invalid or expired");
  }
});

app.get("/", (req, res) => res.send("✅ API running!"));
app.get("/test", (req, res) => res.send("✅ Another route validated!"));

// Swagger Documentation
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/role-permissions", rolePermissionRoutes);
app.use("/api/user-permissions", userPermissionRoutes);

//Master Routes
app.use("/api/master", masterRoutes);

//Employee Routes
app.use("/api/employee", employeeRoutes);

//Task Routes
app.use("/api/task", taskRoutes);

//Visitor Routes
app.use("/api/visitor", visitorRoutes);

//Leave Routes
app.use("/api/leave", leaveRoutes);

//Job Routes
app.use("/api/job", jobRoutes);

//Attendance Routes
app.use("/api/attendance", attendanceRoutes);

//Salary Routes
app.use("/api/salary", salaryRoutes);

//Attendance Routes
app.use("/api/performance", performanceRoutes);

//Training Routes
app.use("/api/training", trainingRoutes);

//Dashboard Routes
app.use("/api/dashboard", dashboardRoutes);

//project management
app.use("/api/project/management", projectRoutes);
app.use("/api/project/tasks", tasksRoutes);
app.use("/api/project/dars", darRoutes);
app.use("/api/project/performance", empperformanceRoutes);
app.use("/api/project/performance-criteria", empperformanceCriteriaRoutes);

//Payroll Management Routes
app.use("/api/payroll", payrollRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

const PORT = process.env.PORT || 3000;
// const HOST = "192.168.1.49";
app.listen(PORT, () => console.log(`🚀 API started on port  and ${PORT}`));

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 API started on port ${PORT}`));
