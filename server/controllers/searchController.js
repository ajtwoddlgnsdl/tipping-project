const { getJson } = require("serpapi");
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

exports.searchImage = async (req, res) => {
  try {
    let targetUrl = req.body.imageUrl; // 1. URL이 있으면 그걸 씀

    // 2. 파일이 업로드되었다면? ImgBB로 보내서 URL을 따옴 (징검다리)
    if (req.file) {
      console.log(`📤 이미지 호스팅 서버(ImgBB)로 업로드 중...`);
      
      const formData = new FormData();
      // ImgBB API 요구사항에 맞춰 파일 데이터 주입
      formData.append('image', fs.createReadStream(req.file.path));
      formData.append('key', process.env.IMGBB_KEY); // 내 API 키

      // ImgBB API 호출
      const imgbbResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
        headers: { ...formData.getHeaders() }
      });

      // 성공하면 공인 URL(http://...)을 받음
      targetUrl = imgbbResponse.data.data.url;
      console.log(`🌐 변환된 공인 URL: ${targetUrl}`);
      
      // (선택) 다 썼으니 로컬 파일은 삭제 (청소)
      fs.unlinkSync(req.file.path);
    }

    if (!targetUrl) {
      return res.status(400).json({ error: "이미지 파일이나 URL이 필요합니다." });
    }

    console.log(`🔍 구글 렌즈 검색 시작: ${targetUrl}`);

    // 3. 확보된 URL로 SerpApi 검색 (기존 로직과 동일)
    getJson({
      engine: "google_lens",
      url: targetUrl,
      api_key: process.env.SERPAPI_KEY,
      hl: "ko",
      country: "kr",
    }, (json) => {
      if (json.error) return res.status(500).json({ error: json.error });

      let parsedResults = [];

      // 쇼핑 결과 우선
      if (json.shopping_results) {
        const shoppingItems = json.shopping_results.map(item => ({
          title: item.title,
          price: item.price ? item.price.extracted_value : 0,
          currency: item.price ? item.price.currency : 'KRW',
          thumbnail: item.thumbnail,
          link: item.link,
          source: item.source,
          type: 'shopping'
        }));
        parsedResults = [...parsedResults, ...shoppingItems];
      }

      // 시각적 결과 (가격 있는 것만)
      if (json.visual_matches) {
        const visualItems = json.visual_matches
          .filter(item => item.price)
          .map(item => ({
            title: item.title,
            price: item.price.extracted_value,
            currency: item.price.currency,
            thumbnail: item.thumbnail,
            link: item.link,
            source: item.source,
            type: 'visual'
          }));
        parsedResults = [...parsedResults, ...visualItems];
      }

      if (parsedResults.length === 0) {
        return res.status(404).json({ error: "가격 정보를 찾지 못했습니다." });
      }

      // 최저가 정렬
      const sortedResults = parsedResults
        .filter(item => item.price > 0)
        .sort((a, b) => a.price - b.price);

      res.json({
        message: "검색 성공!",
        count: sortedResults.length,
        searchImage: targetUrl, // 검색에 쓴 이미지 주소도 알려줌
        results: sortedResults
      });
    });

  } catch (error) {
    console.error("Search/Upload Error:", error);
    // 에러 시 파일 청소
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "서버 내부 오류 (이미지 업로드 실패 등)" });
  }
};