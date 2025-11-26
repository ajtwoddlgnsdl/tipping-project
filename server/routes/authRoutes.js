const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 'POST /register' 요청이 오면 컨트롤러의 register 함수 실행
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;