const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');
const prisma = require('../config/db'); // 아까 만든 DB 연결 가져오기

exports.register = async (req, res) => {
  try {
    const { email, password, nickname } = req.body;

    // 1. 유효성 검사
    if (!email || !password) {
      return res.status(400).json({ error: "이메일과 비밀번호는 필수입니다." });
    }

    // [추가] 비밀번호 유효성 검사
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: "비밀번호는 영문, 숫자 포함 8자 이상이어야 합니다." });
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

// [신규] 구글 로그인 처리
exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body; // 프론트에서 받은 구글 ID Token (JWT)

    // 1. 구글 ID Token 검증 (tokeninfo 엔드포인트 사용)
    const googleResponse = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);

    const { sub: snsId, email, name, picture } = googleResponse.data;

    // 2. 우리 DB에 이메일로 가입된 유저가 있는지 확인
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // 3. 없으면? -> 자동 회원가입 시킴!
      // 비밀번호는 없음(null), provider는 'google'
      user = await prisma.user.create({
        data: {
          email,
          nickname: name,
          snsId,
          provider: 'google',
          password: null, // 중요!
        },
      });
    }

    // 4. 우리 서비스 전용 JWT 토큰 발급 (기존 로그인과 동일)
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: "구글 로그인 성공",
      token: jwtToken,
      user: { id: user.id, nickname: user.nickname }
    });

  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(500).json({ error: "구글 로그인 처리 실패" });
  }
};

// 👇 [추가] 카카오 로그인 처리 (인가 코드 방식)
exports.kakaoLogin = async (req, res) => {
  try {
    const { code, token, redirectUri } = req.body; // code: 인가코드 방식, token: 액세스토큰 방식, redirectUri: 클라이언트에서 전달

    let accessToken = token;

    // 인가 코드 방식인 경우 (code가 있으면)
    if (code) {
      console.log("카카오 인가 코드 수신:", code);
      console.log("사용할 redirect_uri:", redirectUri);
      
      // 1. 인가 코드로 액세스 토큰 발급
      // redirectUri는 클라이언트에서 전달받은 값 사용 (GitHub Pages / Vercel 구분)
      const tokenResponse = await axios.post(
        'https://kauth.kakao.com/oauth/token',
        null,
        {
          params: {
            grant_type: 'authorization_code',
            client_id: process.env.KAKAO_REST_API_KEY,
            redirect_uri: redirectUri || process.env.KAKAO_REDIRECT_URI || 'http://localhost:5173/login',
            code: code,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      
      accessToken = tokenResponse.data.access_token;
      console.log("카카오 액세스 토큰 발급 성공");
    }

    if (!accessToken) {
      return res.status(400).json({ error: "토큰 또는 인가 코드가 필요합니다." });
    }

    // 2. 카카오 서버에 유저 정보 요청
    const kakaoResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // 3. 카카오가 준 정보 파싱
    const snsId = String(kakaoResponse.data.id); // 숫자일 수 있어서 문자로 변환
    const nickname = kakaoResponse.data.properties?.nickname || '카카오유저';
    const email = kakaoResponse.data.kakao_account?.email; // 선택 동의라 없을 수도 있음

    // 4. 이메일이 없으면 가짜 이메일 생성 (카카오는 이메일이 필수 아닐 수 있음)
    // 예: kakao_12345@social.com
    const userEmail = email || `kakao_${snsId}@social.com`;

    // 5. DB 조회 및 가입 (구글 로직과 동일)
    let user = await prisma.user.findUnique({ where: { email: userEmail } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          nickname: nickname,
          snsId: snsId,
          provider: 'kakao', // provider는 kakao
          password: null,
        },
      });
    }

    // 6. JWT 발급
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: "카카오 로그인 성공",
      token: jwtToken,
      user: { id: user.id, nickname: user.nickname }
    });

  } catch (error) {
    console.error("Kakao Login Error:", error.response?.data || error);
    res.status(500).json({ error: "카카오 로그인 처리 실패" });
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