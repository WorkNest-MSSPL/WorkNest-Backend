const express = require("express");
const router = express.Router();

const {
  taskOperations,
} = require("../controller/taskMaster/task.controller.js");

router.post("/task", taskOperations);

module.exports = router;
