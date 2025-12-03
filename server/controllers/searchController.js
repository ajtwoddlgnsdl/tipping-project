// server/controllers/searchController.js
// [v2.0] Vision API 이미지 인식 + 최저가 검색 시스템

const vision = require('@google-cloud/vision');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

// Google Cloud Vision 클라이언트 초기화
let visionClient;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  visionClient = new vision.ImageAnnotatorClient({ credentials });
  console.log("Vision API: 환경변수 인증");
} else if (process.env.GOOGLE_CLOUD_KEY_PATH) {
  visionClient = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_CLOUD_KEY_PATH,
  });
  console.log("Vision API: 파일 경로 인증");
} else {
  console.error("Vision API: 인증 정보 없음!");
  visionClient = new vision.ImageAnnotatorClient();
}

// 브랜드 데이터베이스
const BRAND_DATABASE = [
  'Nike', 'Adidas', 'Puma', 'New Balance', 'Converse', 'Vans', 'Reebok', 'Asics', 'Fila',
  'Under Armour', 'Jordan', 'Skechers', 'Crocs', 'Birkenstock',
  'Gucci', 'Louis Vuitton', 'Chanel', 'Prada', 'Balenciaga', 'Dior', 'Burberry', 'Hermes',
  'Zara', 'H&M', 'Uniqlo', 'GAP', 'Mango',
  'The North Face', 'Patagonia', 'Columbia', 'Moncler', 'Canada Goose',
  'Apple', 'Samsung', 'LG', 'Sony', 'Bose', 'JBL', 'Dyson',
  'Canon', 'Nikon', 'Fujifilm', 'GoPro', 'DJI', 'Xiaomi',
  'AirPods', 'iPhone', 'iPad', 'MacBook', 'Galaxy', 'PlayStation', 'Nintendo',
];

// 영어-한글 브랜드 매핑
const BRAND_KR_MAP = {
  'nike': '나이키', 'adidas': '아디다스', 'puma': '푸마',
  'new balance': '뉴발란스', 'converse': '컨버스', 'vans': '반스',
  'the north face': '노스페이스', 'north face': '노스페이스',
  'apple': '애플', 'samsung': '삼성', 'sony': '소니', 'dyson': '다이슨',
  'gucci': '구찌', 'louis vuitton': '루이비통', 'chanel': '샤넬',
  'uniqlo': '유니클로', 'zara': '자라',
  'airpods': '에어팟', 'iphone': '아이폰', 'macbook': '맥북', 'galaxy': '갤럭시',
};

// 카테고리 매핑
const CATEGORY_KR_MAP = {
  'shoes': '신발', 'sneakers': '스니커즈', 'boots': '부츠',
  'shirt': '셔츠', 't-shirt': '티셔츠', 'pants': '바지', 'jeans': '청바지',
  'jacket': '자켓', 'coat': '코트', 'hoodie': '후드티',
  'bag': '가방', 'backpack': '백팩', 'handbag': '핸드백',
  'headphones': '헤드폰', 'earphones': '이어폰', 'watch': '시계',
};

