import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:3000/api', // 백엔드 기본 주소
  headers: {
    'Content-Type': 'application/json',
  },
});

// [베테랑의 꿀팁] 요청 채기(Interceptor)
// 요청을 보내기 직전에 "토큰이 있다면 자동으로 헤더에 붙여줘!" 라는 설정입니다.
// 이걸 해두면 로그인 후에는 신경 안 써도 알아서 토큰을 달고 요청이 나갑니다.
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // 브라우저 저장소에서 토큰 꺼내기
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default instance;