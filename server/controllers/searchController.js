// server/controllers/searchController.js
const { getJson } = require("serpapi");
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// 1. SerpApi Promise Wrapper
const getSerpData = (params) => {
  return new Promise((resolve, reject) => {
    try {
      getJson(params, (json) => {
        if (json.error) reject(new Error(json.error));
        else resolve(json);
      });
    } catch (e) {
      reject(e);
    }
  });
};

// 💡 [최종 강화판] 만능 환율 계산기 (2025년 기준)
const exchangeToKRW = (price, currency) => {
  // 1. 예외 처리: 가격이 없거나 숫자가 아니면 0
  if (!price || isNaN(price)) return 0;

  // 2. 통화 코드 정제: 공백 제거 및 대문자 변환 (예: " US $ " -> "US$")
  const curr = currency ? currency.toString().toUpperCase().replace(/\s/g, '') : 'KRW';

  // --- [Group 1] 한국 원화 (변환 불필요) ---
  if (curr === 'KRW' || curr.includes('WON') || curr.includes('₩') || curr.includes('원')) {
    return Math.round(price);
  }

  // --- [Group 2] 헷갈리는 달러 형제들 (반드시 USD보다 먼저 검사해야 함!) ---
  // 호주 달러 (AUD)
  if (curr.includes('AUD') || curr.includes('AU$') || curr.includes('A$')) {
    return Math.round(price * 930);
  }
  // 대만 달러 (TWD)
  if (curr.includes('TWD') || curr.includes('NT$') || curr.includes('NTD')) {
    return Math.round(price * 44);
  }
  // 홍콩 달러 (HKD)
  if (curr.includes('HKD') || curr.includes('HK$')) {
    return Math.round(price * 183);
  }
  // 캐나다 달러 (CAD)
  if (curr.includes('CAD') || curr.includes('CA$') || curr.includes('C$')) {
    return Math.round(price * 1000);
  }
  // 싱가포르 달러 (SGD)
  if (curr.includes('SGD') || curr.includes('S$')) {
    return Math.round(price * 1060);
  }

  // --- [Group 3] 메이저 통화 ---
  // 미국 달러 (USD) - 위의 특수 달러들이 아닐 때 비로소 체크
  if (curr.includes('USD') || curr.includes('US$') || curr === '$') {
    return Math.round(price * 1430);
  }

  // 일본 엔화 (JPY)
  if (curr.includes('JPY') || curr.includes('JP¥') || curr.includes('¥') || curr.includes('YEN')) {
    return Math.round(price * 9.5);
  }

  // 중국 위안화 (CNY)
  if (curr.includes('CNY') || curr.includes('CN¥') || curr.includes('RMB') || curr.includes('元')) {
    return Math.round(price * 195);
  }

  // 유로 (EUR)
  if (curr.includes('EUR') || curr.includes('€')) {
    return Math.round(price * 1550);
  }

  // 영국 파운드 (GBP)
  if (curr.includes('GBP') || curr.includes('£')) {
    return Math.round(price * 1800);
  }

  // --- [Group 4] 기타 ---
  // 베트남 동 (VND)
  if (curr.includes('VND') || curr.includes('₫')) {
    return Math.round(price * 0.06);
  }

  // 모르는 통화는 로그를 남기고 원본 숫자 반환 (0원으로 죽이는 것보단 나음)
  // console.log(`⚠️ 알 수 없는 통화 발견: ${curr} (값: ${price})`);
  return Math.round(price);
};

