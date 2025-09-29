const express = require("express");
const router = express.Router();
const {
  getAllPerformanceCriteria,
  getPerformanceCriteriaById,
  createPerformanceCriteria,
  updatePerformanceCriteria,
  deletePerformanceCriteria,
} = require("../../controller/project/performanceCriteria.controller.js");

// GET /api/performance-criteria - Get all performance criteria
router.get("/", getAllPerformanceCriteria);

// GET /api/performance-criteria/:id - Get performance criteria by ID
router.get("/:id", getPerformanceCriteriaById);

// POST /api/performance-criteria - Create new performance criteria
router.post("/", createPerformanceCriteria);

// PUT /api/performance-criteria/:id - Update performance criteria
router.put("/:id", updatePerformanceCriteria);

// DELETE /api/performance-criteria/:id - Delete performance criteria
router.delete("/:id", deletePerformanceCriteria);

module.exports = router;
