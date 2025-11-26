const { getJson } = require("serpapi");

exports.searchImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "이미지 URL이 필요합니다." });
    }

    console.log(`🔍 구글 렌즈 검색 시작: ${imageUrl}`);

    // SerpApi 호출 (Google Lens 엔진)
    getJson({
      engine: "google_lens",
      url: imageUrl,
      api_key: process.env.SERPAPI_KEY,
      hl: "ko", // 한국어 결과
      country: "kr", // 한국 지역
    }, (json) => {
      // 1. 검색 결과가 없는 경우
      if (!json.visual_matches) {
        return res.status(404).json({ error: "유사한 상품을 찾을 수 없습니다." });
      }

      // 2. 데이터 가공 (필요한 정보만 쏙쏙 뽑기)
      const results = json.visual_matches.map(item => ({
        title: item.title,
        price: item.price ? item.price.extracted_value : 0, // 가격
        currency: item.price ? item.price.currency : 'KRW', // 통화
        thumbnail: item.thumbnail, // 썸네일 사진
        link: item.link,           // 구매 링크
        source: item.source        // 쇼핑몰 이름 (쿠팡, 무신사 등)
      }));

      // 3. '가격이 있는 상품'만 남기고 '최저가순' 정렬 (기획 의도 반영)
      const sortedResults = results
        .filter(item => item.price > 0)
        .sort((a, b) => a.price - b.price);

      // 4. 응답 보내기
      res.json({
        message: "검색 성공!",
        count: sortedResults.length,
        results: sortedResults
      });
    });

  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ error: "검색 중 오류가 발생했습니다." });
  }
};