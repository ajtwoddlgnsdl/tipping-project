import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { GoogleLogin } from '@react-oauth/google';
import axios from '../api/axios';

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/auth/login', formData);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      toast.success(`환영합니다, ${response.data.user.nickname}님! 👋`);
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || "로그인 실패!");
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      console.log("구글 credential 수신:", credentialResponse.credential ? "있음" : "없음");
      const response = await axios.post('/auth/google', {
        token: credentialResponse.credential
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      toast.success(`구글 로그인 성공! 반가워요 ${user.nickname}님`);
      navigate('/');
    } catch (error) {
      console.error("구글 로그인 서버 에러:", error.response?.data || error);
      toast.error(error.response?.data?.error || "구글 로그인 실패");
    }
  };

  useEffect(() => {
    // window.Kakao가 있고, 아직 초기화 안 됐으면 초기화
    if (window.Kakao && !window.Kakao.isInitialized()) {
      // 환경변수에서 카카오 JavaScript 키 가져오기
      const kakaoKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;
      if (kakaoKey) {
        window.Kakao.init(kakaoKey);
      } else {
        console.error('카카오 JavaScript 키가 설정되지 않았습니다. .env 파일에 VITE_KAKAO_JAVASCRIPT_KEY를 설정해주세요.');
      }
    }
  }, []);

  // [추가] 카카오 로그인 버튼 클릭 시 실행
  const handleKakaoLogin = async () => {
    // 카카오 SDK 초기화 확인
    if (!window.Kakao) {
      toast.error("카카오 SDK가 로드되지 않았습니다.");
      console.error("window.Kakao가 없습니다.");
      return;
    }
    
    console.log("카카오 SDK 상태:", window.Kakao.isInitialized() ? "초기화됨" : "초기화 안됨");
    
    if (!window.Kakao.isInitialized()) {
      toast.error("카카오 SDK가 초기화되지 않았습니다. 환경변수를 확인해주세요.");
      console.error("VITE_KAKAO_JAVASCRIPT_KEY:", import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY);
      return;
    }

    try {
      // 카카오 SDK 2.x 새로운 방식: loginForm() 또는 authorize() 사용
      // scope: 받아올 정보 (닉네임, 이메일 등)
      // GitHub Pages에서는 /tipping-project/login, Vercel에서는 /login
      const redirectUri = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') + '/login';
      console.log("카카오 redirectUri:", redirectUri);
      
      window.Kakao.Auth.authorize({
        redirectUri: redirectUri,
        scope: 'profile_nickname,account_email',
      });
    } catch (error) {
      console.error("카카오 로그인 에러:", error);
      toast.error("카카오 로그인 중 오류가 발생했습니다.");
    }
  };
  
  // 카카오 로그인 리다이렉트 후 처리 (URL에서 code 파라미터 확인)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // URL에서 code 파라미터 제거 (히스토리 정리)
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // 카카오 인가 코드로 로그인 처리
      handleKakaoCallback(code);
    }
  }, []);
  
  const handleKakaoCallback = async (code) => {
    try {
      console.log("카카오 인가 코드 수신:", code);
      // 서버에 redirect_uri도 함께 전달 (GitHub Pages / Vercel 구분용)
      const redirectUri = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') + '/login';
      const response = await axios.post('/auth/kakao', { code, redirectUri });
      
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      toast.success(`카카오 로그인 성공! 반가워요 ${user.nickname}님`);
      navigate('/');
    } catch (error) {
      console.error("카카오 로그인 서버 에러:", error.response?.data || error);
      toast.error(error.response?.data?.error || "카카오 로그인 서버 처리 실패");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-sky-50 via-white to-white px-6">
      {/* 로고 - 크게 */}
      <div className="mb-10">
        <img 
          src={import.meta.env.BASE_URL + 'logo.png'} 
          alt="Tipping" 
          className="h-32 md:h-40"
        />
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="w-full max-w-sm space-y-6">
        {/* 이메일 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            placeholder="이메일 주소"
            required
          />
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            placeholder="비밀번호"
            required
          />
          <button
            type="submit"
            className="w-full py-3 font-semibold text-white bg-blue-500 rounded-xl hover:bg-blue-600 transition-colors"
          >
            로그인
          </button>
        </form>

        {/* 구분선 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 text-gray-400 bg-gradient-to-b from-sky-50 via-white to-white">또는</span>
          </div>
        </div>

        {/* 소셜 로그인 버튼들 */}
        <div className="space-y-3">
          {/* 카카오 로그인 */}
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#FEE500] rounded-xl hover:bg-[#FDD835] transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6">
              <path fill="#3c1e1e" d="M12 3C5.373 3 0 6.663 0 11.18c0 2.87 1.866 5.397 4.795 6.877-.216.793-1.42 5.203-1.47 5.642 0 0-.028.232.126.321.154.088.344.02.344.02 4.62-3.167 5.426-3.722 5.662-3.794.527.076 1.07.118 1.626.118 6.627 0 12-3.663 12-8.18C24 6.663 18.627 3 12 3z"/>
            </svg>
            <span className="text-[#3c1e1e] font-semibold text-base">카카오로 로그인</span>
          </button>

          {/* 구글 로그인 */}
          <button
            type="button"
            onClick={() => {
              const googleBtn = document.querySelector('[role="button"][aria-labelledby]');
              if (googleBtn) googleBtn.click();
            }}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-gray-700 font-semibold text-base">Google로 로그인</span>
          </button>

          {/* 실제 구글 로그인 버튼 (숨김) */}
          <div className="hidden">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("구글 로그인 실패")}
            />
          </div>
        </div>
      </div>

      {/* 하단 링크들 */}
      <div className="mt-10 flex flex-wrap justify-center items-center gap-3 text-sm text-gray-500">
        <Link to="/register" className="hover:text-blue-500 transition-colors">
          회원가입
        </Link>
        <span className="text-gray-300">|</span>
        <button className="hover:text-blue-500 transition-colors">
          비밀번호 재설정
        </button>
      </div>
    </div>
  );
}