const express = require("express");
const { validateLicense } = require("../checker.obf"); // obfuscated function
const app = express();
const PORT = process.env.PORT || 3000;

//Import Routes
const masterRoutes = require("./routes/master.routes.js");

//middleware to process json and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use("/api", masterRoutes);

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

app.listen(PORT, () => console.log(`🚀 API started on port ${PORT}`));
