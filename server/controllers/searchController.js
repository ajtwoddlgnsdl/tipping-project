// server/controllers/searchController.js
// [v3.0] 이미지 검색 시스템 - Vision API + SerpAPI (리팩터링)

const vision = require('@google-cloud/vision');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

// ============================================
// 설정 및 초기화
// ============================================

// Vision API 클라이언트
const visionClient = (() => {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.log("Vision API: 환경변수 인증");
    return new vision.ImageAnnotatorClient({
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    });
  }
  if (process.env.GOOGLE_CLOUD_KEY_PATH) {
    console.log("Vision API: 파일 경로 인증");
    return new vision.ImageAnnotatorClient({ keyFilename: process.env.GOOGLE_CLOUD_KEY_PATH });
  }
  console.error("Vision API: 인증 정보 없음!");
  return new vision.ImageAnnotatorClient();
})();

// ============================================
// 상수 정의
// ============================================

// 브랜드 DB
const BRANDS = [
  'Nike', 'Adidas', 'Puma', 'New Balance', 'Converse', 'Vans', 'Reebok', 'Asics', 'Fila',
  'Under Armour', 'Jordan', 'Skechers', 'Crocs', 'Birkenstock',
  'Gucci', 'Louis Vuitton', 'Chanel', 'Prada', 'Balenciaga', 'Dior', 'Burberry', 'Hermes',
  'Zara', 'H&M', 'Uniqlo', 'GAP', 'Mango',
  'The North Face', 'Patagonia', 'Columbia', 'Moncler', 'Canada Goose',
  'Apple', 'Samsung', 'LG', 'Sony', 'Bose', 'JBL', 'Dyson',
  'Canon', 'Nikon', 'Fujifilm', 'GoPro', 'DJI', 'Xiaomi',
  'AirPods', 'iPhone', 'iPad', 'MacBook', 'Galaxy', 'PlayStation', 'Nintendo',
];

// 한글 변환 매핑 (브랜드 + 카테고리)
const KR_MAP = {
  // 브랜드
  'nike': '나이키', 'adidas': '아디다스', 'puma': '푸마',
  'new balance': '뉴발란스', 'converse': '컨버스', 'vans': '반스',
  'the north face': '노스페이스', 'north face': '노스페이스',
  'apple': '애플', 'samsung': '삼성', 'sony': '소니', 'dyson': '다이슨',
  'gucci': '구찌', 'louis vuitton': '루이비통', 'chanel': '샤넬',
  'uniqlo': '유니클로', 'zara': '자라',
  'airpods': '에어팟', 'iphone': '아이폰', 'macbook': '맥북', 'galaxy': '갤럭시',
  // 카테고리
  'shoes': '신발', 'sneakers': '스니커즈', 'boots': '부츠',
  'shirt': '셔츠', 't-shirt': '티셔츠', 'pants': '바지', 'jeans': '청바지',
  'jacket': '자켓', 'coat': '코트', 'hoodie': '후드티',
  'bag': '가방', 'backpack': '백팩', 'handbag': '핸드백',
  'headphones': '헤드폰', 'earphones': '이어폰', 'watch': '시계',
};

// 필터링할 일반 단어
const GENERIC_WORDS = [
  'girl', 'boy', 'woman', 'man', 'person', 'trousers', 'clothing',
  'standing', 'fashion', 'sleeve', 'collar', 'outerwear', 'dress'
];

// 노이즈 단어
const NOISE_WORDS = [
  'Musinsa', 'Coupang', 'Naver', '29CM', 'Amazon', 'AliExpress', 'eBay',
  'Sale', 'Free Shipping', 'Best', 'Hot', 'New', 'Limited', 'Official',
  'www', 'http', 'https', 'com', 'co', 'kr', 'net',
  'Store', 'Shop', 'Online', 'Buy', 'Order', 'Image', 'Photo',
];

// ============================================
// 유틸리티 함수
// ============================================

