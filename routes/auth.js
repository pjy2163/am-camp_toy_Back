import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";

const router = express.Router();

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
