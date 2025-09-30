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
  getResumes,
  getResumeById,
  updateResumeStatus,
} = require("../controller/job/R11_ResumeOperations.controller.js");
const {
  candidateInterviewsOperations,
} = require("../controller/job/R07_CandidateInterview.controller.js");
const {
  offerLettersOperations,
} = require("../controller/job/R08_OfferLetter.controller.js");
const {
  onboardingTasksOperations,
} = require("../controller/job/R09_OnboardingTask.controller.js");

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

router.post("/resumes", getResumes);

router.get("/resumes/:application_id", getResumeById);

router.post("/resumes/:application_id", updateResumeStatus);

router.post("/interview", candidateInterviewsOperations);

router.post("/offer", offerLettersOperations);

router.post("/onboarding-tasks", onboardingTasksOperations);

module.exports = router;
