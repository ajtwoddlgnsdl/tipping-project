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

// 2. 환율 계산기
const exchangeToKRW = (price, currency) => {
  if (!price) return 0;
  const curr = currency ? currency.toString().toUpperCase().trim() : 'KRW';
  
  if (curr.includes('KRW') || curr.includes('₩')) return Math.round(price);
  if (curr.includes('USD') || curr.includes('$')) return Math.round(price * 1430);
  if (curr.includes('JPY') || curr.includes('¥')) return Math.round(price * 9.5);
  if (curr.includes('CNY') || curr.includes('RMB')) return Math.round(price * 195);
  if (curr.includes('EUR')) return Math.round(price * 1550);
  
  return Math.round(price);
};

// 3. 검색어 청소기
const cleanSearchQuery = (title) => {
  if (!title) return "";
  let cleaned = title.replace(/[|/\-_\[\]]/g, ' ');
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


    // --- [2단계] 구글 렌즈 검색 (Visual Matches 확보용) ---
    console.log(`🔍 [2단계] 이미지 전체 스캔 중...`);
    
    const lensResult = await getSerpData({
      engine: "google_lens",
      url: targetUrl,
      api_key: process.env.SERPAPI_KEY,
      hl: "en", country: "us", 
    });

    // 2-1. 일단 렌즈 결과(Visual Matches)를 확보해둡니다. (가격 없어도 OK)
    let rawVisualMatches = [];
    if (lensResult.visual_matches) {
        rawVisualMatches = lensResult.visual_matches;
        console.log(`📸 유사 이미지 ${rawVisualMatches.length}개 발견`);
    }

    // --- [3단계] 연쇄 검색 (쇼핑 데이터 확보용) ---
    // 가장 정확한 상품명을 하나 뽑아서 쇼핑 API를 돌립니다.
    let bestTitle = "";
    if (lensResult.shopping_results?.length > 0) bestTitle = lensResult.shopping_results[0].title;
    else if (rawVisualMatches.length > 0) bestTitle = rawVisualMatches[0].title;

    let additionalShoppingResults = [];
    
    if (bestTitle) {
        const cleanedTitle = cleanSearchQuery(bestTitle);
        console.log(`🛒 [3단계] "${cleanedTitle}" 가격 정보 정밀 탐색...`);
        
        try {
            const shoppingData = await getSerpData({
                engine: "google_shopping",
                q: cleanedTitle,
                api_key: process.env.SERPAPI_KEY,
                hl: "ko", gl: "kr", // 가격은 한국 기준
            });
            
            if (shoppingData.shopping_results) {
                additionalShoppingResults = shoppingData.shopping_results;
                console.log(`💰 쇼핑 데이터 ${additionalShoppingResults.length}개 추가 확보`);
            }
        } catch (e) {
            console.log("⚠️ 쇼핑 검색 실패 (무시하고 진행)");
        }
    }

    // --- [4단계] 데이터 통합 (Merge) ---
    let finalResults = [];

    // 공통 파싱 함수
    const parseItem = (item, type) => {
        const rawPrice = item.price ? (item.price.extracted_value || item.price) : 0;
        const rawCurrency = item.price ? item.price.currency : 'KRW';
        
        // 구글 쇼핑은 가격이 문자열일 수 있음 ($35.00)
        let numericPrice = 0;
        if (typeof rawPrice === 'string') {
            numericPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, ''));
        } else {
            numericPrice = rawPrice;
        }

        const krwPrice = exchangeToKRW(numericPrice, rawCurrency);

        return {
          title: item.title,
          price: krwPrice, // 가격 없으면 0
          currency: 'KRW',
          thumbnail: item.thumbnail,
          link: item.link,
          source: item.source || item.merchant || "Unknown",
          type: type // 'shopping' 또는 'visual'
        };
    };

    // 1. 쇼핑 검색 결과 (정확도 높음, 가격 있음) -> 상단 배치
    const p1 = additionalShoppingResults.map(i => parseItem(i, 'shopping_best'));
    
    // 2. 렌즈 결과 (개수 많음, 가격 없을 수 있음) -> 하단 배치
    const p2 = rawVisualMatches.map(i => parseItem(i, 'visual_match'));

    // 두 리스트 합치기
    finalResults = [...p1, ...p2];

    // --- [5단계] 정렬 (Sorting) ---
    // 규칙: 가격이 있는 것(>0)을 위로, 가격 없는 것(0)은 아래로.
    // 가격이 있는 것끼리는 싼 순서대로.
    finalResults.sort((a, b) => {
        if (a.price > 0 && b.price === 0) return -1; // a가 위로
        if (a.price === 0 && b.price > 0) return 1;  // b가 위로
        if (a.price === 0 && b.price === 0) return 0; // 둘 다 없으면 그대로
        return a.price - b.price; // 둘 다 있으면 최저가순
    });

    console.log(`✅ 최종 응답: 총 ${finalResults.length}개 아이템`);

    res.json({
      message: "검색 성공",
      count: finalResults.length,
      searchImage: targetUrl,
      searchKeyword: bestTitle,
      results: finalResults
    });

  } catch (error) {
    console.error("Hybrid Search Error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    // 에러 나도 빈 배열 줘서 프론트 죽지 않게 함
    res.json({ message: "검색 실패", count: 0, results: [] });
  }
};