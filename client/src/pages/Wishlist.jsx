// client/src/pages/Wishlist.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import ProductCard from '../components/ProductCard';

export default function Wishlist() {
  const navigate = useNavigate();
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);

  // 찜 목록 불러오기
  useEffect(() => {
    const fetchWishes = async () => {
      try {
        const response = await axios.get('/wishlist');
        setWishes(response.data);
      } catch (error) {
        console.error(error);
        alert("로그인이 필요합니다.");
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchWishes();
  }, [navigate]);

  // 삭제 후 화면 갱신 함수
  const handleDeleteFromList = (deletedId) => {
    setWishes(wishes.filter(item => item.id !== deletedId));
  };

  if (loading) return <div className="p-10 text-center">로딩 중...</div>;

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* 헤더 */}
      <nav className="bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-4 mx-auto max-w-7xl">
          <h1 className="text-2xl font-extrabold text-blue-600 cursor-pointer" onClick={() => navigate('/')}>
            Tipping
          </h1>
          <button onClick={() => navigate('/')} className="font-bold text-gray-500 hover:text-blue-600">
            ← 검색으로 돌아가기
          </button>
        </div>
      </nav>

      <main className="px-4 mx-auto mt-10 max-w-7xl">
        <h2 className="mb-8 text-3xl font-bold text-gray-900">
          나의 찜 목록 ❤️ <span className="text-blue-500">{wishes.length}</span>
        </h2>

        {wishes.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <p className="text-xl">아직 찜한 상품이 없습니다.</p>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2 mt-4 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
            >
              최저가 찾으러 가기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {wishes.map((item) => (
              <ProductCard 
                key={item.id} 
                item={item} 
                isWishlistMode={true} // 삭제 모드 활성화
                onDelete={handleDeleteFromList}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}