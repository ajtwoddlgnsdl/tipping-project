// server/controllers/searchController.js
const { getJson } = require("serpapi");
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// 💡 [수정됨] 환율 계산기 (로그 기반 정밀 보정)
const exchangeToKRW = (price, currency) => {
  if (!price) return 0;
  
  // 통화 기호를 확실하게 비교하기 위해 대문자로 변환 및 공백 제거
  const curr = currency.toString().toUpperCase().trim();

  // 1. 이미 원화인 경우
  if (curr.includes('KRW') || curr.includes('₩')) {
    return Math.round(price);
  }

  // 2. 미국 달러 (USD, $, US$)
  if (curr.includes('USD') || curr === '$' || curr.includes('US$')) {
    return Math.round(price * 1430); 
  }

  // 3. 일본 엔화 (JPY, ¥, JP¥)
  if (curr.includes('JPY') || curr === '¥' || curr.includes('JP¥')) {
    return Math.round(price * 9.5);
  }

  // 4. 유로 (EUR, €)
  if (curr.includes('EUR') || curr.includes('€')) {
    return Math.round(price * 1550);
  }

  // 5. 파운드 (GBP, £)
  if (curr.includes('GBP') || curr.includes('£')) {
    return Math.round(price * 1800);
  }

  // 6. 호주 달러 (AUD, AU$) - 로그에 발견됨!
  if (curr.includes('AUD') || curr.includes('AU$')) {
    return Math.round(price * 930);
  }

  // 7. 대만 달러 (TWD, NT$) - 로그에 발견됨!
  if (curr.includes('TWD') || curr.includes('NT$')) {
    return Math.round(price * 44);
  }

  // 모르는 통화면 일단 그대로 반환 (로그 찍어서 확인)
  console.log(`⚠️ 변환 실패 통화 발견: ${curr}`);
  return Math.round(price);
};

exports.searchImage = async (req, res) => {
  try {
    let targetUrl = req.body.imageUrl;

    // 1. 파일 업로드 처리
    if (req.file) {
      console.log(`📤 이미지 호스팅 중...`);
      const formData = new FormData();
      formData.append('image', fs.createReadStream(req.file.path));
      formData.append('key', process.env.IMGBB_KEY);

      const imgbbResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
        headers: { ...formData.getHeaders() }
      });

      targetUrl = imgbbResponse.data.data.url;
      fs.unlinkSync(req.file.path);
    }

    if (!targetUrl) {
      return res.status(400).json({ error: "이미지나 URL이 필요합니다." });
    }

    console.log(`🔍 검색 및 환율 변환 시작: ${targetUrl}`);

    // 2. SerpApi 검색
    getJson({
      engine: "google_lens",
      url: targetUrl,
      api_key: process.env.SERPAPI_KEY,
      hl: "en",
      country: "us",
    }, (json) => {
      if (json.error) return res.status(500).json({ error: json.error });

      let parsedResults = [];

      // 데이터 가공 함수
      const parseItem = (item, type) => {
        const rawPrice = item.price ? item.price.extracted_value : 0;
        const rawCurrency = item.price ? item.price.currency : 'KRW';
        
        // ★ 환율 변환 실행
        const krwPrice = exchangeToKRW(rawPrice, rawCurrency);

        return {
          title: item.title,
          price: krwPrice,       // 변환된 한국 가격
          currency: 'KRW',       // 이제 화면엔 '₩'로 표시됨
          originalPrice: rawPrice, // (참고용) 원래 가격
          originalCurrency: rawCurrency, // (참고용) 원래 통화
          thumbnail: item.thumbnail,
          link: item.link,
          source: item.source,
          type: type
        };
      };

      if (json.shopping_results) {
        parsedResults = [...parsedResults, ...json.shopping_results.map(i => parseItem(i, 'shopping'))];
      }

      if (json.visual_matches) {
        const visualItems = json.visual_matches
          .filter(i => i.price)
          .map(i => parseItem(i, 'visual'));
        parsedResults = [...parsedResults, ...visualItems];
      }

      if (parsedResults.length === 0) {
        return res.json({
          message: "검색 완료 (결과 없음)",
          count: 0,
          results: [] 
        });
      }

      const sortedResults = parsedResults
        .filter(item => item.price > 0)
        .sort((a, b) => a.price - b.price);

      res.json({
        message: "검색 성공!",
        count: sortedResults.length,
        searchImage: targetUrl,
        results: sortedResults
      });
    });

  } catch (error) {
    console.error("Search Error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "서버 오류" });
  }
};