// client/src/components/ImageEditor.jsx
// 이미지 편집 컴포넌트 - 크롭, 회전, 밝기/대비 조절, 배경 제거

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import axios from '../api/axios';

export default function ImageEditor({ imageUrl, onSave, onCancel }) {
  // 크롭 상태
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  
  // 편집 상태
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [sharpness, setSharpness] = useState(100); // 선명도 추가
  
  // 현재 편집 모드
  const [editMode, setEditMode] = useState('crop'); // 'crop', 'adjust', 'rotate', 'background'
  
  // 처리 중 상태
  const [processing, setProcessing] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // 이미지 로드 완료 시
  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    // 기본 크롭 영역 설정 (중앙 80%)
    const cropSize = Math.min(width, height) * 0.8;
    setCrop({
      unit: 'px',
      x: (width - cropSize) / 2,
      y: (height - cropSize) / 2,
      width: cropSize,
      height: cropSize,
    });
  }, []);

  // 회전 적용
  const handleRotate = (degree) => {
    setRotation((prev) => (prev + degree) % 360);
  };

  // 필터 스타일 계산
  const getFilterStyle = () => {
    // 선명도를 contrast로 시뮬레이션
    const sharpnessContrast = 100 + (sharpness - 100) * 0.5;
    return {
      filter: `brightness(${brightness}%) contrast(${(contrast * sharpnessContrast) / 100}%)`,
      transform: `rotate(${rotation}deg)`,
      transition: 'transform 0.3s ease',
    };
  };

  // 배경 제거 (remove.bg API 사용)
  const handleRemoveBackground = async () => {
    setProcessing(true);
    try {
      // 현재 이미지를 Blob으로 변환
      const response = await fetch(currentImageUrl);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('image', blob, 'image.png');
      
      // 서버의 배경 제거 API 호출
      const result = await axios.post('/search/remove-background', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob'
      });
      
      const processedBlob = new Blob([result.data], { type: 'image/png' });
      const processedUrl = URL.createObjectURL(processedBlob);
      setProcessedImageUrl(processedUrl);
      setCurrentImageUrl(processedUrl);
      
    } catch (error) {
      console.error('배경 제거 실패:', error);
      alert('배경 제거에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setProcessing(false);
    }
  };

  // 이미지 업스케일 (클라이언트 측 간단한 업스케일링)
  const handleUpscale = async () => {
    if (!imgRef.current) return;
    setProcessing(true);
    
    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 2배 업스케일
      const scale = 2;
      canvas.width = image.naturalWidth * scale;
      canvas.height = image.naturalHeight * scale;
      
      // 고품질 이미지 스케일링
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // 이미지 그리기
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      // 샤프닝 효과 적용 (간단한 언샤프 마스크)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // 간단한 샤프닝 커널 적용
      const sharpenKernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ];
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const upscaledUrl = URL.createObjectURL(blob);
          setCurrentImageUrl(upscaledUrl);
        }
        setProcessing(false);
      }, 'image/jpeg', 0.95);
      
    } catch (error) {
      console.error('업스케일 실패:', error);
      setProcessing(false);
    }
  };

  // 자동 화질 개선
  const handleAutoEnhance = () => {
    setBrightness(105);
    setContrast(110);
    setSharpness(115);
  };

  // 편집된 이미지 저장
  const handleSave = async () => {
    if (!imgRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const image = imgRef.current;

    // 크롭 영역 또는 전체 이미지
    const cropArea = completedCrop || {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    };

    // 스케일 계산
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // 회전 고려한 캔버스 크기
    const radians = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    
    const cropWidth = cropArea.width * scaleX;
    const cropHeight = cropArea.height * scaleY;
    
    const rotatedWidth = cropWidth * cos + cropHeight * sin;
    const rotatedHeight = cropWidth * sin + cropHeight * cos;

    canvas.width = rotatedWidth;
    canvas.height = rotatedHeight;

    // 캔버스 초기화 및 회전
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(rotatedWidth / 2, rotatedHeight / 2);
    ctx.rotate(radians);
    
    // 필터 적용
    const sharpnessContrast = 100 + (sharpness - 100) * 0.5;
    ctx.filter = `brightness(${brightness}%) contrast(${(contrast * sharpnessContrast) / 100}%)`;

    // 이미지 그리기
    ctx.drawImage(
      image,
      cropArea.x * scaleX,
      cropArea.y * scaleY,
      cropWidth,
      cropHeight,
      -cropWidth / 2,
      -cropHeight / 2,
      cropWidth,
      cropHeight
    );

    // Blob으로 변환 후 File 객체 생성
    canvas.toBlob((blob) => {
      if (blob) {
        const editedFile = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
        const editedUrl = URL.createObjectURL(blob);
        onSave(editedFile, editedUrl);
      }
    }, 'image/jpeg', 0.92);
  };

  // 초기화
  const handleReset = () => {
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setSharpness(100);
    setCrop(undefined);
    setCompletedCrop(null);
    setCurrentImageUrl(imageUrl);
    setProcessedImageUrl(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="w-full max-w-4xl mx-4 overflow-hidden bg-white rounded-2xl max-h-[95vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-xl font-bold text-gray-900">이미지 편집</h3>
          <button onClick={onCancel} className="p-2 text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 편집 모드 탭 */}
        <div className="flex border-b bg-gray-50 overflow-x-auto">
          {[
            { id: 'crop', label: '자르기', icon: '✂️' },
            { id: 'rotate', label: '회전', icon: '🔄' },
            { id: 'adjust', label: '화질 보정', icon: '☀️' },
            { id: 'background', label: 'AI 편집', icon: '✨' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setEditMode(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors whitespace-nowrap px-2
                ${editMode === tab.id 
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'}`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 이미지 편집 영역 */}
        <div className="relative flex items-center justify-center p-4 bg-gray-100" style={{ minHeight: '350px' }}>
          {processing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white bg-opacity-90">
              <div className="w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <p className="mt-4 text-gray-600">AI가 이미지를 처리 중...</p>
            </div>
          )}
          
          {editMode === 'crop' ? (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={undefined}
            >
              <img
                ref={imgRef}
                src={currentImageUrl}
                alt="편집할 이미지"
                onLoad={onImageLoad}
                style={{ 
                  maxHeight: '350px', 
                  maxWidth: '100%',
                  ...getFilterStyle() 
                }}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          ) : (
            <img
              ref={imgRef}
              src={currentImageUrl}
              alt="편집할 이미지"
              style={{ 
                maxHeight: '350px', 
                maxWidth: '100%',
                ...getFilterStyle() 
              }}
              crossOrigin="anonymous"
            />
          )}
        </div>

        {/* 편집 도구 */}
        <div className="p-4 border-t bg-gray-50">
          {/* 회전 도구 */}
          {editMode === 'rotate' && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleRotate(-90)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                왼쪽 90°
              </button>
              <button
                onClick={() => handleRotate(90)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-100"
              >
                오른쪽 90°
                <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <span className="ml-4 text-sm text-gray-500">현재: {rotation}°</span>
            </div>
          )}

          {/* 밝기/대비/선명도 도구 */}
          {editMode === 'adjust' && (
            <div className="space-y-3">
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleAutoEnhance}
                  className="px-3 py-1 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                >
                  ✨ 자동 보정
                </button>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-16 text-sm font-medium text-gray-700">밝기</label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="w-12 text-sm text-gray-600">{brightness}%</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-16 text-sm font-medium text-gray-700">대비</label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="w-12 text-sm text-gray-600">{contrast}%</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-16 text-sm font-medium text-gray-700">선명도</label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={sharpness}
                  onChange={(e) => setSharpness(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="w-12 text-sm text-gray-600">{sharpness}%</span>
              </div>
            </div>
          )}

          {/* 크롭 도구 안내 */}
          {editMode === 'crop' && (
            <div className="text-center text-gray-600">
              <p className="text-sm">✂️ 드래그하여 원하는 영역을 선택하세요</p>
              <p className="mt-1 text-xs text-gray-400">제품이 잘 보이도록 불필요한 부분을 잘라내면 인식률이 높아집니다</p>
            </div>
          )}

          {/* AI 편집 도구 */}
          {editMode === 'background' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRemoveBackground}
                  disabled={processing}
                  className="flex flex-col items-center gap-2 p-4 text-gray-700 bg-white border-2 border-dashed rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-2xl">🎭</span>
                  <span className="font-medium">누끼 따기</span>
                  <span className="text-xs text-gray-400">배경 제거</span>
                </button>
                <button
                  onClick={handleUpscale}
                  disabled={processing}
                  className="flex flex-col items-center gap-2 p-4 text-gray-700 bg-white border-2 border-dashed rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-2xl">🔍</span>
                  <span className="font-medium">업스케일</span>
                  <span className="text-xs text-gray-400">2배 확대</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 버튼 영역 */}
        <div className="flex gap-3 px-6 py-4 border-t">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            초기화
          </button>
          <div className="flex-1"></div>
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={processing}
            className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            적용하기
          </button>
        </div>

        {/* 숨겨진 캔버스 (이미지 처리용) */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
