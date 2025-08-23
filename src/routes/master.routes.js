const express = require("express");
const router = express.Router();
const {
  companyOperations,
} = require("../controller/master/M01_CompanyMaster.controller.js");

router.post("/master/company", companyOperations);

module.exports = router;
