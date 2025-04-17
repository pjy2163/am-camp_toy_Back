import mysql from "mysql2";

const conn = mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "1234",
  database: "toy_board",
});

conn.connect((err) => {
  if (err) {
    console.error("MariaDB 연결 실패:", err);
  } else {
    console.log("MariaDB 연결 성공!");
  }
});

export default conn;