// 검색어 정제
const cleanSearchQuery = (text) => {
  if (!text) return "";
  const noiseWords = [
    'Musinsa', 'Coupang', 'Naver', '29CM', 'Amazon', 'AliExpress', 'eBay',
    'Sale', 'Free Shipping', 'Best', 'Hot', 'New', 'Limited', 'Official',
    'www', 'http', 'https', 'com', 'co', 'kr', 'net',
    'Store', 'Shop', 'Online', 'Buy', 'Order', 'Image', 'Photo',
  ];
  let cleaned = text;
  noiseWords.forEach(word => {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });
  cleaned = cleaned.replace(/[|/\-_\[\](){}:;'"<>#@!?*&^%$~`+=]/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
};

// 영어를 한글로 변환
const translateToKorean = (text) => {
  if (!text) return text;
  let result = text.toLowerCase();
  for (const [eng, kr] of Object.entries(BRAND_KR_MAP)) {
    if (result.includes(eng)) result = result.replace(new RegExp(eng, 'gi'), kr);
  }
  for (const [eng, kr] of Object.entries(CATEGORY_KR_MAP)) {
    if (result.includes(eng)) result = result.replace(new RegExp(eng, 'gi'), kr);
  }
  return result;
};

// 브랜드 감지
const detectBrand = (entities) => {
  if (!entities || !Array.isArray(entities)) return null;
  const entityTexts = entities.filter(e => e && e.description).map(e => e.description.toLowerCase());
  for (const brand of BRAND_DATABASE) {
    if (entityTexts.some(text => text.includes(brand.toLowerCase()))) return brand;
  }
  return null;
};

// 검색 키워드 생성
const generateSearchKeyword = (bestGuessLabel, entities, brand) => {
  let keyword = "";
  if (bestGuessLabel) keyword = cleanSearchQuery(bestGuessLabel);
  if (brand && keyword && !keyword.toLowerCase().includes(brand.toLowerCase())) {
    keyword = `${brand} ${keyword}`;
  }
  if (!keyword && entities && entities.length > 0) {
    const topEntities = entities.filter(e => e && e.description && e.score > 0.3).slice(0, 3).map(e => e.description);
    keyword = topEntities.join(' ');
  }
  const koreanKeyword = translateToKorean(keyword);
  return { original: keyword, korean: koreanKeyword !== keyword.toLowerCase() ? koreanKeyword : null };
};

// Vision API - 웹 감지
const detectWebEntities = async (imageUrl) => {
  try {
    const [result] = await visionClient.webDetection(imageUrl);
    const webDetection = result.webDetection;
    if (!webDetection) return { entities: [], pages: [], bestGuessLabels: [] };
    console.log(`Vision API: ${webDetection.webEntities?.length || 0} entities, ${webDetection.bestGuessLabels?.map(l => l.label).join(', ') || 'no guess'}`);
    return {
      entities: webDetection.webEntities || [],
      pages: webDetection.pagesWithMatchingImages || [],
      bestGuessLabels: webDetection.bestGuessLabels || [],
    };
  } catch (error) {
    console.error("Vision API Error:", error.message);
    throw error;
  }
};

// Vision API - 라벨 감지
const detectLabels = async (imageUrl) => {
  try {
    const [result] = await visionClient.labelDetection(imageUrl);
    return (result.labelAnnotations || []).filter(l => l.score > 0.7).map(l => l.description);
  } catch (error) { return []; }
};

// Vision API - 로고 감지
const detectLogos = async (imageUrl) => {
  try {
    const [result] = await visionClient.logoDetection(imageUrl);
    return (result.logoAnnotations || []).filter(l => l.score > 0.5).map(l => l.description);
  } catch (error) { return []; }
};

// 네이버 쇼핑 검색
const searchNaverShopping = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[네이버] 검색: "${keyword}"`);
    const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&sort=price_asc`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    const selectors = ['div[class*="product_item"]', 'li[class*="product_item"]', 'div[class*="basicList_item"]'];
    for (const selector of selectors) {
      $(selector).slice(0, 12).each((i, el) => {
        const $el = $(el);
        let title = $el.find('[class*="product_title"]').text().trim() ||
                    $el.find('[class*="title"]').first().text().trim() ||
                    $el.find('a[title]').attr('title');
        let link = $el.find('a[href*="shopping"]').first().attr('href') ||
                   $el.find('a[href*="smartstore"]').first().attr('href') ||
                   $el.find('a').first().attr('href') || '';
        let priceText = $el.find('[class*="price_num"]').first().text() ||
                        $el.find('[class*="price"]').first().text();
        const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
        let thumbnail = $el.find('img[src]').first().attr('src') ||
                        $el.find('img[data-src]').first().attr('data-src') || '';
        const mall = $el.find('[class*="mall"]').text().trim() || '네이버쇼핑';
        if (title && link && title.length > 2) {
          if (!link.startsWith('http')) link = link.startsWith('//') ? 'https:' + link : 'https://search.shopping.naver.com' + link;
          if (thumbnail && !thumbnail.startsWith('http')) thumbnail = thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail;
          results.push({ title: cleanSearchQuery(title).substring(0, 100), price, currency: 'KRW', thumbnail, link, source: mall, type: 'shopping' });
        }
      });
      if (results.length >= 5) break;
    }
    console.log(`[네이버] ${results.length}개 상품`);
    return results;
  } catch (error) {
    console.error("[네이버] 에러:", error.message);
    return [];
  }
};

