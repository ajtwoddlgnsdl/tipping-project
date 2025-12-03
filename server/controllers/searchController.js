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

// 다중 검색 키워드 생성 (여러 조합 생성)
const generateMultipleSearchKeywords = (bestGuessLabel, entities, brand, labels, logos) => {
  const keywords = new Set();
  const koreanKeywords = new Set();
  
  // 1. bestGuessLabel 기반 키워드
  if (bestGuessLabel) {
    const cleaned = cleanSearchQuery(bestGuessLabel);
    if (cleaned.length > 2) {
      keywords.add(cleaned);
      // 브랜드 추가 버전
      if (brand && !cleaned.toLowerCase().includes(brand.toLowerCase())) {
        keywords.add(`${brand} ${cleaned}`);
      }
    }
  }
  
  // 2. 엔티티 기반 키워드 (높은 점수 순)
  if (entities && entities.length > 0) {
    const topEntities = entities
      .filter(e => e && e.description && e.score > 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    // 모델명이나 제품명처럼 보이는 엔티티 찾기
    topEntities.forEach(entity => {
      const desc = cleanSearchQuery(entity.description);
      if (desc.length > 2 && desc.split(' ').length <= 5) {
        // 브랜드만 있는 것은 제외
        if (!BRAND_DATABASE.some(b => b.toLowerCase() === desc.toLowerCase())) {
          keywords.add(desc);
          if (brand && !desc.toLowerCase().includes(brand.toLowerCase())) {
            keywords.add(`${brand} ${desc}`);
          }
        }
      }
    });
    
    // 상위 2-3개 엔티티 조합
    if (topEntities.length >= 2) {
      const combo = topEntities.slice(0, 3).map(e => cleanSearchQuery(e.description)).join(' ');
      if (combo.length > 5) keywords.add(combo);
    }
  }
  
  // 3. 로고(브랜드) + 라벨 조합
  if (logos && logos.length > 0 && labels && labels.length > 0) {
    const brandName = logos[0];
    const productType = labels.find(l => 
      ['shoes', 'sneakers', 'shirt', 'bag', 'headphones', 'watch', 'jacket'].some(type => 
        l.toLowerCase().includes(type)
      )
    );
    if (productType) {
      keywords.add(`${brandName} ${productType}`);
    }
  }
  
  // 4. 브랜드 + 카테고리 라벨 조합
  if (brand && labels && labels.length > 0) {
    labels.slice(0, 3).forEach(label => {
      const cleaned = cleanSearchQuery(label);
      if (cleaned.length > 2) {
        keywords.add(`${brand} ${cleaned}`);
      }
    });
  }
  
  // 한글 키워드 생성
  keywords.forEach(kw => {
    const korean = translateToKorean(kw);
    if (korean !== kw.toLowerCase() && korean.length > 2) {
      koreanKeywords.add(korean);
    }
  });
  
  // 최대 6개 키워드 반환 (중복 제거)
  const uniqueKeywords = [...keywords].filter(k => k && k.length > 2).slice(0, 6);
  const uniqueKoreanKeywords = [...koreanKeywords].filter(k => k && k.length > 2).slice(0, 4);
  
  console.log(`생성된 검색 키워드 (${uniqueKeywords.length}개):`, uniqueKeywords);
  if (uniqueKoreanKeywords.length > 0) {
    console.log(`한글 키워드 (${uniqueKoreanKeywords.length}개):`, uniqueKoreanKeywords);
  }
  
  return {
    keywords: uniqueKeywords,
    koreanKeywords: uniqueKoreanKeywords,
    primary: uniqueKeywords[0] || '',
    primaryKorean: uniqueKoreanKeywords[0] || null,
  };
};

// 검색 키워드 생성 (단일 - 하위 호환용)
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

// 네이버 쇼핑 API 검색 (공식 API 사용 - 가장 안정적)
const searchNaverShoppingAPI = async (keyword) => {
  try {
    if (!keyword) return [];
    
    // 네이버 API 키가 없으면 스킵
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
      console.log(`[네이버API] API 키 없음, 스킵`);
      return [];
    }
    
    console.log(`[네이버API] 검색: "${keyword}"`);
    const searchUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=15&sort=asc`;
    
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
      }
    });
    
    const items = response.data.items || [];
    const results = items.map(item => ({
      title: cleanSearchQuery(item.title.replace(/<[^>]*>/g, '')).substring(0, 100),
      price: parseInt(item.lprice) || 0,
      currency: 'KRW',
      thumbnail: item.image || '',
      link: item.link || '',
      source: item.mallName || '네이버쇼핑',
      type: 'shopping',
      productId: item.productId,
    }));
    
    console.log(`[네이버API] ${results.length}개 상품`);
    return results;
  } catch (error) {
    console.error("[네이버API] 에러:", error.message);
    return [];
  }
};

// 네이버 쇼핑 검색 (스크래핑 - API 없을 때 백업)
const searchNaverShopping = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[네이버] 검색: "${keyword}"`);
    
    // 모바일 페이지가 봇 차단이 덜함
    const searchUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&sort=price_asc`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    const selectors = ['div[class*="product_item"]', 'li[class*="product_item"]', 'div[class*="basicList_item"]', 'a[class*="product"]'];
    for (const selector of selectors) {
      $(selector).slice(0, 12).each((i, el) => {
        const $el = $(el);
        let title = $el.find('[class*="product_title"]').text().trim() ||
                    $el.find('[class*="title"]').first().text().trim() ||
                    $el.find('a[title]').attr('title') ||
                    $el.text().trim().substring(0, 50);
        let link = $el.find('a[href*="shopping"]').first().attr('href') ||
                   $el.find('a[href*="smartstore"]').first().attr('href') ||
                   $el.attr('href') ||
                   $el.find('a').first().attr('href') || '';
        let priceText = $el.find('[class*="price_num"]').first().text() ||
                        $el.find('[class*="price"]').first().text();
        const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
        let thumbnail = $el.find('img[src]').first().attr('src') ||
                        $el.find('img[data-src]').first().attr('data-src') || '';
        const mall = $el.find('[class*="mall"]').text().trim() || '네이버쇼핑';
        if (title && link && title.length > 2) {
          if (!link.startsWith('http')) link = link.startsWith('//') ? 'https:' + link : 'https://msearch.shopping.naver.com' + link;
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

// 다나와 검색 (봇 차단 적음)
const searchDanawa = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[다나와] 검색: "${keyword}"`);
    const searchUrl = `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(keyword)}&tab=main&sort=lowprice`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.danawa.com/',
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('li.prod_item, div.prod_item, ul.product_list li').slice(0, 10).each((i, el) => {
      const $el = $(el);
      const title = $el.find('.prod_name a').text().trim() || 
                    $el.find('[class*="prod_name"]').text().trim() ||
                    $el.find('.prod_info a').text().trim();
      const link = $el.find('.prod_name a').attr('href') || 
                   $el.find('.prod_info a').attr('href') ||
                   $el.find('a').first().attr('href') || '';
      const priceText = $el.find('.price_sect strong').text() || 
                        $el.find('[class*="price"] strong').text() ||
                        $el.find('.prod_pricelist em').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('.thumb_image img').attr('src') || 
                        $el.find('.thumb_image img').attr('data-src') ||
                        $el.find('img').first().attr('src') || '';
      if (title && link) {
        results.push({
          title: cleanSearchQuery(title).substring(0, 100), price, currency: 'KRW',
          thumbnail: thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail,
          link: link.startsWith('http') ? link : `https://prod.danawa.com${link}`,
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

// 11번가 검색 (API 사용)
const search11st = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[11번가] 검색: "${keyword}"`);
    
    // 11번가 모바일 (봇 차단 완화)
    const searchUrl = `https://m.11st.co.kr/search/searchList.tmall?searchKeyword=${encodeURIComponent(keyword)}&sortCd=LWPR`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('li[class*="item"], div[class*="product"], .c_item').slice(0, 10).each((i, el) => {
      const $el = $(el);
      const title = $el.find('[class*="title"]').text().trim() || 
                    $el.find('.c_tit a').text().trim() ||
                    $el.find('a').first().text().trim();
      let link = $el.find('a[href*="products"]').attr('href') ||
                 $el.find('.c_tit a').attr('href') || 
                 $el.find('a').first().attr('href') || '';
      const priceText = $el.find('[class*="price"]').first().text() ||
                        $el.find('.c_prc strong').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      if (title && link && title.length > 2) {
        if (!link.startsWith('http')) link = `https://m.11st.co.kr${link}`;
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

// G마켓 검색 (모바일 버전으로 변경 - 봇 차단 완화)
const searchGmarket = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[G마켓] 검색: "${keyword}"`);
    
    // 모바일 G마켓 사용
    const searchUrl = `https://m.gmarket.co.kr/n/search?keyword=${encodeURIComponent(keyword)}&sort=PRICE_ASC`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('div[class*="item"], li[class*="item"], .box__item-container, [class*="product"]').slice(0, 10).each((i, el) => {
      const $el = $(el);
      const title = $el.find('[class*="title"]').text().trim() ||
                    $el.find('.link__item').text().trim() ||
                    $el.find('a').text().trim();
      let link = $el.find('a[href*="item"]').attr('href') ||
                 $el.find('a').first().attr('href') || '';
      const priceText = $el.find('[class*="price"]').text() ||
                        $el.find('.text__value').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      if (title && link && title.length > 2) {
        if (!link.startsWith('http')) link = `https://m.gmarket.co.kr${link}`;
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

// SSG 검색 (헤더 강화)
const searchSSG = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[SSG] 검색: "${keyword}"`);
    const searchUrl = `https://www.ssg.com/search.ssg?target=all&query=${encodeURIComponent(keyword)}&sort=price_asc`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('li.cunit_t232, li[class*="cunit"], div.cunit').slice(0, 10).each((i, el) => {
      const $el = $(el);
      const title = $el.find('.cunit_info .title').text().trim() || 
                    $el.find('[class*="title"]').text().trim() ||
                    $el.find('.tit').text().trim();
      let link = $el.find('a').first().attr('href') || '';
      const priceText = $el.find('.opt_price .ssg_price').text() || 
                        $el.find('[class*="price"]').text() ||
                        $el.find('.price').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('.cunit_img img').attr('src') || 
                        $el.find('img').first().attr('src') || 
                        $el.find('img').first().attr('data-src') || '';
      if (title && link && title.length > 2) {
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

// 옥션 검색 (모바일 버전으로 변경 - 봇 차단 완화)
const searchAuction = async (keyword) => {
  try {
    if (!keyword) return [];
    console.log(`[옥션] 검색: "${keyword}"`);
    
    // 모바일 옥션 사용
    const searchUrl = `https://m.auction.co.kr/n/search?keyword=${encodeURIComponent(keyword)}&sort=PRICE_ASC`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      }
    });
    const $ = cheerio.load(response.data);
    const results = [];
    $('div[class*="item"], li[class*="item"], .box__item-container, [class*="product"]').slice(0, 10).each((i, el) => {
      const $el = $(el);
      const title = $el.find('[class*="title"]').text().trim() ||
                    $el.find('.link__item').text().trim() ||
                    $el.find('a').text().trim();
      let link = $el.find('a[href*="item"]').attr('href') ||
                 $el.find('a').first().attr('href') || '';
      const priceText = $el.find('[class*="price"]').text() ||
                        $el.find('.text__value').text();
      const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
      const thumbnail = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
      if (title && link && title.length > 2) {
        if (!link.startsWith('http')) link = `https://m.auction.co.kr${link}`;
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

// 모든 쇼핑몰 동시 검색 (다중 키워드 지원)
const searchAllShoppingMalls = async (keywords, koreanKeywords) => {
  // 배열이 아니면 배열로 변환
  const keywordList = Array.isArray(keywords) ? keywords : [keywords];
  const koreanKeywordList = Array.isArray(koreanKeywords) ? koreanKeywords : (koreanKeywords ? [koreanKeywords] : []);
  
  if (keywordList.length === 0 || !keywordList[0]) return [];
  
  console.log(`\n=== 쇼핑몰 검색 시작 ===`);
  console.log(`키워드 (${keywordList.length}개): ${keywordList.join(' | ')}`);
  if (koreanKeywordList.length > 0) {
    console.log(`한글 (${koreanKeywordList.length}개): ${koreanKeywordList.join(' | ')}`);
  }
  
  const searchPromises = [];
  
  // 안정적인 쇼핑몰만 사용 (다나와, 11번가, SSG)
  // 네이버, G마켓, 옥션은 봇 차단이 심해서 제외
  const stableSearchFunctions = [
    { fn: searchDanawa, name: '다나와' },
    { fn: search11st, name: '11번가' },
    { fn: searchSSG, name: 'SSG' },
  ];
  
  // 각 키워드에 대해 안정적인 쇼핑몰 검색
  keywordList.forEach(keyword => {
    stableSearchFunctions.forEach(({ fn }) => {
      searchPromises.push(fn(keyword));
    });
  });
  
  // 한글 키워드로도 검색 (중복 제거됨)
  koreanKeywordList.forEach(keyword => {
    if (!keywordList.some(k => k.toLowerCase() === keyword.toLowerCase())) {
      stableSearchFunctions.forEach(({ fn }) => {
        searchPromises.push(fn(keyword));
      });
    }
  });
  
  // 네이버는 첫 번째 키워드만 시도 (실패해도 괜찮음)
  searchPromises.push(searchNaverShopping(keywordList[0]).catch(() => []));
  if (koreanKeywordList[0]) {
    searchPromises.push(searchNaverShopping(koreanKeywordList[0]).catch(() => []));
  }
  
  const allResults = await Promise.all(searchPromises);
  let combinedResults = allResults.flat();
  
  // 중복 제거 (URL 기준)
  const seenUrls = new Set();
  combinedResults = combinedResults.filter(item => {
    if (!item || !item.link) return false;
    const normalizedUrl = item.link.split('?')[0].toLowerCase();
    if (seenUrls.has(normalizedUrl)) return false;
    seenUrls.add(normalizedUrl);
    return true;
  });
  
  // 제목 기준 중복 제거 (유사도)
  const seenTitles = new Set();
  combinedResults = combinedResults.filter(item => {
    const normalizedTitle = item.title.toLowerCase().replace(/\s+/g, '').substring(0, 30);
    if (seenTitles.has(normalizedTitle)) return false;
    seenTitles.add(normalizedTitle);
    return true;
  });
  
  // 가격순 정렬 (가격 있는 것 우선)
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

    // [3단계] 다중 검색 키워드 생성 (개선됨)
    console.log(`\n[3단계] 다중 검색 키워드 생성 중...`);
    const multiKeywords = generateMultipleSearchKeywords(bestGuess, topEntities, detectedBrand, labels, logos);
    
    if (multiKeywords.keywords.length === 0) {
      console.log(`상품 인식 실패`);
      return res.json({
        success: false,
        message: "이미지에서 상품을 인식하지 못했습니다.",
        searchImage: targetUrl,
        searchKeyword: "",
        searchKeywords: [],
        detectedBrand: null,
        detectedLabels: labels.slice(0, 5),
        detectedEntities: topEntities.map(e => e.description),
        count: 0,
        results: [],
        processingTime: `${Date.now() - startTime}ms`,
      });
    }

    // [4단계] 쇼핑몰 검색 (다중 키워드 사용)
    console.log(`\n[4단계] 쇼핑몰 검색 중... (${multiKeywords.keywords.length}개 키워드)`);
    const shoppingResults = await searchAllShoppingMalls(multiKeywords.keywords, multiKeywords.koreanKeywords);

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
        ? `${multiKeywords.keywords.length}개 키워드로 검색하여 ${shoppingResults.length}개 상품을 찾았습니다.`
        : "해당 상품의 판매처를 찾지 못했습니다.",
      searchImage: targetUrl,
      searchKeyword: multiKeywords.primary,
      searchKeywords: multiKeywords.keywords,
      searchKeywordsKorean: multiKeywords.koreanKeywords,
      detectedBrand: detectedBrand,
      detectedLabels: labels.slice(0, 5),
      detectedEntities: topEntities.map(e => e.description),
      count: shoppingResults.length,
      results: shoppingResults.slice(0, 50),
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
