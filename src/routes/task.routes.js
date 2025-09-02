const express = require("express");
const router = express.Router();

const {
  taskOperations,
} = require("../controller/taskMaster/task.controller.js");
const {
  darFullOperations,
} = require("../controller/taskMaster/DAR.controller.js");

router.post("/task", taskOperations);
router.post("/dar", darFullOperations);

module.exports = router;
