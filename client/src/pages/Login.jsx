import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../api/axios'; // 우리가 만든 설정된 axios 가져오기

export default function Login() {
  const navigate = useNavigate(); // 페이지 이동을 도와주는 훅
  
  // 사용자가 입력한 이메일과 비밀번호를 저장할 공간
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // 입력창에 글자를 칠 때마다 formData를 업데이트하는 함수
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 로그인 버튼을 눌렀을 때 실행되는 함수
  const handleLogin = async (e) => {
    e.preventDefault(); // 새로고침 방지

    try {
      // 1. 백엔드로 로그인 요청 보냄
      const response = await axios.post('/auth/login', formData);

      // 2. 성공 시 받은 토큰(신분증)을 브라우저(localStorage)에 저장
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user)); // 유저 정보도 저장

      toast.success(`환영합니다, ${response.data.user.nickname}님! 👋`);
      
      // 3. 메인 페이지로 이동
      navigate('/');

    } catch (error) {
      // 실패 시 에러 메시지 띄우기
      console.error(error);
      toast.error(error.response?.data?.error || "로그인 실패! 아이디/비번을 확인하세요.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="mb-6 text-3xl font-bold text-center text-gray-800">
          Tipping 로그인
        </h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          {/* 이메일 입력창 */}
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

          {/* 비밀번호 입력창 */}
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

          {/* 로그인 버튼 */}
          <button
            type="submit"
            className="w-full py-3 font-bold text-white transition bg-blue-500 rounded-lg hover:bg-blue-600"
          >
            로그인 하기
          </button>
        </form>

        {/* 회원가입 링크 */}
        <p className="mt-4 text-center text-gray-600">
          계정이 없으신가요?{' '}
          <Link to="/register" className="text-blue-500 hover:underline">
            회원가입 하러가기
          </Link>
        </p>
      </div>
    </div>
  );
}