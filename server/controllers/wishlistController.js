const prisma = require('../config/db');

// 1. 찜 추가하기 (찾은 최저가 박제)
exports.addWish = async (req, res) => {
  try {
    const { productTitle, price, imageUrl, productLink } = req.body;
    const userId = req.user.userId; // 미들웨어가 찾아준 유저 ID

    const newWish = await prisma.wishlist.create({
      data: {
        productTitle,
        price: parseInt(price), // 가격은 숫자로 저장
        imageUrl,
        productLink,
        userId: userId, // 누구의 찜 목록인지 연결
      },
    });

    res.status(201).json({ message: "찜 목록에 저장 완료!", wish: newWish });

  } catch (error) {
    console.error("AddWish Error:", error);
    res.status(500).json({ error: "찜하기 실패" });
  }
};

// 2. 내 찜 목록 보기
exports.getWishes = async (req, res) => {
  try {
    const userId = req.user.userId;

    const wishes = await prisma.wishlist.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' } // 최신순 정렬
    });

    res.json(wishes);

  } catch (error) {
    console.error("GetWishes Error:", error);
    res.status(500).json({ error: "목록 불러오기 실패" });
  }
};

// 3. 찜 삭제하기 (더 싼거 찾았을 때 삭제)
exports.deleteWish = async (req, res) => {
  try {
    const wishId = parseInt(req.params.id);
    const userId = req.user.userId;

    // 내 찜이 맞는지 확인하고 삭제 (남의 거 지우면 안 되니까)
    const wish = await prisma.wishlist.findUnique({
      where: { id: wishId }
    });

    if (!wish || wish.userId !== userId) {
      return res.status(403).json({ error: "삭제 권한이 없습니다." });
    }

    await prisma.wishlist.delete({
      where: { id: wishId }
    });

    res.json({ message: "삭제되었습니다." });

  } catch (error) {
    console.error("DeleteWish Error:", error);
    res.status(500).json({ error: "삭제 실패" });
  }
};