const express = require("express");
const router = express.Router();

const {
  jobCategoryOperations,
} = require("../controller/job/R01_JobCategory.controller.js");
const {
  jobPostingsOperations,
} = require("../controller/job/R02_JobPosting.controller.js");
const {
  jobApplicationsOperations,
} = require("../controller/job/R03_JobApplications.controller.js");

router.post("/job-category", jobCategoryOperations);
router.post("/job-postings", jobPostingsOperations);
router.post("/job-applications", jobApplicationsOperations);

module.exports = router;
