const getUserId = () => {
  return 15;
};

module.exports = { getUserId };

// const { verifyAccessToken } = require("../config/jwtUtils.js");

// const getUserId = (req) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Access token required",
//       });
//     }

//     // Verify access token
//     const decoded = verifyAccessToken(token);

//     return decoded ? decoded.employeeId : 15;
//   } catch (err) {
//     console.error("Error extracting userId:", err.message);
//     return null;
//   }
// };

// module.exports = { getUserId };
