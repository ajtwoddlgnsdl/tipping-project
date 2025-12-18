# 🛍️ Tipping - 이미지 기반 상품 검색 서비스

> **"사진 한 장으로 최저가 상품을 찾아드립니다"**

![React](https://img.shields.io/badge/React-19.1.0-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1.8-06B6D4?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)

---

## 📋 프로젝트 소개

**Tipping**은 사용자가 원하는 상품의 이미지를 업로드하면, AI가 이미지를 분석하여 유사한 상품을 검색해주는 서비스입니다.

### 💡 기획 배경
- 길거리나 SNS에서 마음에 드는 제품을 봤지만 이름을 모를 때
- 특정 상품의 최저가를 빠르게 비교하고 싶을 때
- 텍스트 검색으로는 원하는 상품을 찾기 어려울 때

### 🎯 주요 기능
| 기능 | 설명 |
|------|------|
| **📷 이미지 업로드** | 파일 선택, 드래그 앤 드롭, 카메라 촬영 지원 |
| **🤖 AI 이미지 분석** | Google Cloud Vision API로 이미지 내 상품 인식 |
| **🔍 상품 검색** | SerpAPI + Google Shopping을 통한 유사 상품 검색 |
| **✂️ 이미지 편집** | 자르기, 회전, 필터, 배경 제거, 업스케일 기능 |
| **❤️ 찜 목록** | 마음에 드는 상품 저장 및 관리 |
| **🔐 소셜 로그인** | Google, Kakao OAuth 지원 |

---

## 🔗 배포 링크

| 환경 | URL |
|------|-----|
| **🚀 Vercel (메인)** | [https://tipping-project.vercel.app](https://tipping-project.vercel.app) |
| **📄 GitHub Pages** | [https://ajtwoddlgnsdl.github.io/tipping-project](https://ajtwoddlgnsdl.github.io/tipping-project) |

> ⚠️ **권장**: Vercel 배포 버전을 사용해주세요. GitHub Pages는 시험 제출용으로 설정되어 있습니다.

---

## 🛠️ 기술 스택

### Frontend
- **React 19** + **Vite 7** - 빠른 개발 환경
- **TailwindCSS** - 유틸리티 기반 스타일링
- **React Router DOM** - SPA 라우팅
- **Axios** - HTTP 클라이언트
- **React Toastify** - 알림 UI

### Backend
- **Node.js** + **Express** - REST API 서버
- **Prisma ORM** - 데이터베이스 관리
- **PostgreSQL** (Supabase) - 데이터베이스
- **JWT** - 인증 토큰
- **Multer** - 파일 업로드 처리

### External APIs
- **Google Cloud Vision API** - 이미지 분석
- **SerpAPI** - Google Shopping 검색
- **Google OAuth 2.0** - 구글 소셜 로그인
- **Kakao OAuth** - 카카오 소셜 로그인

### Deployment
- **Vercel** - 프론트엔드 배포
- **Render** - 백엔드 배포
- **GitHub Actions** - CI/CD

---

## 📁 프로젝트 구조

```
tipping-project/
├── client/                 # 프론트엔드 (React)
│   ├── src/
│   │   ├── api/           # Axios 인스턴스
│   │   ├── components/    # 재사용 컴포넌트
│   │   │   ├── ImageEditor.jsx   # 이미지 편집기
│   │   │   └── ProductCard.jsx   # 상품 카드
│   │   └── pages/         # 페이지 컴포넌트
│   │       ├── Home.jsx       # 메인 (검색)
│   │       ├── Login.jsx      # 로그인
│   │       ├── Register.jsx   # 회원가입
│   │       └── Wishlist.jsx   # 찜 목록
│   └── public/            # 정적 파일
│
├── server/                 # 백엔드 (Express)
│   ├── controllers/       # 비즈니스 로직
│   │   ├── authController.js      # 인증
│   │   ├── searchController.js    # 검색
│   │   └── wishlistController.js  # 찜 목록
│   ├── middlewares/       # 미들웨어
│   ├── routes/            # API 라우트
│   └── prisma/            # DB 스키마
│
└── docs/                   # 📚 문서
    ├── 웹프로그래밍_중간고사_기획서_김재훈.pdf  # 기획서
    ├── 프로젝트_평가서.md                      # 프로젝트 평가
    ├── 감사보고서_문서.md                      # 코드 감사 보고서
    ├── AI_바이브코딩_세미나_보고서.md          # AI 개발 보고서
    └── 프로젝트_리더_역량_평가.md              # 리더 역량 평가
```

---

## 📚 문서 (docs 폴더)

| 파일명 | 설명 |
|--------|------|
| `웹프로그래밍_중간고사_기획서_김재훈.pdf` | 프로젝트 기획서 (중간고사 제출) |
| `프로젝트_평가서.md` | 시니어 엔지니어 관점 프로젝트 종합 평가 |
| `감사보고서_문서.md` | 코드 레벨 보안/품질 감사 보고서 |
| `AI_바이브코딩_세미나_보고서.md` | AI 활용 개발 생산성 분석 |
| `프로젝트_리더_역량_평가.md` | 프롬프터 역량 평가 |

---

## 📖 사용 방법

### 1️⃣ 이미지로 상품 검색하기

1. **이미지 업로드**
   - 메인 화면에서 `파일 선택` 버튼 클릭 또는 이미지를 드래그 앤 드롭
   - 또는 `카메라` 버튼을 눌러 직접 촬영

2. **이미지 편집 (선택사항)**
   - 업로드 후 `편집` 버튼 클릭
   - 자르기: 상품 부분만 선택하여 정확도 향상
   - 필터: 밝기, 대비 조정
   - AI 기능: 배경 제거, 이미지 업스케일

3. **검색 실행**
   - `검색` 버튼 클릭
   - AI가 이미지를 분석하여 유사 상품을 찾아줍니다
   - 검색 결과에서 가격, 판매처 확인 가능

### 2️⃣ 찜 목록 활용하기

1. **상품 찜하기**
   - 검색 결과에서 마음에 드는 상품의 `❤️` 버튼 클릭
   - 로그인 필요

2. **찜 목록 확인**
   - 상단 네비게이션의 `찜 목록` 클릭
   - 저장한 상품들을 한눈에 확인
   - 상품 클릭 시 판매 사이트로 이동

### 3️⃣ 회원가입 및 로그인

1. **간편 로그인**
   - `Google로 로그인` 또는 `Kakao로 로그인` 버튼 클릭
   - 별도 회원가입 없이 바로 이용 가능

2. **이메일 회원가입**
   - `회원가입` 페이지에서 이메일, 닉네임, 비밀번호 입력
   - 비밀번호: 영문 + 숫자 포함 8자 이상

### 💡 사용 팁

| 팁 | 설명 |
|---|------|
| **🎯 정확한 검색** | 상품만 나오도록 이미지를 크롭하면 검색 정확도가 올라갑니다 |
| **📱 모바일 지원** | 스마트폰에서도 카메라로 바로 촬영하여 검색 가능 |
| **💾 찜 목록 활용** | 나중에 구매할 상품은 찜 목록에 저장해두세요 |

---

## 👨‍💻 개발자 정보

| 이름 | 역할 | GitHub |
|------|------|--------|
| 김재훈 | 풀스택 개발 | [@ajtwoddlgnsdl](https://github.com/ajtwoddlgnsdl) |

---

## 📄 라이선스

이 프로젝트는 학습 및 과제 제출 목적으로 제작되었습니다.

---

## 🙏 감사의 말

이 프로젝트는 **AI 바이브코딩(GitHub Copilot + Claude)** 을 활용하여 개발되었습니다.
AI 도구의 도움으로 짧은 기간 내에 완성도 높은 서비스를 구현할 수 있었습니다.

---

*웹프로그래밍 기말고사 제출 - 2025년 12월*
