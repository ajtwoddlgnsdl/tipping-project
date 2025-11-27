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
      const response = await axios.post('/auth/google', {
        token: credentialResponse.credential
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      toast.success(`구글 로그인 성공! 반가워요 ${user.nickname}님`);
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error("구글 로그인 실패");
    }
  };

  useEffect(() => {
    // window.Kakao가 있고, 아직 초기화 안 됐으면 초기화
    if (window.Kakao && !window.Kakao.isInitialized()) {
      // 👇 여기에 아까 복사한 'JavaScript 키'를 넣으세요!
      window.Kakao.init('YOUR_KAKAO_JAVASCRIPT_KEY');
    }
  }, []);

  // [추가] 카카오 로그인 버튼 클릭 시 실행
  const handleKakaoLogin = () => {
    window.Kakao.Auth.login({
      success: async (authObj) => {
        try {
          // 1. 카카오가 준 토큰(access_token)을 백엔드로 보냄
          const response = await axios.post('/auth/kakao', {
            token: authObj.access_token
          });

          // 2. 백엔드 응답 처리 (구글과 동일)
          const { token, user } = response.data;
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));

          toast.success(`카카오 로그인 성공! 반가워요 ${user.nickname}님`);
          navigate('/');
        } catch (error) {
          console.error(error);
          toast.error("카카오 로그인 서버 처리 실패");
        }
      },
      fail: (err) => {
        console.error(err);
        toast.error("카카오 로그인 실패");
      },
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="mb-6 text-3xl font-bold text-center text-gray-800">
          Tipping 로그인
        </h2>

        {/* 1. 일반 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">이메일</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="example@email.com"
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">비밀번호</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 font-bold text-white transition bg-blue-500 rounded-lg hover:bg-blue-600"
          >
            로그인 하기
          </button>
        </form>

        {/* 2. 구분선 및 구글 로그인 (폼 밖으로 뺌) */}
        <div className="mt-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 text-gray-500 bg-white">간편 로그인</span>
            </div>
          </div>

          <div className="flex justify-center">
            {/* width 속성을 제거해보세요. (가끔 % 단위가 오류를 일으킵니다) */}
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("구글 로그인 실패")}
            />
          </div>
          {/* 👇 [추가] 카카오 로그인 버튼 (노란색 커스텀 디자인) */}
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="w-full flex justify-center items-center gap-2 py-2.5 bg-[#FEE500] hover:bg-[#FDD835] text-[#3c1e1e] font-medium rounded text-sm transition-colors"
          >
            {/* 카카오 심볼 아이콘 (SVG) */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M12 3C5.373 3 0 6.663 0 11.18c0 2.87 1.866 5.397 4.795 6.877-.216.793-1.42 5.203-1.47 5.642 0 0-.028.232.126.321.154.088.344.02.344.02 4.62-3.167 5.426-3.722 5.662-3.794.527.076 1.07.118 1.626.118 6.627 0 12-3.663 12-8.18C24 6.663 18.627 3 12 3z" />
            </svg>
            카카오로 시작하기
          </button>
        </div>

        {/* 3. 회원가입 링크 */}
        <p className="mt-6 text-center text-gray-600">
          계정이 없으신가요?{' '}
          <Link to="/register" className="text-blue-500 hover:underline">
            회원가입 하러가기
          </Link>
        </p>
      </div>
    </div>
  );
}