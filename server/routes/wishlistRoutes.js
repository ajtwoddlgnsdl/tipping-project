const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// 모든 찜 기능은 로그인이 필요하므로, 검문소를 통째로 적용합니다.
router.use(authenticateToken);

// API 주소 정의
router.post('/', wishlistController.addWish);      // 찜 하기
router.get('/', wishlistController.getWishes);     // 목록 보기
router.delete('/:id', wishlistController.deleteWish); // 삭제 하기

module.exports = router;