// 검색어 정제
const cleanQuery = (text) => {
  if (!text) return "";
  let cleaned = text;
  NOISE_WORDS.forEach(word => {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });
  return cleaned.replace(/[|/\-_\[\](){}:;'"<>#@!?*&^%$~`+=]/g, ' ').replace(/\s+/g, ' ').trim();
};

// 한글 변환
const toKorean = (text) => {
  if (!text) return text;
  let result = text.toLowerCase();
  Object.entries(KR_MAP).forEach(([eng, kr]) => {
    result = result.replace(new RegExp(eng, 'gi'), kr);
  });
  return result;
};

// 브랜드 감지
const detectBrand = (entities = [], labels = [], logos = []) => {
  const allTexts = [...logos, ...(entities.map(e => e?.description) || []), ...labels]
    .map(t => t?.toLowerCase())
    .filter(Boolean);

  for (const brand of BRANDS) {
    if (allTexts.some(t => t.includes(brand.toLowerCase()))) return brand;
  }
  return logos[0] || null;
};

// 제목에서 키워드 추출
const extractKeywords = (title) => {
  if (!title) return [];
  const cleaned = title
    .replace(/사이즈.*|신세계.*|롯데.*|SSG|11번가|쿠팡|무료배송|할인|\d+%|\[.*?\]|\(.*?\)/gi, '')
    .replace(/[-_:]/g, ' ').replace(/\s+/g, ' ').trim();

  if (cleaned.length < 4 || cleaned.length > 50) return [];

  const keywords = [cleaned];
  const korean = cleaned.match(/[가-힣]{2,}/g);
  if (korean) keywords.push(...korean.filter(k => k.length > 2));

  return [...new Set(keywords)];
};

// ============================================
// Vision API 함수
// ============================================

const analyzeWithVision = async (imageUrl) => {
  try {
    const [webResult, labelResult, logoResult, textResult] = await Promise.all([
      visionClient.webDetection(imageUrl),
      visionClient.labelDetection(imageUrl),
      visionClient.logoDetection(imageUrl),
      visionClient.textDetection(imageUrl),
    ]);

    const webDetection = webResult[0]?.webDetection || {};
    const labels = (labelResult[0]?.labelAnnotations || []).filter(l => l.score > 0.7).map(l => l.description);
    const logos = (logoResult[0]?.logoAnnotations || []).filter(l => l.score > 0.5).map(l => l.description);
    const textAnnotations = textResult[0]?.textAnnotations || [];

    // OCR에서 브랜드 찾기
    const ocrText = textAnnotations[0]?.description || '';
    const ocrBrands = BRANDS.filter(b => ocrText.toLowerCase().includes(b.toLowerCase()));
    const ocrWords = textAnnotations.slice(1).map(t => t.description).filter(w => w.length > 2 && w.length < 30).slice(0, 10);

    console.log(`[Vision] Labels: ${labels.slice(0, 5).join(', ')}`);
    if (logos.length) console.log(`[Vision] Logos: ${logos.join(', ')}`);
    if (ocrBrands.length) console.log(`[Vision] OCR Brands: ${ocrBrands.join(', ')}`);

    return {
      entities: webDetection.webEntities || [],
      bestGuess: webDetection.bestGuessLabels?.[0]?.label || '',
      labels,
      logos: [...logos, ...ocrBrands],
      ocrWords,
    };
  } catch (error) {
    console.error("[Vision] 에러:", error.message);
    return { entities: [], bestGuess: '', labels: [], logos: [], ocrWords: [] };
  }
};

// ============================================
// SerpAPI 함수
// ============================================

const searchWithSerpAPI = async (imageUrl) => {
  const SERP_API_KEY = process.env.SERP_API_KEY;
  if (!SERP_API_KEY) {
    console.log('[SerpAPI] API 키 없음');
    return { productName: null, brand: null, keywords: [], shopping: [], visual: [] };
  }

  try {
    console.log('[SerpAPI] Google Lens 검색 중...');
    const { data } = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google_lens', url: imageUrl, api_key: SERP_API_KEY, hl: 'ko', country: 'kr' },
      timeout: 15000,
    });

    const keywords = [];
    const shopping = [];
    const visual = [];
    let brand = null;

    // Visual Matches 처리
    (data.visual_matches || []).slice(0, 20).forEach(match => {
      if (match.title) {
        keywords.push(...extractKeywords(match.title));
        BRANDS.forEach(b => {
          if (match.title.toLowerCase().includes(b.toLowerCase())) brand = brand || b;
        });
      }

      if (match.link || match.thumbnail) {
        const price = match.price
          ? parseInt(String(match.price.extracted_value || match.price.value || 0).replace(/\D/g, ''))
          : 0;
        const item = {
          name: match.title || '유사 상품',
          price,
          priceText: price > 0 ? `${price.toLocaleString()}원` : '가격 미정',
          link: match.link || '',
          image: match.thumbnail || '',
          source: match.source || 'Google',
          type: price > 0 ? 'shopping' : 'visual_match',
        };

        if (price > 0) shopping.push(item);
        visual.push(item);
      }
    });

    // Knowledge Graph
    const productName = data.knowledge_graph?.title || null;

    console.log(`[SerpAPI] 키워드: ${keywords.slice(0, 3).join(', ')} | 쇼핑: ${shopping.length}개`);

    return {
      productName,
      brand,
      keywords: [...new Set(keywords)].slice(0, 10),
      shopping: shopping.slice(0, 20),
      visual: visual.slice(0, 30),
    };
  } catch (error) {
    console.error('[SerpAPI] 에러:', error.message);
    return { productName: null, brand: null, keywords: [], shopping: [], visual: [] };
  }
};

