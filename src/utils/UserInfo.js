const getUserId = () => {
  return 15;
};

module.exports = { getUserId };

// const { verifyAccessToken } = require("../config/jwtUtils");

// const getUserId = (req) => {
//   try {
//     const rawHeader = req.headers.authorization;
//     if (!rawHeader) return null;

//     const token = rawHeader.split(" ")[1];
//     if (!token) return null;

//     const decoded = verifyAccessToken(token);

//     // You can return either employeeId or userId
//     return decoded.employeeId; // 🔹 returning employeeId
//     // return decoded.userId;   // or if you want userId
//   } catch (err) {
//     console.error("Error extracting userId:", err.message);
//     return null;
//   }
// };

// module.exports = { getUserId };
