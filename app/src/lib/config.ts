// 서버 주소: app/.env 의 EXPO_PUBLIC_API_URL (폰/태블릿에서 접근 가능한 주소, localhost X)
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.10:8000').replace(/\/$/, '');
