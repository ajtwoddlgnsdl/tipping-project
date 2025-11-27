import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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