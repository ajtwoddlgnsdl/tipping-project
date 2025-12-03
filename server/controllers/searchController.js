// server/controllers/searchController.js
const vision = require('@google-cloud/vision');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

// Google Cloud Vision 클라이언트 초기화
// 환경변수에서 JSON 인증 정보 읽기 (Render 배포용)
let visionClient;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  // 배포 환경: 환경변수에서 JSON 직접 파싱
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  visionClient = new vision.ImageAnnotatorClient({ credentials });
  console.log("Vision API: 환경변수 인증 사용");
} else if (process.env.GOOGLE_CLOUD_KEY_PATH) {
  // 로컬 환경: 파일 경로 사용
  visionClient = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_CLOUD_KEY_PATH,
  });
  console.log("Vision API: 파일 경로 인증 사용");
} else {
  console.error("Vision API: 인증 정보가 없습니다!");
  visionClient = new vision.ImageAnnotatorClient(); // 기본값 (실패할 수 있음)
}

// 🔍 웹페이지에서 가격 정보 스크래핑
const scrapePrice = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    const $ = cheerio.load(response.data);
    let price = 0;

    // 가격 추출 패턴들 (여러 사이트 대응)
    const priceSelectors = [
      // 일반적인 가격 선택자들
      '[class*="price"]',
      '[class*="Price"]',
      '[class*="cost"]',
      '[id*="price"]',
      '[data-price]',
      '.sale-price',
      '.final-price',
      '.product-price',
      // 한국 쇼핑몰 특화
      '.prd_price',
      '.product_price',
      '.sell_price',
      // 구조화된 데이터
      '[itemprop="price"]',
      'meta[property="product:price:amount"]',
    ];

    // 1. 구조화된 데이터 먼저 확인 (가장 정확함)
    const metaPrice = $('meta[property="product:price:amount"]').attr('content');
    if (metaPrice) {
      price = parseFloat(metaPrice.replace(/[^0-9.]/g, ''));
      if (price > 0) return { price, currency: 'KRW' };
    }

    const itemPropPrice = $('[itemprop="price"]').attr('content') || $('[itemprop="price"]').text();
    if (itemPropPrice) {
      price = parseFloat(itemPropPrice.replace(/[^0-9.]/g, ''));
      if (price > 0) return { price, currency: 'KRW' };
    }

    // 2. 일반 선택자들 시도
    for (const selector of priceSelectors) {
      const elements = $(selector);
      elements.each((_, el) => {
        const text = $(el).text() || $(el).attr('content') || '';
        // 숫자 추출 (콤마, 원, ₩ 등 제거)
        const match = text.match(/[\d,]+(?:\.\d+)?/);
        if (match) {
          const extracted = parseFloat(match[0].replace(/,/g, ''));
          // 합리적인 가격 범위 (100원 ~ 1억원)
          if (extracted >= 100 && extracted <= 100000000 && extracted > price) {
            price = extracted;
          }
        }
      });
      if (price > 0) break;
    }

    // 3. JSON-LD 구조화 데이터 확인
    if (price === 0) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const jsonLd = JSON.parse($(el).html());
          const findPrice = (obj) => {
            if (!obj) return;
            if (obj.price) return parseFloat(String(obj.price).replace(/[^0-9.]/g, ''));
            if (obj.offers?.price) return parseFloat(String(obj.offers.price).replace(/[^0-9.]/g, ''));
            if (Array.isArray(obj)) {
              for (const item of obj) {
                const found = findPrice(item);
                if (found) return found;
              }
            }
          };
          const found = findPrice(jsonLd);
          if (found && found > price) price = found;
        } catch (e) { /* JSON 파싱 실패 무시 */ }
      });
    }

    return { price: Math.round(price), currency: 'KRW' };

  } catch (error) {
    console.log(`⚠️ 스크래핑 실패 (${url.substring(0, 50)}...): ${error.message}`);
    return { price: 0, currency: 'KRW' };
  }
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

