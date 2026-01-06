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
      if (msg.sender === friendId || (msg.sender === 'me' && friendId)) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          const updated = [...prev, msg];
          localStorage.setItem(`msgs_${friendId}`, JSON.stringify(updated));
          return updated;
        });
      }
    };

    const handleStatus = (data) => {
      if (data.type === 'message_status') {
        setMessages(prev => {
          const updated = prev.map(m => m.id === data.msgId ? { ...m, status: data.status } : m);
          localStorage.setItem(`msgs_${friendId}`, JSON.stringify(updated));
          return updated;
        });
      }
    };

    PeerService.handlers.add(handleIncoming);
    PeerService.statusHandlers.add(handleStatus);

    return () => {
      PeerService.handlers.delete(handleIncoming);
      PeerService.statusHandlers.delete(handleStatus);
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