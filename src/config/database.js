const sql = require("mssql");
require("dotenv").config(); // Load env variables

const config = {
  user: process.env.DB_USER || "msspl",
  password: process.env.DB_PASS || "R#msspl109",
  server: process.env.DB_HOST || "103.20.215.109",
  port: parseInt(process.env.DB_PORT || "9851", 10),
  database: process.env.DB_NAME || "worknest",
  options: {
    encrypt: false,
    enableArithAbort: true,
    trustServerCertificate: true,
  },
};

async function getConnection() {
  try {
    const pool = await sql.connect(config);
    return pool;
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
}

module.exports = { getConnection, sql };
