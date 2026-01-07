import React, { useState, useEffect, useRef, useMemo } from 'react';
import useChat from './hooks/useChat.js';
import PeerService from './services/PeerService.js';
import { lightStyles, darkStyles } from './styles.js';
import { formatId, copyToClipboard, getStatusText } from './constants.js';
import { APP_CONFIG } from './config.js';
import { Storage, createFriendObject } from './utils.js';
import CallService from './services/CallService.js';

const App = () => {
  const [darkMode, setDarkMode] = useState(() => Storage.getTheme() === 'dark');
  const [peerId, setPeerId] = useState(() => Storage.getMyId() || '');
  const [activeFriend, setActiveFriend] = useState(null);
  const [friendList, setFriendList] = useState(() => Storage.getFriends());
  const [showSettings, setShowSettings] = useState(false);
  const [secureFriends, setSecureFriends] = useState({});
  
  // Подключаем наш хук чата
  const { messages, sendMessage } = useChat(activeFriend);
  
  const styles = darkMode ? darkStyles : lightStyles;
  const messagesEndRef = useRef(null);

  // Фильтруем сообщения: только те, где отправитель или получатель — активный друг
  const currentChatMessages = useMemo(() => {
    if (!activeFriend) return [];
    return messages.filter(m => 
      m.sender === activeFriend || (m.sender === 'me' && activeFriend)
    );
  }, [messages, activeFriend]);

  // Инициализация сервиса и обработка событий
  useEffect(() => {
  PeerService.init(peerId, friendList).then(id => {
    setPeerId(id);
    
    // Слушаем входящие звонки
    PeerService.peer.on('call', (incomingCall) => {
      const callerName = friendList.find(f => f.id === incomingCall.peer)?.name || "Неизвестный";
      if (window.confirm(`Входящий звонок от: ${callerName}. Ответить?`)) {
        CallService.answerCall(incomingCall, (remoteStream) => {
          // Воспроизведение звука
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.play();
        });
      } else {
        incomingCall.close();
      }
    });
  });
  // ...
}, [friendList]);
    
    // Следим за состоянием шифрования
    PeerService.onKeyExchange = (fid) => {
      setSecureFriends(prev => ({ 
        ...prev, 
        [fid]: !!PeerService.friendPublicKeys[fid] 
      }));
    };

    // Интервал проверки соединений
    const checker = setInterval(() => {
      friendList.forEach(f => {
        if (!PeerService.connections[f.id] || PeerService.connections[f.id].readyState !== 'open') {
          PeerService.connectToFriend(f.id);
        }
      });
    }, APP_CONFIG.CONNECTION_CHECK_INTERVAL);

    return () => clearInterval(checker);
  }, [friendList, peerId]);

  // Автопрокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChatMessages]);

  // --- Функции управления друзьями ---
  
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
      {/* ЛЕВАЯ ПАНЕЛЬ (Список друзей) */}
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
                   display:'flex', alignItems:'center', justifyContent:'space-between'
                 }}>
              
              <div style={{display:'flex', alignItems:'center', flex: 1, overflow: 'hidden'}}>
                <div style={{
                  width:'8px', height:'8px', borderRadius:'50%', 
                  background: secureFriends[f.id] ? '#10B981' : '#94A3B8', 
                  marginRight:'10px', flexShrink: 0
                }} />
                <div style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.name}</div>
              </div>

              <div style={{display:'flex', gap: '5px'}}>
                <button onClick={(e) => editFriend(f.id, e)} style={{background:'none', border:'none', cursor:'pointer'}}>✏️</button>
                <button onClick={(e) => deleteFriend(f.id, e)} style={{background:'none', border:'none', cursor:'pointer'}}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{padding:'15px'}}>
          <button onClick={addFriend} style={{...styles.btnBlue, width:'100%'}}>+ Добавить друга</button>
        </div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ (Чат) */}
      <div style={styles.rightColumn}>
        {activeFriend ? (
          <>
            <div style={styles.chatHeader}>
              <div>
                <div style={{fontWeight:'bold'}}>{friendList.find(f => f.id === activeFriend)?.name}</div>
                <div style={{fontSize:'11px', color: secureFriends[activeFriend] ? '#10B981' : '#F59E0B'}}>
                  {secureFriends[activeFriend] ? 'Защищено (RSA/AES)' : 'Установка защиты...'}
                </div>
              </div>
            </div>

            <div style={styles.messagesContainer}>
              {currentChatMessages.map(m => (
                <div key={m.id} style={m.sender === 'me' ? styles.myMsg : styles.theirMsg}>
                  <div>{m.text}</div>
                  {m.sender === 'me' && (
                    <div style={{fontSize:'10px', textAlign:'right', opacity:0.5, marginTop:'2px'}}>
                      {m.status === 'delivered' ? '✓✓' : m.status === 'sent' ? '✓' : '...'}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={(e) => { 
              e.preventDefault(); 
              const val = e.target.msg.value;
              if(val.trim()) { 
                sendMessage(activeFriend, val); 
                e.target.msg.value=''; 
              } 
            }} style={styles.inputArea}>
              <input name="msg" style={styles.mainInput} placeholder="Напишите сообщение..." autoComplete="off" />
              <button type="submit" style={styles.btnBlue}>ОТПРАВИТЬ</button>
            </form>
          </>
        ) : (
          <div style={{margin:'auto', opacity:0.5, textAlign:'center'}}>
            <h3>Выберите чат</h3>
            <p>или добавьте друга по ID</p>
          </div>
        )}
      </div>
        <div style={styles.chatHeader}>
          
  <div>
    <div style={{fontWeight:'bold'}}>{friendList.find(f => f.id === activeFriend)?.name}</div>
    {/* Статус защиты... */}
  </div>
  
  {/* Кнопка звонка */}
  <button 
    onClick={() => {
      CallService.makeCall(PeerService.peer, activeFriend, (remoteStream) => {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play();
      });
      alert("Звоним другу...");
    }}
    style={{...styles.iconBtn, fontSize: '20px'}}
  >
    📞
  </button>
</div>

      {/* Модалка настроек */}
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
              if(window.confirm("Это удалит ваш ID и всех друзей. Продолжить?")) {
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