// 🌐 Google Cloud Vision - 웹 감지 (Web Detection)
const detectWebEntities = async (imageUrl) => {
  try {
    const [result] = await visionClient.webDetection(imageUrl);
    const webDetection = result.webDetection;

    if (!webDetection) {
      return { entities: [], pages: [], matches: [] };
    }

    return {
      // 웹 엔티티 (브랜드명, 상품명 등)
      entities: webDetection.webEntities || [],
      // 이미지가 포함된 페이지들 (쇼핑몰 URL 등)
      pages: webDetection.pagesWithMatchingImages || [],
      // 시각적으로 유사한 이미지들
      matches: webDetection.visuallySimilarImages || [],
      // 완전히 일치하는 이미지들
      fullMatches: webDetection.fullMatchingImages || [],
      // 부분 일치 이미지들
      partialMatches: webDetection.partialMatchingImages || [],
      // 베스트 추측 라벨 (상품명으로 활용)
      bestGuessLabels: webDetection.bestGuessLabels || [],
    };
  } catch (error) {
    console.error("Vision API Error:", error.message);
    throw error;
  }
};

// 3. [무료] 규칙 기반 검색어 청소기
const cleanSearchQuery = (title) => {
  if (!title) return "";
  const blockList = [
    'Musinsa', 'Coupang', 'Naver', '29CM', 'Zigzag', 'W Concept',
    'Amazon', 'AliExpress', 'Shein', 'Temu',
    'Sale', 'Free Shipping', 'Best', 'Rocket', 'Anolorcode',
    // URL/도메인 관련
    'www', 'http', 'https', 'com', 'co', 'kr', 'net',
    // 일반적인 노이즈
    'Official', 'Store', 'Shop', 'Online', 'Buy', 'Order'
  ];
  let cleaned = title;
  blockList.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });
  cleaned = cleaned.replace(/[|/\-_\[\](){}:;'"<>]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
};

// 🏪 쇼핑몰 URL인지 판별 (우선순위 높은 URL 필터링)
const isShoppingUrl = (url) => {
  const shoppingDomains = [
    // 한국
    'coupang.com', 'gmarket.co.kr', '11st.co.kr', 'auction.co.kr',
    'musinsa.com', 'zigzag.kr', '29cm.co.kr', 'wconcept.co.kr',
    'ssg.com', 'lotteon.com', 'tmon.co.kr', 'wemakeprice.com',
    'naver.com', 'smartstore.naver.com', 'shopping.naver.com',
    'brandi.co.kr', 'ably.com', 'oliveyoung.co.kr',
    // 글로벌
    'amazon.com', 'amazon.co.jp', 'ebay.com',
    'aliexpress.com', 'shein.com', 'temu.com',
    'uniqlo.com', 'zara.com', 'hm.com', 'nike.com', 'adidas.com',
    'asos.com', 'farfetch.com', 'ssense.com', 'mrporter.com',
  ];
  return shoppingDomains.some(domain => url.includes(domain));
};

// 🔗 URL에서 썸네일 이미지 추출 시도
const extractThumbnailFromPage = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    const $ = cheerio.load(response.data);
    
    // Open Graph 이미지
    let thumbnail = $('meta[property="og:image"]').attr('content');
    if (thumbnail) return thumbnail;
    
    // Twitter 카드 이미지
    thumbnail = $('meta[name="twitter:image"]').attr('content');
    if (thumbnail) return thumbnail;
    
    // 첫 번째 상품 이미지
    thumbnail = $('[class*="product"] img').first().attr('src');
    if (thumbnail) return thumbnail;
    
    return null;
  } catch {
    return null;
  }
};

