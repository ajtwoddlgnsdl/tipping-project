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
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="mb-6 text-3xl font-bold text-center text-gray-800">
          Tipping 회원가입
        </h2>
        
        <form onSubmit={handleRegister} className="space-y-4">
          {/* 이메일 */}
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

          {/* 닉네임 (기획서에 닉네임이 있었죠!) */}
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">닉네임</label>
            <input
              type="text"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="사용할 이름을 입력하세요"
              required
            />
          </div>

          {/* 비밀번호 */}
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

          {/* 비밀번호 확인 */}
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">비밀번호 확인</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="비밀번호를 한 번 더 입력하세요"
              required
            />
          </div>

          {/* 가입 버튼 */}
          <button
            type="submit"
            className="w-full py-3 mt-4 font-bold text-white transition bg-blue-500 rounded-lg hover:bg-blue-600"
          >
            가입하기
          </button>
        </form>

        <p className="mt-4 text-center text-gray-600">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-blue-500 hover:underline">
            로그인 하러가기
          </Link>
        </p>
      </div>
    </div>
  );
}