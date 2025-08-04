// src/types/global.d.ts - Tạo file này trong thư mục src/types
declare global {
  interface Window {
    socket: any; // Hoặc import type Socket từ socket.io-client
  }
}

export {};
