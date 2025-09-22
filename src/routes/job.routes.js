const express = require("express");
const router = express.Router();

const {
  jobCategoryOperations,
} = require("../controller/job/R01_JobCategory.controller.js");
const {
  jobPostingsOperations,
} = require("../controller/job/R02_JobPosting.controller.js");
const jobApplicationsController = require("../controller/job/R03_JobApplications.controller.js");

const {
  resumeOperations,
} = require("../controller/job/R11_ResumeOperations.controller.js");

router.post("/job-category", jobCategoryOperations);
router.post("/job-postings", jobPostingsOperations);
router.post(
  "/job-applications/create",
  jobApplicationsController.createJobApplication
);

router.post(
  "/job-applications/create",
  jobApplicationsController.createJobApplication
);

router.post(
  "/job-applications/get",
  jobApplicationsController.getJobApplications
);

router.post(
  "/job-applications/get/:id",
  jobApplicationsController.getJobApplicationById
);
router.post("/resumes/filter", resumeOperations);

module.exports = router;
