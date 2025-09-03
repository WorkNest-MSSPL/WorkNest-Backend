const express = require("express");
const cors = require("cors");
const path = require("path");
const { validateLicense } = require(path.join(__dirname, "checker.obf"));

// obfuscated function
const app = express();

//Import Routes
const masterRoutes = require("./routes/master.routes.js");
const employeeRoutes = require("./routes/employee.routes.js");
const taskRoutes = require("./routes/task.routes.js");
const visitorRoutes = require("./routes/visitor.routes.js");

//middleware to process json and urlencoded data
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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

//Master Routes
app.use("/api/master", masterRoutes);

//Employee Routes
app.use("/api/employee", employeeRoutes);

//Task Routes
app.use("/api/task", taskRoutes);

//Visitor Routes
app.use("/api/visitor", visitorRoutes);

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
// const HOST = "192.168.1.45";
app.listen(PORT, () =>
  console.log(`🚀 API started on port  and ${PORT}`)
);

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`🚀 API started on port ${PORT}`));
