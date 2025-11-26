import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasources: {
    db: {
      provider: 'postgresql',
      url: process.env.DATABASE_URL, // .env 파일의 주소를 여기서 가져옵니다.
    },
  },
});