// client/src/pages/Home.jsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone'; // 드래그 앤 드롭 라이브러리
import axios from '../api/axios';
import { toast } from 'react-toastify';
import ProductCard from '../components/ProductCard';
import ImageEditor from '../components/ImageEditor'; // 이미지 편집 컴포넌트

export default function Home() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    // 상태 관리 (State)
    const [file, setFile] = useState(null);       // 업로드할 파일
    const [preview, setPreview] = useState(null); // 미리보기 이미지 URL
    const [loading, setLoading] = useState(false); // 로딩 중인가?
    const [results, setResults] = useState([]);    // 검색 결과 리스트
    const [visualMatches, setVisualMatches] = useState([]); // 유사 이미지 (SerpAPI)
    const [searchInfo, setSearchInfo] = useState(null); // 검색 정보
    
    // 이미지 편집 관련 상태
    const [showEditor, setShowEditor] = useState(false);
    const [originalPreview, setOriginalPreview] = useState(null); // 원본 이미지 URL

    // 1. 유저 정보 불러오기
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
    }, []);

    // 2. 드래그 앤 드롭 설정
    const onDrop = (acceptedFiles) => {
        const selectedFile = acceptedFiles[0];
        setFile(selectedFile);
        // 미리보기 URL 생성
        const previewUrl = URL.createObjectURL(selectedFile);
        setPreview(previewUrl);
        setOriginalPreview(previewUrl); // 원본 저장
        setResults([]); // 기존 결과 초기화
        setVisualMatches([]); // 유사 이미지 초기화
        setSearchInfo(null);
    };

    // 이미지 편집 완료 핸들러
    const handleEditorSave = (editedFile, editedUrl) => {
        setFile(editedFile);
        setPreview(editedUrl);
        setShowEditor(false);
        toast.success('이미지 편집이 완료되었습니다!');
    };

    // 이미지 편집 취소 핸들러
    const handleEditorCancel = () => {
        setShowEditor(false);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] }, // 이미지만 허용
        multiple: false // 한 번에 하나만
    });

    // 3. 검색 실행 함수
    const handleSearch = async () => {
        if (!file) return alert("이미지를 먼저 올려주세요!");

        setLoading(true); // 로딩 시작
        setResults([]);   // 기존 결과 초기화
        setVisualMatches([]); // 유사 이미지 초기화
        setSearchInfo(null);

        const formData = new FormData();
        formData.append('image', file);

        try {
            // 백엔드 검색 API 호출 (파일 전송)
            const response = await axios.post('/search', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log("검색 결과:", response.data);
            setResults(response.data.results || []); // 결과 저장
            setVisualMatches(response.data.visualMatches || []); // 유사 이미지 저장
            setSearchInfo({
                productName: response.data.serpProductName,
                brand: response.data.detectedBrand,
                keywords: response.data.searchKeywords,
                extractedKeywords: response.data.serpExtractedKeywords || [],
                totalCount: response.data.count,
                visualCount: (response.data.visualMatches || []).length,
            });

        } catch (error) {
            console.error(error);
            alert("검색 중 오류가 발생했습니다. (백엔드 로그 확인)");
        } finally {
            setLoading(false); // 로딩 끝
        }
    };

    // 로그아웃
    const handleLogout = () => {
        localStorage.clear();
        setUser(null);
        navigate('/login');
    };

    return (
        <div className="min-h-screen pb-20 bg-gray-50">
            {/* 이미지 편집기 모달 */}
            {showEditor && originalPreview && (
                <ImageEditor
                    imageUrl={originalPreview}
                    onSave={handleEditorSave}
                    onCancel={handleEditorCancel}
                />
            )}

            {/* 헤더 (네비게이션) */}
            <nav className="bg-white shadow-sm">
                <div className="flex items-center justify-between px-4 py-4 mx-auto max-w-7xl">
                    <h1 className="text-2xl font-extrabold text-blue-600 cursor-pointer" onClick={() => window.location.reload()}>
                        Tipping
                    </h1>
                    <div>
                        {user ? (
                            <div className="flex items-center gap-4">
                                {/* 👇 [추가된 부분] 찜 목록 버튼 */}
                                <Link to="/wishlist" className="flex items-center gap-1 text-gray-600 hover:text-red-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                    <span className="hidden sm:inline">찜 목록</span>
                                </Link>

                                <span className="ml-2 text-gray-400">|</span>
                                <span className="text-gray-600"><b>{user.nickname}</b>님</span>
                                <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500">로그아웃</button>
                            </div>
                        ) : (
                            <Link to="/login" className="font-bold text-blue-500 hover:text-blue-600">로그인</Link>
                        )}
                    </div>
                </div>
            </nav>

            {/* 메인 컨텐츠 */}
            <main className="px-4 mx-auto mt-10 max-w-7xl">

                {/* 1. 검색 영역 (중앙 정렬) */}
                <div className="max-w-2xl mx-auto mb-16 text-center">
                    <h2 className="mb-2 text-3xl font-bold text-gray-900">어떤 옷을 찾으시나요?</h2>
                    <p className="mb-8 text-gray-500">이미지를 올리면 AI가 최저가를 찾아드립니다.</p>

                    {/* 드래그 앤 드롭 박스 */}
                    <div
                        {...getRootProps()}
                        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400'}`}
                    >
                        <input {...getInputProps()} />

                        {preview ? (
                            // 이미지가 선택되었을 때 미리보기
                            <div className="relative w-full h-full p-2">
                                <img src={preview} alt="Preview" className="object-contain w-full h-full rounded-lg" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 transition-all">
                                    <span className="px-3 py-1 text-xs text-white bg-black rounded-full bg-opacity-60 opacity-0 hover:opacity-100 transition-opacity">클릭하여 이미지 변경</span>
                                </div>
                                {/* 편집 버튼 (오른쪽 상단, 항상 보임) */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowEditor(true); }}
                                    className="absolute flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white rounded-lg shadow-md top-4 right-4 hover:bg-gray-100"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    편집
                                </button>
                            </div>
                        ) : (
                            // 이미지가 없을 때 안내 문구
                            <div className="flex flex-col items-center p-6 text-gray-500">
                                <svg className="w-12 h-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <p className="font-medium">클릭하여 이미지 업로드</p>
                                <p className="text-sm">또는 여기로 파일을 끌어오세요</p>
                            </div>
                        )}
                    </div>

                    {/* 검색 버튼 */}
                    <button
                        onClick={handleSearch}
                        disabled={!file || loading}
                        className={`w-full py-4 mt-6 text-lg font-bold text-white rounded-xl transition-all shadow-lg
              ${!file ? 'bg-gray-300 cursor-not-allowed' :
                                loading ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-xl'}`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                AI가 열심히 찾는 중...
                            </span>
                        ) : "최저가 찾기 (Search)"}
                    </button>
                </div>

                {/* 1.5. 결과 없음 안내 (추가된 부분) */}
                {/* 로딩도 아니고, 결과도 비어있고, 검색을 시도한 적이 있을 때만 표시 */}
                {!loading && results.length === 0 && visualMatches.length === 0 && file && searchInfo && (
                    <div className="py-10 text-center text-gray-500 animate-fade-in">
                        <p className="text-xl font-bold">검색 결과가 없습니다. 😢</p>
                        <p className="mt-2 text-sm">옷이 더 잘 보이는 선명한 사진으로 다시 시도해보세요.</p>
                    </div>
                )}

                {/* 검색 정보 표시 */}
                {!loading && searchInfo && (searchInfo.productName || searchInfo.brand || searchInfo.keywords?.length > 0) && (
                    <div className="p-4 mb-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-bold text-gray-700">🔍 AI 분석 결과</span>
                            {searchInfo.productName && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg font-medium">{searchInfo.productName}</span>
                            )}
                            {searchInfo.brand && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-lg">브랜드: {searchInfo.brand}</span>
                            )}
                        </div>
                        {searchInfo.keywords?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                <span className="text-xs text-gray-500">검색 키워드:</span>
                                {searchInfo.keywords.slice(0, 5).map((kw, i) => (
                                    <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">{kw}</span>
                                ))}
                                {searchInfo.keywords.length > 5 && (
                                    <span className="text-xs text-gray-400">+{searchInfo.keywords.length - 5}개</span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. 검색 결과 리스트 */}
                {!loading && (results.length > 0 || visualMatches.length > 0) && (
                    <div className="animate-fade-in-up">

                        {/* 1. 가격 정보가 있는 상품 (Shopping) */}
                        {results.filter(item => item.price > 0).length > 0 && (
                            <div className="mb-12">
                                <h3 className="flex items-center gap-2 mb-6 text-2xl font-bold text-gray-900">
                                    <span>💰 AI가 찾은 최저가</span>
                                    <span className="px-2 py-1 text-sm text-white bg-blue-600 rounded-full">
                                        {results.filter(item => item.price > 0).length}개
                                    </span>
                                </h3>
                                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                    {results
                                        .filter(item => item.price > 0) // 가격 있는 것만 필터링
                                        .map((item, index) => (
                                            <ProductCard key={`shop-${index}`} item={item} />
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* 2. 가격 정보는 없지만 비슷한 상품 (Visual) */}
                        {results.filter(item => item.price === 0).length > 0 && (
                            <div className="mb-12">
                                <h3 className="flex items-center gap-2 mb-6 text-2xl font-bold text-gray-900">
                                    <span>📷 유사한 스타일 (가격 확인 필요)</span>
                                    <span className="px-2 py-1 text-sm text-gray-600 bg-gray-200 rounded-full">
                                        {results.filter(item => item.price === 0).length}개
                                    </span>
                                </h3>
                                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 opacity-80 hover:opacity-100 transition-opacity">
                                    {results
                                        .filter(item => item.price === 0) // 가격 없는 것만 필터링
                                        .map((item, index) => (
                                            <ProductCard key={`visual-${index}`} item={item} />
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* 3. SerpAPI 유사 이미지 (Google Lens) */}
                        {visualMatches.length > 0 && (
                            <div>
                                <h3 className="flex items-center gap-2 mb-6 text-2xl font-bold text-gray-900">
                                    <span>🔍 Google에서 찾은 유사 상품</span>
                                    <span className="px-2 py-1 text-sm text-purple-600 bg-purple-100 rounded-full">
                                        {visualMatches.length}개
                                    </span>
                                </h3>
                                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                    {visualMatches.map((item, index) => (
                                        <ProductCard key={`serp-${index}`} item={item} />
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </main>
        </div>
    );
}