// 다나와 검색
const searchDanawa = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[다나와] 검색: "${keyword}"`);
    const searchUrl = `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(keyword)}&tab=main&sort=lowprice`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('li.prod_item, div.prod_item').slice(0, 8).each((i, el) => {
      const $el = $(el);
      const title = $el.find('.prod_name a').text().trim() || $el.find('[class*="prod_name"]').text().trim();
      const link = $el.find('.prod_name a').attr('href') || $el.find('a').first().attr('href') || '';
      const priceText = $el.find('.price_sect strong').text() || $el.find('[class*="price"] strong').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('.thumb_image img').attr('src') || $el.find('img').first().attr('src') || '';
      if (title && link) {
        results.push({
          title: cleanSearchQuery(title).substring(0, 100), price, currency: 'KRW',
          thumbnail: thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail,
          link: link.startsWith('http') ? link : `https://search.danawa.com${link}`,
          source: '다나와', type: 'shopping'
        });
      }
    });
    console.log(`[다나와] ${results.length}개 상품`);
    return results;
  } catch (error) {
    console.error("[다나와] 에러:", error.message);
    return [];
  }
};

// 11번가 검색
const search11st = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[11번가] 검색: "${keyword}"`);
    const searchUrl = `https://search.11st.co.kr/Search.tmall?kwd=${encodeURIComponent(keyword)}&sortCd=LWPR`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('li.c_item, div.c_item, li[data-log-body]').slice(0, 8).each((i, el) => {
      const $el = $(el);
      const title = $el.find('.c_tit a').text().trim() || $el.find('[class*="title"]').text().trim();
      let link = $el.find('.c_tit a').attr('href') || $el.find('a').first().attr('href') || '';
      const priceText = $el.find('.c_prc strong').text() || $el.find('[class*="price"] strong').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('.c_prd_img img').attr('src') || $el.find('img').first().attr('src') || '';
      if (title && link) {
        if (!link.startsWith('http')) link = `https://www.11st.co.kr${link}`;
        results.push({
          title: cleanSearchQuery(title).substring(0, 100), price, currency: 'KRW',
          thumbnail: thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail,
          link, source: '11번가', type: 'shopping'
        });
      }
    });
    console.log(`[11번가] ${results.length}개 상품`);
    return results;
  } catch (error) {
    console.error("[11번가] 에러:", error.message);
    return [];
  }
};

// G마켓 검색
const searchGmarket = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[G마켓] 검색: "${keyword}"`);
    const searchUrl = `https://browse.gmarket.co.kr/search?keyword=${encodeURIComponent(keyword)}&s=8`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('[class*="box__item-container"], li.item__content').slice(0, 8).each((i, el) => {
      const $el = $(el);
      const title = $el.find('[class*="text__item-title"]').text().trim() || $el.find('.item_tit').text().trim();
      let link = $el.find('a').first().attr('href') || '';
      const priceText = $el.find('[class*="text__value"]').first().text() || $el.find('[class*="price"]').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      if (title && link) {
        if (!link.startsWith('http')) link = link.startsWith('//') ? 'https:' + link : `https://browse.gmarket.co.kr${link}`;
        results.push({
          title: cleanSearchQuery(title).substring(0, 100), price, currency: 'KRW',
          thumbnail: thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail,
          link, source: 'G마켓', type: 'shopping'
        });
      }
    });
    console.log(`[G마켓] ${results.length}개 상품`);
    return results;
  } catch (error) {
    console.error("[G마켓] 에러:", error.message);
    return [];
  }
};

// SSG 검색
const searchSSG = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[SSG] 검색: "${keyword}"`);
    const searchUrl = `https://www.ssg.com/search.ssg?target=all&query=${encodeURIComponent(keyword)}&sort=price_asc`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('li.cunit_t232, li[class*="cunit"]').slice(0, 8).each((i, el) => {
      const $el = $(el);
      const title = $el.find('.cunit_info .title').text().trim() || $el.find('[class*="title"]').text().trim();
      let link = $el.find('a').first().attr('href') || '';
      const priceText = $el.find('.opt_price .ssg_price').text() || $el.find('[class*="price"]').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('.cunit_img img').attr('src') || $el.find('img').first().attr('src') || '';
      if (title && link) {
        if (!link.startsWith('http')) link = `https://www.ssg.com${link}`;
        results.push({
          title: cleanSearchQuery(title).substring(0, 100), price, currency: 'KRW',
          thumbnail: thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail,
          link, source: 'SSG', type: 'shopping'
        });
      }
    });
    console.log(`[SSG] ${results.length}개 상품`);
    return results;
  } catch (error) {
    console.error("[SSG] 에러:", error.message);
    return [];
  }
};

