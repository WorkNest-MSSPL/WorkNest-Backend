const express = require("express");
const router = express.Router();
const darController = require("../../controller/project/dar.controller.js");

// DAR routes
router.post("/", darController.createDAR);
router.get("/", darController.getAllDARs);
router.get("/:id", darController.getDARById);
router.put("/:id", darController.updateDAR);
router.delete("/:id", darController.deleteDAR);
router.post("/:id/review", darController.addDARReview);

module.exports = router;
