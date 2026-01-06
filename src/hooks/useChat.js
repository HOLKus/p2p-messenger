import { useState, useEffect } from 'react';
import PeerService from '../services/PeerService.js';

const useChat = (friendId) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // 1. Загружаем сообщения из памяти при смене друга
    if (friendId) {
      const saved = JSON.parse(localStorage.getItem(`msgs_${friendId}`) || '[]');
      setMessages(saved);
    } else {
      setMessages([]);
    }

    // 2. Функция обработки входящих
    const handleIncoming = (msg) => {
      // Проверяем, относится ли сообщение к текущему открытому чату
      if (msg.sender === friendId || (msg.sender === 'me' && friendId)) {
        setMessages(prev => {
          const isDuplicate = prev.some(m => m.id === msg.id);
          if (isDuplicate) return prev;

          const updated = [...prev, msg];
          // Сохраняем в localStorage, используя правильный ID
          localStorage.setItem(`msgs_${friendId}`, JSON.stringify(updated));
          return updated;
        });
      }
    };

    // 3. Подписываемся на события из PeerService
    if (PeerService.handlers) {
      PeerService.handlers.add(handleIncoming);
    }

    // 4. Очистка при размонтировании или смене ID
    return () => {
      if (PeerService.handlers) {
        PeerService.handlers.delete(handleIncoming);
      }
    };
  }, [friendId]);

  const sendMessage = async (to, text) => {
    if (!text.trim()) return;

    const newMsg = await PeerService.sendMessage(to, text);
    if (newMsg) {
      setMessages(prev => {
        const updated = [...prev, newMsg];
        localStorage.setItem(`msgs_${to}`, JSON.stringify(updated));
        return updated;
      });
    }
  };

  return { messages, setMessages, sendMessage };
};

export default useChat;