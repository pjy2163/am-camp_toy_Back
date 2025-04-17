import express from "express";
import bodyParser from "body-parser";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import cookieParser from "cookie-parser";
import { log } from "console";

dotenv.config();
const app = express();

// db연결 코드
const mariadb = require("./database/connect/mariadb");
mariadb.connect();

app.use(cors({ origin: "http://localhost:3000", credentials: true })); //+쿠키관련
app.use(bodyParser.json());

app.use(express.json());
app.use(cookieParser());
app.use("/auth", authRoutes);
app.listen(9000, () => {
  console.log("서버실행중");
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, "db.json");

const adapter = new JSONFile(dbPath);
const defaultData = { users: [] };
const db = new Low(adapter, defaultData);

await db.read();

const PORT = 9000;

app.post("/github/callback", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, error: "code가 없습니다." });
  }

  try {
    // code → 토큰 교환
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams({
          client_id: "Ov23lilEFmixYGI69GW6",
          client_secret: "6a2b92ebaf46d324275e1c91f22398d4f7a0fbc4",
          code,
        }),
      }
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(401).json({ success: false, error: "토큰 없음" });
    }

    // 토큰 사용자 정보 요청
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser = await userRes.json();

    // 여기서 사용자 정보를 local DB에 저장하거나 로그인 처리
    const existingUser = db.data.users.find(
      (u) => u.username === githubUser.login
    );

    let user;
    if (existingUser) {
      user = existingUser;
    } else {
      user = {
        id: Date.now(),
        username: githubUser.login,
        email: githubUser.email || "",
        password: "", // 소셜 로그인이라 비워둠
        nickname: githubUser.name || githubUser.login,
        logintype: "Github",
      };
      db.data.users.push(user);
      await db.write();
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        nickname: user.nickname,
        username: user.username,
        logintype: "local", //user.logintype,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "서버 오류" });
  }
});
app.post("/register", async (req, res) => {
  const { username, email, password, nickname } = req.body;

  if (!username || !email || !password || !nickname) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }

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
    //const { password: _, ...safeUser } = user; // 비밀번호 제외
    res.json({
      message: "로그인 성공",
      user: user.id,
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
