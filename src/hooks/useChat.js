import { useState, useEffect } from 'react';
import PeerService from '../services/PeerService.js';

const useChat = (friendId) => {
  const [messages, setMessages] = useState(() => {
    return JSON.parse(localStorage.getItem(`msgs_${friendId}`) || '[]');
  });

  useEffect(() => {
    const handleIncoming = (msg) => {
      if (msg.sender === friendId || msg.receiver === friendId) {
        setMessages(prev => {
          const updated = [...prev, msg];
          localStorage.setItem(`msgs_${friendId}`, JSON.stringify(updated));
          return updated;
        });
      }
    };

    // Безопасная подписка
    if (PeerService.handlers) {
      PeerService.handlers.add(handleIncoming);
    }

    return () => {
      if (PeerService.handlers) {
        PeerService.handlers.delete(handleIncoming);
      }
    };
  }, [friendId]);

  const sendMessage = async (to, text) => {
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