// 3. [무료] 규칙 기반 검색어 청소기
const cleanSearchQuery = (title) => {
  if (!title) return "";
  const blockList = [
    'Musinsa', 'Coupang', 'Naver', '29CM', 'Zigzag', 'W Concept',
    'Amazon', 'AliExpress', 'Shein', 'Temu',
    'Sale', 'Free Shipping', 'Best', 'Rocket', 'Anolorcode' // 브랜드명도 필요하면 추가
  ];
  let cleaned = title;
  blockList.forEach(word => {
    const regex = new RegExp(word, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  cleaned = cleaned.replace(/[|/\-_\[\]()]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
};

exports.searchImage = async (req, res) => {
  try {
    // --- [1단계] 이미지 업로드 ---
    let targetUrl = req.body.imageUrl;
    if (req.file) {
      console.log(`📤 [1단계] 이미지 호스팅 중...`);
      const formData = new FormData();
      formData.append('image', fs.createReadStream(req.file.path));
      formData.append('key', process.env.IMGBB_KEY);
      const imgbbResponse = await axios.post('https://api.imgbb.com/1/upload', formData, { headers: { ...formData.getHeaders() } });
      targetUrl = imgbbResponse.data.data.url;
      fs.unlinkSync(req.file.path);
    }
    if (!targetUrl) return res.status(400).json({ error: "이미지 URL 필요" });


    // --- [2단계] 구글 렌즈 (Visual Matches 확보) ---
    console.log(`🔍 [2단계] 이미지 분석 중...`);
    const lensResult = await getSerpData({
      engine: "google_lens",
      url: targetUrl,
      api_key: process.env.SERPAPI_KEY,
      hl: "en", country: "us",
    });

    let rawVisualMatches = lensResult.visual_matches || [];

    // 가장 유력한 제목 추출
    let bestTitle = "";
    if (lensResult.shopping_results?.length > 0) bestTitle = lensResult.shopping_results[0].title;
    else if (rawVisualMatches.length > 0) bestTitle = rawVisualMatches[0].title;

    if (!bestTitle) {
      // 제목조차 못 찾았으면 Visual Matches라도 보냄
      return res.json({
        message: "검색 완료 (유사 이미지만 발견)",
        count: rawVisualMatches.length,
        results: rawVisualMatches.map(i => ({ ...i, price: 0, currency: 'KRW', type: 'visual_match' }))
      });
    }

    // --- [3단계] 키워드 청소 및 쇼핑 검색 (재시도 로직 포함) ---
    const optimizedKeyword = cleanSearchQuery(bestTitle);
    console.log(`🧹 [3단계] 검색어 청소: "${bestTitle}" -> "${optimizedKeyword}"`);

    let additionalShoppingResults = [];

    try {
      console.log(`🛒 [4단계-A] 정밀 검색 시도: "${optimizedKeyword}"`);
      const shoppingData = await getSerpData({
        engine: "google_shopping",
        q: optimizedKeyword,
        api_key: process.env.SERPAPI_KEY,
        hl: "ko", gl: "kr",
      });

      if (shoppingData.shopping_results && shoppingData.shopping_results.length > 0) {
        additionalShoppingResults = shoppingData.shopping_results;
        console.log(`💰 1차 시도 성공! ${additionalShoppingResults.length}개 확보`);
      } else {
        throw new Error("결과 없음");
      }

    } catch (e) {
      // ★ [여기가 핵심] 1차 실패 시, 단어를 줄여서 2차 시도!
      console.log("⚠️ 1차 검색 실패. 키워드를 줄여서 재시도합니다...");

      // 공백 기준으로 단어를 자르고, 앞의 3개 단어만 씀 (예: "A B C D" -> "A B C")
      const simpleKeyword = optimizedKeyword.split(' ').slice(0, 3).join(' ');

      if (simpleKeyword && simpleKeyword !== optimizedKeyword) {
        console.log(`🛒 [4단계-B] 재시도 검색어: "${simpleKeyword}"`);
        try {
          const retryData = await getSerpData({
            engine: "google_shopping",
            q: simpleKeyword,
            api_key: process.env.SERPAPI_KEY,
            hl: "ko", gl: "kr",
          });
          if (retryData.shopping_results) {
            additionalShoppingResults = retryData.shopping_results;
            console.log(`💰 2차 시도 성공! ${additionalShoppingResults.length}개 확보`);
          }
        } catch (retryError) {
          console.log("❌ 2차 시도도 실패. 유사 이미지만 보여줍니다.");
        }
      }
    }

    // --- [5단계] 데이터 통합 ---
    const parseItem = (item, type) => {
      const rawPrice = item.price ? (item.price.extracted_value || item.price) : 0;
      let numericPrice = 0;
      if (typeof rawPrice === 'string') {
        numericPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
      } else {
        numericPrice = rawPrice;
      }
      const rawCurrency = item.price ? item.price.currency : 'KRW';
      const krwPrice = exchangeToKRW(numericPrice, rawCurrency);

      return {
        title: item.title,
        price: krwPrice,
        currency: 'KRW',
        thumbnail: item.thumbnail,
        link: item.link,
        source: item.source || item.merchant || "Unknown",
        type: type
      };
    };

    const p1 = additionalShoppingResults.map(i => parseItem(i, 'shopping_best'));
    const p2 = rawVisualMatches.map(i => parseItem(i, 'visual_match'));

    let finalResults = [...p1, ...p2];

    // ★ [추가됨] 링크가 없는(빈칸인) 상품은 아예 결과에서 제외하기!
    finalResults = finalResults.filter(item => item.link && item.link.trim() !== "");

    console.log(`🧹 링크 없는 항목 제거 후: ${finalResults.length}개 남음`);

    // 2. 정렬 (Sorting)
    finalResults.sort((a, b) => {
      if (a.price > 0 && b.price === 0) return -1;
      if (a.price === 0 && b.price > 0) return 1;
      return a.price - b.price;
    });

    console.log(`✅ 최종 응답: ${finalResults.length}개`);

    res.json({
      message: "검색 성공",
      count: finalResults.length,
      searchImage: targetUrl,
      searchKeyword: optimizedKeyword,
      results: finalResults
    });

  } catch (error) {
    console.error("Search Error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "서버 오류" });
  }
};