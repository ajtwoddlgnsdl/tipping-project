// client/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// 👇 [추가] Toast 관련 임포트
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; 

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Wishlist from './pages/Wishlist';

// GitHub Pages 배포 시 basename 설정 (BASE_URL에서 trailing slash 제거)
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

function App() {
  return (
    <BrowserRouter basename={basename}>
      {/* 👇 [추가] 알림판 설치 (위치, 시간 설정 등) */}
      <ToastContainer 
        position="top-center" // 화면 상단 중앙에 뜸
        autoClose={2000}      // 2초 뒤에 자동 사라짐
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"         // light, dark, colored 중 선택 가능
      />
      
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/wishlist" element={<Wishlist />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;