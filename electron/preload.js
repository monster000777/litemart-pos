import { contextBridge } from 'electron';

// 暴露基础的系统或状态 API 给渲染进程 (Nuxt)
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform,
});
