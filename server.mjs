import express from "express";
import bodyParser from "body-parser";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, "db.json");

const adapter = new JSONFile(dbPath);
const defaultData = { users: [] };
const db = new Low(adapter, defaultData);

await db.read();

const app = express();
const PORT = 9000;

app.use(bodyParser.json());

// 회원가입 API
app.post("/register", async (req, res) => {
  const { username, email, password, nickname } = req.body;

  if (!username || !email || !password || !nickname) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }

  // 이미 존재하는 아이디 또는 이메일 확인
  const existingUser = db.data.users.find(
    (user) => user.username === username || user.email === email
  );
  if (existingUser) {
    return res
      .status(409)
      .json({ error: "이미 사용 중인 아이디 또는 이메일입니다." });
  }

  db.data.users.push({ id: Date.now(), username, email, password, nickname });
  await db.write();

  res.status(201).json({ message: "회원가입 성공" });
});

// 로그인 API
app.get("/login", async (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
  }

  const user = db.data.users.find(
    (u) =>
      (u.username === username || u.email === username) &&
      u.password === password
  );

  if (user) {
    res.json({
      message: "로그인 성공",
      userId: user.id,
      nickname: user.nickname,
    });
  } else {
    res
      .status(401)
      .json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." });
  }
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
