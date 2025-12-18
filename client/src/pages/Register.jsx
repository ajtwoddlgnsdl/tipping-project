// client/src/pages/Register.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../api/axios';

export default function Register() {
  const navigate = useNavigate();

  // 입력값 상태 관리
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '', // 비밀번호 확인용
    nickname: ''
  });

  // 입력할 때마다 상태 업데이트
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // 가입 버튼 클릭 시
  const handleRegister = async (e) => {
    e.preventDefault();

    // 1. 비밀번호 유효성 검사 (영문, 숫자 포함 8자 이상)
    // ^: 시작, (?=.*[A-Za-z]): 영문 최소 1개, (?=.*\d): 숫자 최소 1개, {8,}: 8자 이상
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

    if (!passwordRegex.test(formData.password)) {
      return toast.warning("비밀번호는 영문과 숫자를 포함하여 8자 이상이어야 합니다.");
    }
    
    // 1. 비밀번호 일치 확인 (프론트엔드 유효성 검사)
    if (formData.password !== formData.confirmPassword) {
      return toast.warning("비밀번호가 서로 다릅니다!");
    }

    try {
      // 2. 백엔드에 회원가입 요청
      // confirmPassword는 백엔드에 보낼 필요 없으니 제외하고 보냅니다.
      await axios.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        nickname: formData.nickname
      });

      toast.success("회원가입 완료! 로그인 해주세요. 🎉");
      
      // 3. 로그인 페이지로 이동
      navigate('/login');

    } catch (error) {
      console.error(error);
      // 백엔드에서 보내준 에러 메시지 (예: 이미 존재하는 이메일입니다) 띄우기
      toast.error(error.response?.data?.error || "회원가입 실패");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white">
      {/* 네비게이션 바 */}
      <nav className="bg-black">
        <div className="flex items-center justify-between px-8 py-4 mx-auto">
          <Link to="/">
            <img 
              src={import.meta.env.BASE_URL + 'logo.png'} 
              alt="Tipping" 
              className="h-12 cursor-pointer" 
              draggable="false"
            />
          </Link>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        {/* 로고 */}
        <div className="mb-8">
          <img 
            src={import.meta.env.BASE_URL + 'logo.png'} 
            alt="Tipping" 
            className="h-28 md:h-32"
            draggable="false"
          />
        </div>

        <h2 className="mb-8 text-2xl font-bold text-center text-gray-800">
          회원가입
        </h2>
        
        <form onSubmit={handleRegister} className="w-full max-w-sm space-y-4">
          {/* 이메일 */}
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            placeholder="이메일 주소"
            required
          />

          {/* 닉네임 */}
          <input
            type="text"
            name="nickname"
            value={formData.nickname}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            placeholder="닉네임"
            required
          />

          {/* 비밀번호 */}
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            placeholder="비밀번호 (영문+숫자 8자 이상)"
            required
          />

          {/* 비밀번호 확인 */}
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            placeholder="비밀번호 확인"
            required
          />

          {/* 가입 버튼 */}
          <button
            type="submit"
            className="w-full py-3 mt-4 font-bold text-white transition bg-blue-500 rounded-xl hover:bg-blue-600"
          >
            가입하기
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-blue-500 hover:underline">
            로그인 하러가기
          </Link>
        </p>
      </div>
    </div>
  );
}