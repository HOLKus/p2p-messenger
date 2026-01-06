import { APP_CONFIG } from '../config.js';

export const StorageService = {
  // Работа с LocalStorage
  getFriends: () => JSON.parse(localStorage.getItem('chat_friends') || '[]'),
  saveFriends: (friends) => localStorage.setItem('chat_friends', JSON.stringify(friends)),
  getMyId: () => localStorage.getItem('my_peer_id'),
  saveMyId: (id) => localStorage.setItem('my_peer_id', id),
  getTheme: () => localStorage.getItem('theme') || 'light',
  saveTheme: (theme) => localStorage.setItem('theme', theme),

  // Логика создания объекта друга
  createFriendObject: (id, currentList) => {
    if (!id) return null;
    const cleanId = id.trim();
    if (cleanId === "" || currentList.find(f => f.id === cleanId)) return null;
    
    const defaultName = cleanId.length > 4 
      ? cleanId.slice(APP_CONFIG.DEFAULT_NAME_SLICE) 
      : cleanId;
      
    return { id: cleanId, name: defaultName };
  }
};