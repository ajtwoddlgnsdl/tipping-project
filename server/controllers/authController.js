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