// Google Shopping 검색
const searchGoogleShopping = async (keyword) => {
  const SERP_API_KEY = process.env.SERP_API_KEY;
  if (!SERP_API_KEY || !keyword) return [];

  try {
    const { data } = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google_shopping', q: keyword, api_key: SERP_API_KEY, hl: 'ko', gl: 'kr' },
      timeout: 10000,
    });

    return (data.shopping_results || []).slice(0, 10).map(item => ({
      name: cleanQuery(item.title || '').substring(0, 100),
      price: parseInt(String(item.extracted_price || item.price || 0).replace(/\D/g, '')) || 0,
      link: item.link || '',
      image: item.thumbnail || '',
      source: item.source || 'Google Shopping',
      type: 'shopping',
    }));
  } catch (error) {
    console.error('[Google Shopping] 에러:', error.message);
    return [];
  }
};

// ============================================
// 다나와 검색
// ============================================

const searchDanawa = async (keyword) => {
  if (!keyword) return [];

  try {
    console.log(`[다나와] 검색: "${keyword}"`);
    const { data } = await axios.get(
      `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(keyword)}&tab=main&sort=lowprice`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://www.danawa.com/',
        }
      }
    );

    const $ = cheerio.load(data);
    const results = [];

    $('li.prod_item, div.prod_item, ul.product_list li').slice(0, 10).each((_, el) => {
      const $el = $(el);
      const title = $el.find('.prod_name a, [class*="prod_name"]').text().trim();
      const link = $el.find('.prod_name a, .prod_info a, a').first().attr('href') || '';
      const price = parseInt($el.find('.price_sect strong, [class*="price"] strong').text().replace(/\D/g, '')) || 0;
      const image = $el.find('.thumb_image img').attr('src') || $el.find('img').first().attr('src') || '';

      if (title && link) {
        results.push({
          name: cleanQuery(title).substring(0, 100),
          price,
          link: link.startsWith('http') ? link : `https://prod.danawa.com${link}`,
          image: image.startsWith('//') ? `https:${image}` : image,
          source: '다나와',
          type: 'shopping',
        });
      }
    });

    console.log(`[다나와] ${results.length}개 상품`);
    return results;
  } catch (error) {
    console.error('[다나와] 에러:', error.message);
    return [];
  }
};

// ============================================
// ImgBB 업로드
// ============================================

