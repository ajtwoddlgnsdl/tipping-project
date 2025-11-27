import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // 화면이 켜질 때 딱 한 번 실행됨
  useEffect(() => {
    // 1. 저장된 토큰과 유저 정보가 있는지 확인
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      setUser(JSON.parse(storedUser)); // 유저 정보 상태에 저장
    }
  }, []);

  // 로그아웃 함수
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    alert("로그아웃 되었습니다.");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="mb-4 text-5xl font-extrabold text-blue-600">Tipping</h1>
      <p className="mb-8 text-xl text-gray-600">이미지로 찾는 진짜 최저가</p>

      {user ? (
        // 로그인 했을 때 보이는 화면
        <div className="text-center">
          <p className="mb-4 text-2xl font-bold">
            안녕하세요, <span className="text-blue-500">{user.nickname}</span>님!
          </p>
          <div className="space-x-4">
            <button className="px-6 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600">
              이미지 검색 시작
            </button>
            <button 
              onClick={handleLogout}
              className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              로그아웃
            </button>
          </div>
        </div>
      ) : (
        // 로그인 안 했을 때 보이는 화면
        <div className="space-x-4">
          <Link to="/login">
            <button className="px-6 py-3 font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600">
              로그인
            </button>
          </Link>
          <Link to="/register">
            <button className="px-6 py-3 font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">
              회원가입
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}