// 옥션 검색
const searchAuction = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[옥션] 검색: "${keyword}"`);
    const searchUrl = `https://browse.auction.co.kr/search?keyword=${encodeURIComponent(keyword)}&s=8`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9' }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('[class*="box__item-container"], li.item__content').slice(0, 8).each((i, el) => {
      const $el = $(el);
      const title = $el.find('[class*="text__item-title"]').text().trim() || $el.find('.item_tit').text().trim();
      let link = $el.find('a').first().attr('href') || '';
      const priceText = $el.find('[class*="text__value"]').first().text() || $el.find('[class*="price"]').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('img').attr('src') || '';
      if (title && link) {
        if (!link.startsWith('http')) link = link.startsWith('//') ? 'https:' + link : `https://browse.auction.co.kr${link}`;
        results.push({
          title: cleanSearchQuery(title).substring(0, 100), price, currency: 'KRW',
          thumbnail: thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail,
          link, source: '옥션', type: 'shopping'
        });
      }
    });
    console.log(`[옥션] ${results.length}개 상품`);
    return results;
  } catch (error) {
    console.error("[옥션] 에러:", error.message);
    return [];
  }
};

// 모든 쇼핑몰 동시 검색
const searchAllShoppingMalls = async (keyword, koreanKeyword) => {
  if (!keyword) return [];
  console.log(`\n=== 쇼핑몰 검색 시작: "${keyword}" ===`);
  if (koreanKeyword) console.log(`한글 키워드: "${koreanKeyword}"`);
  
  const searchPromises = [
    searchNaverShopping(keyword),
    searchDanawa(keyword),
    search11st(keyword),
    searchGmarket(keyword),
    searchSSG(keyword),
    searchAuction(keyword),
  ];
  
  if (koreanKeyword && koreanKeyword !== keyword.toLowerCase()) {
    searchPromises.push(searchNaverShopping(koreanKeyword));
    searchPromises.push(searchDanawa(koreanKeyword));
  }
  
  const allResults = await Promise.all(searchPromises);
  let combinedResults = allResults.flat();
  
  // 중복 제거
  const seenUrls = new Set();
  combinedResults = combinedResults.filter(item => {
    if (!item || !item.link) return false;
    const normalizedUrl = item.link.split('?')[0];
    if (seenUrls.has(normalizedUrl)) return false;
    seenUrls.add(normalizedUrl);
    return true;
  });
  
  // 가격순 정렬
  combinedResults.sort((a, b) => {
    if (a.price > 0 && b.price === 0) return -1;
    if (a.price === 0 && b.price > 0) return 1;
    return a.price - b.price;
  });
  
  console.log(`=== 총 ${combinedResults.length}개 상품 ===\n`);
  return combinedResults;
};

// ImgBB 업로드
const uploadToImgBB = async (filePath) => {
  const formData = new FormData();
  formData.append('image', fs.createReadStream(filePath));
  formData.append('key', process.env.IMGBB_KEY);
  const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
    headers: formData.getHeaders(),
    timeout: 30000,
  });
  return response.data.data.url;
};

