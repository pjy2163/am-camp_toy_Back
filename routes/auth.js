import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const router = express.Router();
// const adapter = new JSONFile("db.json");
// const db = new Lowow(adapter);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, "../db.json");
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { users: [] });

await db.read();

router.post("/google/callback", async (req, res) => {
  const { code } = req.body;

  try {
    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      null,
      {
        params: {
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: "http://localhost:3000/google-callback",
          grant_type: "authorization_code",
        },
      }
    );

    const { id_token, access_token } = tokenRes.data;

    const userRes = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const { email, name, sub } = userRes.data;

    //db확인
    let user = db.data.users.find(
      (u) => u.email === email && u.logintype === "google"
    );
    if (!user) {
      user = {
        id: Date.now(),
        username: sub, // Google 사용자 고유 ID
        email,
        nickname: name,
        password: "", // 소셜 로그인은 비워둠
        logintype: "google",
      };
      db.data.users.push(user);
      await db.write();
    }

    // JWT 생성 후 쿠키에 저장
    const token = jwt.sign({ sub, email, name }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      })
      .json({ success: true, nickname: name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Google OAuth 실패" });
  }
});

export default router;