const uploadImage = async (filePath) => {
  const apiKey = process.env.IMGBB_KEY;
  if (!apiKey) throw new Error('IMGBB_KEY 없음');

  const stats = fs.statSync(filePath);
  if (stats.size > 32 * 1024 * 1024) throw new Error('이미지 크기 초과 (최대 32MB)');

  const base64 = fs.readFileSync(filePath).toString('base64');
  const formData = new FormData();
  formData.append('image', base64);
  formData.append('key', apiKey);

  const { data } = await axios.post('https://api.imgbb.com/1/upload', formData, {
    headers: formData.getHeaders(),
    timeout: 60000,
  });

  if (!data?.data?.url) throw new Error('ImgBB 응답 오류');
  console.log('[ImgBB] 업로드 완료');
  return data.data.url;
};

// ============================================
// 통합 쇼핑몰 검색
// ============================================

const searchAllMalls = async (keywords, koreanKeywords = []) => {
  const keywordList = Array.isArray(keywords) ? keywords : [keywords];
  const koreanList = Array.isArray(koreanKeywords) ? koreanKeywords : (koreanKeywords ? [koreanKeywords] : []);

  if (!keywordList[0]) return [];

  console.log(`\n=== 쇼핑몰 검색 ===`);
  console.log(`키워드: ${keywordList.slice(0, 3).join(' | ')}`);

  // 다나와 검색 (가장 안정적)
  const searchPromises = keywordList.slice(0, 3).map(kw => searchDanawa(kw));

  // 한글 키워드도 추가 검색
  koreanList.slice(0, 2).forEach(kw => {
    if (!keywordList.some(k => k.toLowerCase() === kw.toLowerCase())) {
      searchPromises.push(searchDanawa(kw));
    }
  });

  const allResults = await Promise.all(searchPromises);
  let results = allResults.flat();

  // 중복 제거 (URL 기준)
  const seen = new Set();
  results = results.filter(item => {
    if (!item?.link) return false;
    const key = item.link.split('?')[0].toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 가격순 정렬
  results.sort((a, b) => {
    if (a.price > 0 && b.price === 0) return -1;
    if (a.price === 0 && b.price > 0) return 1;
    return a.price - b.price;
  });

  console.log(`=== 총 ${results.length}개 상품 ===\n`);
  return results;
};

// ============================================
// 메인 API
// ============================================

exports.searchImage = async (req, res) => {
  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(50)}\n이미지 검색 시작\n${'='.repeat(50)}`);

    // 1. 이미지 URL 확보
    let imageUrl = req.body.imageUrl;
    if (req.file) {
      console.log(`[1] 이미지 업로드: ${req.file.originalname}`);
      imageUrl = await uploadImage(req.file.path);
      fs.unlinkSync(req.file.path);
    }
    if (!imageUrl) return res.status(400).json({ error: "이미지가 필요합니다." });

    // 2. AI 분석 (병렬)
    console.log(`[2] AI 분석 중...`);
    const [vision, serp] = await Promise.all([
      analyzeWithVision(imageUrl),
      searchWithSerpAPI(imageUrl),
    ]);

    // 브랜드 감지
    const allLogos = [...vision.logos];
    if (serp.brand) allLogos.push(serp.brand);
    const brand = serp.brand || detectBrand(vision.entities, vision.labels, allLogos);
    console.log(`브랜드: ${brand || '미확인'}`);

    // 3. 키워드 생성 (SerpAPI 우선)
    const keywords = new Set();

    // SerpAPI 키워드 (최우선)
    serp.keywords.forEach(kw => keywords.add(kw));
    if (serp.productName) keywords.add(cleanQuery(serp.productName));

    // 브랜드 조합
    if (brand) {
      keywords.add(brand);
      serp.keywords.slice(0, 2).forEach(kw => {
        if (!kw.toLowerCase().includes(brand.toLowerCase())) {
          keywords.add(`${brand} ${kw}`);
        }
      });
    }

    // Vision 키워드 (일반 단어 제외)
    if (vision.bestGuess) {
      const cleaned = cleanQuery(vision.bestGuess);
      if (!GENERIC_WORDS.some(g => cleaned.toLowerCase().includes(g))) {
        keywords.add(cleaned);
      }
    }

    // 한글 키워드 생성
    const koreanKeywords = [];
    keywords.forEach(kw => {
      const kr = toKorean(kw);
      if (kr !== kw.toLowerCase() && kr.length > 2) koreanKeywords.push(kr);
    });

    const searchKeywords = [...keywords].filter(k => k.length > 2).slice(0, 7);
    console.log(`[3] 키워드 (${searchKeywords.length}개): ${searchKeywords.slice(0, 5).join(', ')}`);

    if (searchKeywords.length === 0) {
      return res.json({
        success: false,
        message: "상품을 인식하지 못했습니다.",
        searchImage: imageUrl,
        results: [],
        visualMatches: serp.visual,
        processingTime: `${Date.now() - startTime}ms`,
      });
    }

    // 4. 쇼핑 검색 (병렬)
    console.log(`[4] 쇼핑몰 검색 중...`);
    const [mallResults, ...googleResults] = await Promise.all([
      searchAllMalls(searchKeywords.slice(0, 3), koreanKeywords.slice(0, 2)),
      ...searchKeywords.slice(0, 5).map(kw => searchGoogleShopping(kw)),
    ]);

    // 결과 통합
    let allResults = [...mallResults, ...googleResults.flat(), ...serp.shopping];

    // 중복 제거
    const seen = new Set();
    allResults = allResults.filter(item => {
      if (!item?.link) return false;
      const key = item.link.split('?')[0].toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 가격순 정렬
    allResults.sort((a, b) => {
      if (a.price > 0 && b.price === 0) return -1;
      if (a.price === 0 && b.price > 0) return 1;
      return a.price - b.price;
    });

    // 가격 없는 유사 이미지 추가
    const noPriceVisuals = serp.visual.filter(v => v.price === 0 && v.link).slice(0, 10);
    if (noPriceVisuals.length > 0) allResults.push(...noPriceVisuals);

    // 5. 응답
    const processingTime = Date.now() - startTime;
    console.log(`\n검색 완료! ${allResults.length}개 | ${processingTime}ms\n${'='.repeat(50)}\n`);

    res.json({
      success: true,
      message: `${allResults.length}개 상품을 찾았습니다.`,
      searchImage: imageUrl,
      searchKeyword: searchKeywords[0] || '',
      searchKeywords,
      searchKeywordsKorean: koreanKeywords,
      detectedBrand: brand,
      detectedLabels: vision.labels.slice(0, 5),
      detectedEntities: vision.entities.slice(0, 5).map(e => e.description),
      serpProductName: serp.productName,
      count: allResults.length,
      results: allResults.slice(0, 60),
      visualMatches: serp.visual,
      lowestPrice: allResults.find(r => r.price > 0) || null,
      processingTime: `${processingTime}ms`,
    });

  } catch (error) {
    console.error('검색 오류:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({
      success: false,
      error: error.message,
      processingTime: `${Date.now() - startTime}ms`,
    });
  }
};

// 키워드 검색 API
exports.searchByKeyword = async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: "키워드가 필요합니다." });

    console.log(`키워드 검색: "${keyword}"`);
    const results = await searchAllMalls([keyword], [toKorean(keyword)]);

    res.json({
      success: true,
      keyword,
      count: results.length,
      results: results.slice(0, 30),
      lowestPrice: results[0] || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 배경 제거 API
exports.removeBackground = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "이미지가 필요합니다." });

    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      // API 키 없으면 원본 반환
      const buffer = fs.readFileSync(req.file.path);
      fs.unlinkSync(req.file.path);
      res.set('Content-Type', 'image/png');
      return res.send(buffer);
    }

    const formData = new FormData();
    formData.append('image_file', fs.createReadStream(req.file.path));
    formData.append('size', 'auto');

    const { data } = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: { ...formData.getHeaders(), 'X-Api-Key': apiKey },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    fs.unlinkSync(req.file.path);
    res.set('Content-Type', 'image/png');
    res.send(Buffer.from(data));
    console.log('배경 제거 완료');
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
};
