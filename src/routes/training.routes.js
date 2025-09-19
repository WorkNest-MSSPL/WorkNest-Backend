const express = require("express");
const router = express.Router();

const {
  trainingMasterOperations,
} = require("../controller/training/O04_TrainingMaster.controller.js");

router.post("/master", trainingMasterOperations);

module.exports = router;
