const express = require("express");
const router = express.Router();
const projectController = require("../../controller/project/project.controller.js");
const projectMemberController = require("../../controller/project/projectMember.controller.js");
const projectModuleController = require("../../controller/project/projectModule.controller.js");

// Project routes
router.post("/", projectController.createProject);
router.get("/", projectController.getAllProjects);
router.get("/:id", projectController.getProjectById);
router.put("/:id", projectController.updateProject);
router.delete("/:id", projectController.deleteProject);

// Project member routes
router.post("/:projectId/members", projectMemberController.addProjectMembers);
router.get("/:projectId/members", projectMemberController.getProjectMembers);
router.get(
  "/:projectId/members/:memberId",
  projectMemberController.getProjectMemberById
);
router.put(
  "/:projectId/members/:memberId",
  projectMemberController.updateProjectMember
);
router.delete(
  "/:projectId/members/:memberId",
  projectMemberController.removeProjectMember
);

// Project module routes
router.post("/:projectId/modules", projectModuleController.createProjectModule);
router.get("/:projectId/modules", projectModuleController.getProjectModules);
router.get(
  "/:projectId/modules/:moduleId",
  projectModuleController.getProjectModuleById
);
router.put(
  "/:projectId/modules/:moduleId",
  projectModuleController.updateProjectModule
);
router.delete(
  "/:projectId/modules/:moduleId",
  projectModuleController.deleteProjectModule
);
router.get(
  "/:projectId/modules/:moduleId/statistics",
  projectModuleController.getModuleStatistics
);

module.exports = router;
