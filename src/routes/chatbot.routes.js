const express = require("express");
const router = express.Router();

const {
  visitorReportOperations,
} = require("../controller/visitor/VisitorReport.controller.js");
const {
  chatBotOperations,
} = require("../controller/chatbot/chatbot.controller.js");

router.post("/chat", chatBotOperations);

module.exports = router;
