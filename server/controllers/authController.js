const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../config/db'); // 아까 만든 DB 연결 가져오기

exports.register = async (req, res) => {
  try {
    const { email, password, nickname } = req.body;

    // 1. 유효성 검사
    if (!email || !password) {
      return res.status(400).json({ error: "이메일과 비밀번호는 필수입니다." });
    }

    // 2. 이미 있는 이메일인지 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: "이미 존재하는 이메일입니다." });
    }

    // 3. 비밀번호 암호화 (보안 필수!)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. DB에 저장
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname: nickname || "익명",
      },
    });

    // 5. 성공 응답 (비밀번호는 빼고 줍니다)
    res.status(201).json({
      message: "회원가입 성공!",
      user: {
        id: newUser.id,
        email: newUser.email,
        nickname: newUser.nickname,
      },
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "서버 내부 오류" });
  }
};

// 로그인 로직
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. 유저 확인
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "존재하지 않는 사용자입니다." });
    }

    // 2. 비밀번호 확인 (입력받은 비번 vs DB에 있는 암호화된 비번)
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "비밀번호가 틀렸습니다." });
    }

    // 3. 토큰 발급 (유효기간: 1일)
    const token = jwt.sign(
      { userId: user.id, email: user.email }, // 토큰 안에 담을 정보 (Payload)
      process.env.JWT_SECRET,                 // 비밀 도장 (.env에서 가져옴)
      { expiresIn: '1d' }                     // 유효 기간
    );

    res.status(200).json({
      message: "로그인 성공!",
      token: token, // 이 토큰을 프론트엔드가 받아서 저장하게 됩니다.
      user: {
        id: user.id,
        nickname: user.nickname
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "서버 내부 오류" });
  }
};

// 내 정보 조회 (보호된 라우트)
exports.getMe = async (req, res) => {
  try {
    // 미들웨어가 붙여준 req.user 덕분에 누가 요청했는지 알 수 있음!
    // (패스워드는 보안상 제외하고 조회)
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, nickname: true, createdAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }

    res.json({ user });

  } catch (error) {
    console.error("GetMe Error:", error);
    res.status(500).json({ error: "서버 오류" });
  }
};