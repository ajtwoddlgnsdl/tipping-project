// client/src/components/ImageEditor.jsx
// 이미지 편집 컴포넌트 - 크롭, 회전, 밝기/대비 조절

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export default function ImageEditor({ imageUrl, onSave, onCancel }) {
  // 크롭 상태
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  
  // 편집 상태
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  
  // 현재 편집 모드
  const [editMode, setEditMode] = useState('crop'); // 'crop', 'adjust', 'rotate'
  
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
    return {
      filter: `brightness(${brightness}%) contrast(${contrast}%)`,
      transform: `rotate(${rotation}deg)`,
      transition: 'transform 0.3s ease',
    };
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
      width: image.naturalWidth,
      height: image.naturalHeight,
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
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

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
    setCrop(undefined);
    setCompletedCrop(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="w-full max-w-4xl mx-4 overflow-hidden bg-white rounded-2xl">
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
        <div className="flex border-b bg-gray-50">
          {[
            { id: 'crop', label: '자르기', icon: '✂️' },
            { id: 'rotate', label: '회전', icon: '🔄' },
            { id: 'adjust', label: '밝기/대비', icon: '☀️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setEditMode(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors
                ${editMode === tab.id 
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'}`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 이미지 편집 영역 */}
        <div className="relative flex items-center justify-center p-4 bg-gray-100" style={{ minHeight: '400px' }}>
          {editMode === 'crop' ? (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={undefined}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="편집할 이미지"
                onLoad={onImageLoad}
                style={{ 
                  maxHeight: '400px', 
                  maxWidth: '100%',
                  ...getFilterStyle() 
                }}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          ) : (
            <img
              ref={imgRef}
              src={imageUrl}
              alt="편집할 이미지"
              style={{ 
                maxHeight: '400px', 
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

          {/* 밝기/대비 도구 */}
          {editMode === 'adjust' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="w-20 text-sm font-medium text-gray-700">밝기</label>
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
                <label className="w-20 text-sm font-medium text-gray-700">대비</label>
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
            </div>
          )}

          {/* 크롭 도구 안내 */}
          {editMode === 'crop' && (
            <div className="text-center text-gray-600">
              <p className="text-sm">✂️ 드래그하여 원하는 영역을 선택하세요</p>
              <p className="mt-1 text-xs text-gray-400">제품이 잘 보이도록 불필요한 부분을 잘라내면 인식률이 높아집니다</p>
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
            className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
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
