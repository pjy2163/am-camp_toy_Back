const mariadb = require("mysql");

const conn = mariadb.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "1234",
  database: "toy_board",
});

module.exports = conn;