// 메인 이미지 검색 API
exports.searchImage = async (req, res) => {
  const startTime = Date.now();
  try {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`이미지 검색 시작 - ${new Date().toLocaleString('ko-KR')}`);
    console.log(`${'='.repeat(50)}`);

    // [1단계] 이미지 URL 확보
    let targetUrl = req.body.imageUrl;
    if (req.file) {
      console.log(`\n[1단계] 이미지 업로드 중... (${req.file.originalname})`);
      targetUrl = await uploadToImgBB(req.file.path);
      fs.unlinkSync(req.file.path);
      console.log(`업로드 완료: ${targetUrl.substring(0, 50)}...`);
    }
    if (!targetUrl) {
      return res.status(400).json({ error: "이미지가 필요합니다." });
    }

    // [2단계] Vision API 분석
    console.log(`\n[2단계] Vision API 분석 중...`);
    const [webData, labels, logos] = await Promise.all([
      detectWebEntities(targetUrl),
      detectLabels(targetUrl),
      detectLogos(targetUrl),
    ]);

    const entities = webData.entities || [];
    const bestGuessLabels = webData.bestGuessLabels || [];
    const bestGuess = bestGuessLabels[0]?.label || "";
    
    const topEntities = entities.filter(e => e && e.description && e.score > 0.3).slice(0, 10);
    console.log(`베스트 추측: "${bestGuess}"`);
    console.log(`상위 엔티티: ${topEntities.map(e => e.description).join(', ')}`);
    if (labels.length > 0) console.log(`라벨: ${labels.slice(0, 5).join(', ')}`);
    if (logos.length > 0) console.log(`로고: ${logos.join(', ')}`);
    
    const detectedBrand = logos[0] || detectBrand(topEntities);
    if (detectedBrand) console.log(`감지된 브랜드: ${detectedBrand}`);

    // [3단계] 검색 키워드 생성
    console.log(`\n[3단계] 검색 키워드 생성 중...`);
    const keywords = generateSearchKeyword(bestGuess, topEntities, detectedBrand);
    console.log(`원본: "${keywords.original}"`);
    if (keywords.korean) console.log(`한글: "${keywords.korean}"`);
    
    if (!keywords.original) {
      console.log(`상품 인식 실패`);
      return res.json({
        success: false,
        message: "이미지에서 상품을 인식하지 못했습니다.",
        searchImage: targetUrl,
        searchKeyword: "",
        detectedBrand: null,
        detectedLabels: labels.slice(0, 5),
        detectedEntities: topEntities.map(e => e.description),
        count: 0,
        results: [],
        processingTime: `${Date.now() - startTime}ms`,
      });
    }

    // [4단계] 쇼핑몰 검색
    console.log(`\n[4단계] 쇼핑몰 검색 중...`);
    const shoppingResults = await searchAllShoppingMalls(keywords.original, keywords.korean);

    // [5단계] 응답
    const processingTime = Date.now() - startTime;
    console.log(`\n검색 완료! ${shoppingResults.length}개 상품`);
    if (shoppingResults.length > 0) {
      console.log(`최저가: ${shoppingResults[0].price.toLocaleString()}원 (${shoppingResults[0].source})`);
    }
    console.log(`처리 시간: ${processingTime}ms`);
    console.log(`${'='.repeat(50)}\n`);

    res.json({
      success: true,
      message: shoppingResults.length > 0 
        ? `"${keywords.original}" 검색 결과 ${shoppingResults.length}개 상품을 찾았습니다.`
        : "해당 상품의 판매처를 찾지 못했습니다.",
      searchImage: targetUrl,
      searchKeyword: keywords.original,
      searchKeywordKorean: keywords.korean,
      detectedBrand: detectedBrand,
      detectedLabels: labels.slice(0, 5),
      detectedEntities: topEntities.map(e => e.description),
      count: shoppingResults.length,
      results: shoppingResults.slice(0, 30),
      lowestPrice: shoppingResults[0] || null,
      processingTime: `${processingTime}ms`,
    });

  } catch (error) {
    console.error(`검색 오류:`, error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ 
      success: false,
      error: "서버 오류: " + error.message,
      processingTime: `${Date.now() - startTime}ms`,
    });
  }
};

// 키워드 검색 API
exports.searchByKeyword = async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: "검색 키워드가 필요합니다." });
    
    console.log(`키워드 검색: "${keyword}"`);
    const results = await searchAllShoppingMalls(keyword, translateToKorean(keyword));
    
    res.json({
      success: true,
      searchKeyword: keyword,
      count: results.length,
      results: results.slice(0, 30),
      lowestPrice: results[0] || null,
    });
  } catch (error) {
    console.error("키워드 검색 오류:", error);
    res.status(500).json({ error: "서버 오류: " + error.message });
  }
};