exports.searchImage = async (req, res) => {
  try {
    // --- [1단계] 이미지 URL 확보 ---
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

    // --- [2단계] Google Cloud Vision API - 웹 감지 ---
    console.log(`🔍 [2단계] Google Vision API로 이미지 분석 중...`);
    const webData = await detectWebEntities(targetUrl);

    // 베스트 추측 라벨에서 검색 키워드 추출
    let bestKeyword = "";
    if (webData.bestGuessLabels.length > 0) {
      bestKeyword = webData.bestGuessLabels[0].label || "";
    }

    // 웹 엔티티에서 상품명/브랜드명 추출
    const topEntities = webData.entities
      .filter(e => e.score > 0.5)
      .slice(0, 5)
      .map(e => e.description);

    console.log(`🏷️ 감지된 엔티티: ${topEntities.join(', ')}`);
    console.log(`💡 베스트 추측: ${bestKeyword}`);

    // --- [3단계] 매칭 페이지들에서 상품 정보 추출 ---
    console.log(`🌐 [3단계] 매칭 페이지 ${webData.pages.length}개 분석 중...`);

    // 쇼핑몰 URL 우선 정렬
    const sortedPages = [...webData.pages].sort((a, b) => {
      const aIsShopping = isShoppingUrl(a.url) ? -1 : 1;
      const bIsShopping = isShoppingUrl(b.url) ? -1 : 1;
      return aIsShopping - bIsShopping;
    });

    // 상위 15개 페이지만 스크래핑 (성능상 제한)
    const pagesToScrape = sortedPages.slice(0, 15);

    // 병렬로 가격 스크래핑 (최대 5개씩)
    const results = [];
    const batchSize = 5;

    for (let i = 0; i < pagesToScrape.length; i += batchSize) {
      const batch = pagesToScrape.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (page) => {
          const priceData = await scrapePrice(page.url);
          
          // 페이지에서 제목 추출 (pageTitle 또는 이미지 제목)
          let title = page.pageTitle || "";
          if (!title && page.matchingImages?.length > 0) {
            title = page.matchingImages[0].title || "";
          }
          title = cleanSearchQuery(title);

          // 썸네일 추출
          let thumbnail = null;
          if (page.matchingImages?.length > 0) {
            thumbnail = page.matchingImages[0].url;
          }
          if (!thumbnail && page.fullMatchingImages?.length > 0) {
            thumbnail = page.fullMatchingImages[0].url;
          }

          return {
            title: title || bestKeyword || "상품명 확인 필요",
            price: priceData.price,
            currency: priceData.currency,
            thumbnail: thumbnail,
            link: page.url,
            source: new URL(page.url).hostname.replace('www.', ''),
            type: isShoppingUrl(page.url) ? 'shopping' : 'web_match'
          };
        })
      );
      results.push(...batchResults);
    }

    // --- [4단계] 유사 이미지 결과 추가 ---
    const similarImages = [
      ...webData.fullMatches,
      ...webData.partialMatches,
      ...webData.matches
    ].slice(0, 10);

    for (const img of similarImages) {
      // 이미 결과에 있는 URL은 스킵
      if (results.some(r => r.link === img.url)) continue;
      
      results.push({
        title: bestKeyword || topEntities[0] || "유사 상품",
        price: 0,
        currency: 'KRW',
        thumbnail: img.url,
        link: img.url,
        source: "유사 이미지",
        type: 'visual_match'
      });
    }

    // --- [5단계] 필터링 및 정렬 ---
    let finalResults = results.filter(item => item.link && item.link.trim() !== "");

    // 중복 URL 제거
    const seenUrls = new Set();
    finalResults = finalResults.filter(item => {
      if (seenUrls.has(item.link)) return false;
      seenUrls.add(item.link);
      return true;
    });

    // 정렬: 가격 있는 것 우선, 그 다음 가격 오름차순
    finalResults.sort((a, b) => {
      // 쇼핑몰 우선
      if (a.type === 'shopping' && b.type !== 'shopping') return -1;
      if (a.type !== 'shopping' && b.type === 'shopping') return 1;
      // 가격 있는 것 우선
      if (a.price > 0 && b.price === 0) return -1;
      if (a.price === 0 && b.price > 0) return 1;
      // 가격 오름차순
      return a.price - b.price;
    });

    console.log(`✅ 최종 응답: ${finalResults.length}개 상품`);

    res.json({
      message: "검색 성공",
      count: finalResults.length,
      searchImage: targetUrl,
      searchKeyword: bestKeyword || topEntities.join(' '),
      detectedEntities: topEntities,
      results: finalResults
    });

  } catch (error) {
    console.error("Search Error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "서버 오류: " + error.message });
  }
};