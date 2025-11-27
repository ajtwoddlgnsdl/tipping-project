const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const upload = require('../middlewares/uploadMiddleware');

// POST /api/search
// 1. 파일이 있으면 upload 미들웨어가 'file'에 담아줌
// 2. 파일이 없으면 그냥 통과 -> 컨트롤러에서 URL 확인
router.post('/', upload.single('image'), searchController.searchImage);

module.exports = router;