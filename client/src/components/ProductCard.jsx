// client/src/components/ProductCard.jsx
import { useState } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';

// isWishlistMode: true면 '삭제' 버튼, false면 '찜하기' 버튼을 보여줌
export default function ProductCard({ item, isWishlistMode = false, onDelete }) {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false); // 하트 눌렀는지 상태

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  // 찜하기 버튼 클릭 시
  const handleLike = async () => {
    const token = localStorage.getItem('token');
    
    // 1. 비로그인 체크 (기획서 요구사항)
    if (!token) {
      if(confirm("로그인이 필요한 서비스입니다. 로그인 하시겠습니까?")) {
        navigate('/login');
      }
      return;
    }

    try {
      // 2. 백엔드에 저장 요청 (필요한 정보만 골라서 보냄)
      await axios.post('/wishlist', {
        productTitle: item.title,
        price: item.price,
        imageUrl: item.thumbnail,
        productLink: item.link
      });

      setIsLiked(true); // 하트 빨갛게 채우기
      alert("찜 목록에 저장되었습니다! ❤️");

    } catch (error) {
      console.error(error);
      alert("이미 저장되었거나 오류가 발생했습니다.");
    }
  };

  // 찜 삭제 버튼 클릭 시 (찜 목록 페이지용)
  const handleDelete = async () => {
    if(confirm("정말 삭제하시겠습니까?")) {
      try {
        await axios.delete(`/wishlist/${item.id}`);
        onDelete(item.id); // 화면에서도 지우기 위해 부모에게 알림
      } catch (error) {
        alert("삭제 실패");
      }
    }
  };

  return (
    <div className="relative overflow-hidden transition-shadow bg-white border border-gray-200 rounded-lg hover:shadow-lg group">
      
      {/* 1. 상품 썸네일 */}
      <div className="relative h-48 overflow-hidden bg-gray-100">
        <img 
          src={item.thumbnail || item.imageUrl} // 검색결과(thumbnail)와 찜목록(imageUrl) 변수명이 달라서 둘 다 대응
          alt={item.title || item.productTitle} 
          className="object-cover w-full h-full transition-transform group-hover:scale-105"
        />
        
        {/* 하트 버튼 (검색 결과에서만 보임) */}
        {!isWishlistMode && (
          <button 
            onClick={handleLike}
            className="absolute p-2 bg-white rounded-full shadow-md top-2 right-2 hover:bg-gray-100"
          >
            {/* SVG 아이콘: 채워진 하트 vs 빈 하트 */}
            <svg 
              className={`w-6 h-6 ${isLiked ? 'text-red-500 fill-current' : 'text-gray-400'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
            </svg>
          </button>
        )}

        {/* 삭제 버튼 (찜 목록에서만 보임) */}
        {isWishlistMode && (
          <button 
            onClick={handleDelete}
            className="absolute p-1 text-white bg-red-500 rounded top-2 right-2 hover:bg-red-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>

      {/* 2. 상품 정보 */}
      <div className="p-4">
        {item.type === 'shopping' && (
          <span className="inline-block px-2 py-0.5 mb-2 text-xs font-semibold text-blue-600 bg-blue-100 rounded">
            추천
          </span>
        )}
        
        <h3 className="mb-2 text-sm font-medium text-gray-800 line-clamp-2 min-h-[40px]">
          {item.title || item.productTitle}
        </h3>
        
        <div className="flex items-end justify-between mt-2">
          <p className="text-lg font-bold text-gray-900">
            {formatPrice(item.price)}원
          </p>
          <a 
            href={item.link || item.productLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600"
          >
            구매
          </a>
        </div>
      </div>
    </div>
  );
}