import { useState, useEffect } from 'react';
import PeerService from '../services/PeerService.js';

const useChat = (friendId) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!friendId) {
      setMessages([]);
      return;
    }

    const saved = JSON.parse(localStorage.getItem(`msgs_${friendId}`) || '[]');
    setMessages(saved);

    const handleIncoming = (msg) => {
      // Принимаем сообщение только если оно от текущего друга или мы сами отправили его этому другу
      if (msg.sender === friendId || (msg.sender === 'me' && friendId)) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          const updated = [...prev, msg];
          localStorage.setItem(`msgs_${friendId}`, JSON.stringify(updated));
          return updated;
        });
      }
    };

    PeerService.handlers.add(handleIncoming);
    return () => {
      PeerService.handlers.delete(handleIncoming);
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

  return { messages, sendMessage };
};

export default useChat;