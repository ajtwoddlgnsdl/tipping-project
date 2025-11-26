const jwt = require('jsonwebtoken');

exports.authenticateToken = (req, res, next) => {
  // 1. 헤더에서 토큰을 꺼내옵니다.
  // 보통 "Authorization: Bearer <토큰>" 형식으로 옵니다.
  const authHeader = req.headers['authorization'];
  
  // "Bearer " 뒷부분(진짜 토큰)만 잘라냅니다. 없으면 undefined.
  const token = authHeader && authHeader.split(' ')[1];

  // 2. 토큰이 아예 없으면? "로그인 필요함" (401)
  if (!token) {
    return res.status(401).json({ error: "로그인이 필요한 서비스입니다." });
  }

  // 3. 토큰 검증 (위조되었거나 만료되었는지 확인)
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // 403 Forbidden: 토큰은 있는데 유효하지 않음 (유효기간 만료 등)
      return res.status(403).json({ error: "유효하지 않은 토큰입니다." });
    }

    // 4. 검증 성공! 토큰 안에 있던 정보(userId, email)를 req.user에 붙여줌
    // 이렇게 하면 다음 단계(Controller)에서 "아, 지금 요청한 사람이 이 사람이구나" 하고 알 수 있음.
    req.user = user;
    
    // 5. 다음 단계로 통과!
    next();
  });
};