import React, { useState, useEffect, useRef, useMemo } from 'react';
import useChat from './hooks/useChat.js';
import PeerService from './services/PeerService.js';
import { lightStyles, darkStyles } from './styles.js';
import { formatId, copyToClipboard, getStatusText } from './constants.js';
import { APP_CONFIG } from './config.js';
import { Storage, createFriendObject } from './utils.js';

const App = () => {
  const [darkMode, setDarkMode] = useState(() => Storage.getTheme() === 'dark');
  const [peerId, setPeerId] = useState(() => Storage.getMyId() || '');
  const [activeFriend, setActiveFriend] = useState(null);
  const [friendList, setFriendList] = useState(() => Storage.getFriends());
  const [showSettings, setShowSettings] = useState(false);
  const [secureFriends, setSecureFriends] = useState({});
  const { messages, setMessages, sendMessage } = useChat(activeFriend);
  
  const styles = darkMode ? darkStyles : lightStyles;
  const messagesEndRef = useRef(null);

  const uniqueMessages = useMemo(() => {
    if (!APP_CONFIG.DEDUPLICATION_ENABLED) return messages;
    const map = new Map();
    messages.forEach(m => map.set(m.id, m));
    return Array.from(map.values());
  }, [messages]);

  useEffect(() => {
    PeerService.init(peerId, friendList).then(id => {
      setPeerId(id);
      Storage.saveMyId(id);
    });
    
    PeerService.onKeyExchange = (fid) => {
      setSecureFriends(prev => ({ ...prev, [fid]: !!PeerService.friendPublicKeys[fid] }));
    };

    const handleStatus = (data) => {
      if (data.type === 'message_status') {
        setMessages(prev => prev.map(m => m.id === data.msgId ? {...m, status: data.status} : m));
      }
    };

    if (PeerService.statusHandlers) {
      PeerService.statusHandlers.add(handleStatus);
    }

    const checker = setInterval(() => {
      friendList.forEach(f => {
        if (!secureFriends[f.id]) PeerService.connectToFriend(f.id);
      });
    }, APP_CONFIG.CONNECTION_CHECK_INTERVAL);

    return () => {
      clearInterval(checker);
      if (PeerService.statusHandlers) PeerService.statusHandlers.delete(handleStatus);
    };
  }, [friendList, secureFriends, peerId, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ 
        behavior: APP_CONFIG.AUTO_SCROLL_SMOOTH ? 'smooth' : 'auto' 
    });
  }, [uniqueMessages]);

  const addFriend = () => {
    const id = prompt("Введите ID друга:");
    const newFriend = createFriendObject(id, friendList);
    if (newFriend && newFriend.id !== peerId) {
      const newList = [...friendList, newFriend];
      setFriendList(newList);
      Storage.saveFriends(newList);
      PeerService.connectToFriend(newFriend.id);
    }
  };

  const deleteFriend = (id, e) => {
    e.stopPropagation();
    if (window.confirm("Удалить этого друга и историю переписки?")) {
      const newList = friendList.filter(f => f.id !== id);
      setFriendList(newList);
      Storage.saveFriends(newList);
      localStorage.removeItem(`msgs_${id}`);
      if (activeFriend === id) setActiveFriend(null);
    }
  };

  const editFriend = (id, e) => {
    e.stopPropagation();
    const friend = friendList.find(f => f.id === id);
    const newName = prompt("Введите новое имя:", friend.name);
    if (newName && newName.trim() !== "") {
      const newList = friendList.map(f => f.id === id ? {...f, name: newName} : f);
      setFriendList(newList);
      Storage.saveFriends(newList);
    }
  };

  return (
    <div style={styles.appContainer}>
      {/* ЛЕВАЯ КОЛОНКА */}
      <div style={styles.leftColumn}>
        <div style={{padding:'20px', borderBottom: `1px solid ${darkMode?'#334155':'#D1D5DB'}`}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div onClick={() => copyToClipboard(peerId)} style={{cursor:'pointer'}}>
              <div style={{fontSize:'10px', opacity:0.6, fontWeight:'bold'}}>ВАШ ID</div>
              <div style={{fontWeight:'bold', color: '#10B981'}}>{formatId(peerId)}</div>
            </div>
            <button onClick={() => setShowSettings(true)} style={styles.iconBtn}>⚙️</button>
          </div>
        </div>

        <div style={{flex:1, overflowY:'auto'}}>
          {friendList.map(f => (
            <div key={f.id} onClick={() => setActiveFriend(f.id)} 
                 style={{
                   ...styles.friendItem, 
                   ...(activeFriend === f.id ? styles.friendItemActive : {}),
                   display:'flex', 
                   alignItems:'center', 
                   justifyContent:'space-between'
                 }}>
              
              <div style={{display:'flex', alignItems:'center', flex: 1, overflow: 'hidden'}}>
                <div style={{
                  width:'8px', height:'8px', borderRadius:'50%', 
                  background: secureFriends[f.id] ? '#10B981' : '#94A3B8', 
                  marginRight:'10px', flexShrink: 0
                }} />
                <div style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.name}</div>
              </div>

              <div style={{display:'flex', gap: '5px', marginLeft: '10px'}}>
                <button onClick={(e) => editFriend(f.id, e)} style={{background:'none', border:'none', cursor:'pointer', padding: '5px'}}>✏️</button>
                <button onClick={(e) => deleteFriend(f.id, e)} style={{background:'none', border:'none', cursor:'pointer', padding: '5px'}}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{padding:'15px'}}>
          <button onClick={addFriend} style={{...styles.btnBlue, width:'100%'}}>+ Добавить друга</button>
        </div>
      </div>

      {/* ПРАВАЯ КОЛОНКА */}
      <div style={styles.rightColumn}>
        {activeFriend ? (
          <>
            <div style={styles.chatHeader}>
              <div>
                <div style={{fontWeight:'bold'}}>{friendList.find(f => f.id === activeFriend)?.name}</div>
                <div style={{fontSize:'11px', color: secureFriends[activeFriend] ? '#10B981' : '#F59E0B'}}>
                  {secureFriends[activeFriend] ? 'Защищено' : 'Ожидание защиты...'}
                </div>
              </div>
            </div>

            <div style={styles.messagesContainer}>
              {uniqueMessages.filter(m => m.sender === activeFriend || m.receiver === activeFriend || (m.sender === 'me' && activeFriend)).map(m => (
                <div key={m.id} style={m.sender === 'me' ? styles.myMsg : styles.theirMsg}>
                  {m.text}
                  {m.sender === 'me' && <div style={{fontSize:'9px', opacity:0.7}}>{getStatusText(m.status)}</div>}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={(e) => { 
              e.preventDefault(); 
              if(e.target.msg.value) { 
                sendMessage(activeFriend, e.target.msg.value); 
                e.target.msg.value=''; 
              } 
            }} style={styles.inputArea}>
              <input name="msg" style={styles.mainInput} placeholder="Напишите сообщение..." autoComplete="off" />
              <button type="submit" style={styles.btnBlue}>ОТПРАВИТЬ</button>
            </form>
          </>
        ) : (
          <div style={{margin:'auto', opacity:0.5}}>Выберите чат или добавьте друга</div>
        )}
      </div>

      {/* МОДАЛКА НАСТРОЕК */}
      {showSettings && (
        <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{marginTop: 0}}>Настройки</h3>
            <button onClick={() => { 
              const newMode = !darkMode;
              setDarkMode(newMode); 
              Storage.saveTheme(newMode ? 'dark' : 'light'); 
            }} style={{...styles.btnBlue, width:'100%'}}>Сменить тему</button>
            
            <button onClick={() => {
              if(window.confirm("Это удалит ваш ID и всех друзей. Вы уверены?")) {
                localStorage.clear(); 
                window.location.reload();
              }
            }} 
            style={{...styles.btnBlue, background:'#EF4444', width:'100%', marginTop:'10px'}}>
              Удалить всё
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;