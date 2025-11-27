const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// 'POST /register' 요청이 오면 컨트롤러의 register 함수 실행
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/google', authController.googleLogin);
router.post('/kakao', authController.kakaoLogin);

module.exports = router;