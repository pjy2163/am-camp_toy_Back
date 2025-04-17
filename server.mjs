import mariadb from "./database/connect/mariadb.js";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();
const app = express();
const PORT = 9000;

app.use(cors({ origin: "http://localhost:3000", credentials: true })); //+쿠키관련
app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());

// 깃허브 로그인
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

    const checkSql = "SELECT * FROM users WHERE user_id = ?";
    mariadb.query(checkSql, [githubUser.login], (err, results) => {
      if (err) {
        console.error("GitHub 사용자 조회 오류:", err);
        return res.status(500).json({ error: "DB 오류" });
      }

      if (results.length > 0) {
        const user = results[0];
        return res.json({
          success: true,
          user: {
            id: user.user_id,
            nickname: user.user_name,
            username: user.user_id,
            logintype: user.logintype,
          },
        });
      } else {
        const insertSql = `
          INSERT INTO users (user_id, user_name, email, password, logintype)
          VALUES (?, ?, ?, '', 'github')
        `;
        mariadb.query(
          insertSql,
          [
            githubUser.login,
            githubUser.name || githubUser.login,
            githubUser.email || "",
          ],
          (insertErr) => {
            if (insertErr) {
              console.error("GitHub 사용자 삽입 오류:", insertErr);
              return res.status(500).json({ error: "회원 생성 실패" });
            }

            return res.json({
              success: true,
              user: {
                id: githubUser.login,
                nickname: githubUser.name || githubUser.login,
                username: githubUser.login,
                logintype: "github",
              },
            });
          }
        );
      }
    });
  } catch (err) {
    console.error("GitHub 로그인 오류:", err);
    res.status(500).json({ success: false, error: "서버 오류" });
  }
});

// 일반 회원가입

app.post("/register", async (req, res) => {
  const { username, email, password, nickname } = req.body;

  if (!username || !email || !password || !nickname) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }

  const checkSql = "SELECT * FROM users WHERE user_id = ? OR email = ?";
  mariadb.query(checkSql, [username, email], (err, results) => {
    if (err) {
      console.error("조회 오류:", err);
      return res.status(500).json({ error: "DB 오류" });
    }

    if (results.length > 0) {
      return res
        .status(409)
        .json({ error: "이미 사용 중인 아이디 또는 이메일입니다." });
    }

    const insertSql = `
      INSERT INTO users (user_id, password, user_name, birth, phone, email, logintype)
      VALUES (?, ?, ?, '20000101', '01000000000', ?, 'local')
    `;
    mariadb.query(insertSql, [username, password, nickname, email], (err2) => {
      if (err2) {
        console.error("삽입 오류:", err2);
        return res.status(500).json({ error: "회원가입 실패" });
      }

      res.status(201).json({ message: "회원가입 성공" });
    });
  });
});

app.get("/login", (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
  }

  const sql =
    "SELECT * FROM users WHERE (user_id = ? OR email = ?) AND password = ?";
  mariadb.query(sql, [username, username, password], (err, results) => {
    if (err) {
      console.error("로그인 오류:", err);
      return res.status(500).json({ error: "DB 오류" });
    }

    if (results.length > 0) {
      const user = results[0];
      res.json({
        message: "로그인 성공",
        user: user.user_id,
        nickname: user.user_name,
        logintype: user.logintype,
      });
    } else {
      res
        .status(401)
        .json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." });
    }
  });
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
