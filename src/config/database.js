const sql = require("mssql");


const config = {
  user: "msspl",
  password: "R#msspl109",
  server: "103.20.215.109",
  port: 9851,
  database: "worknest",
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
