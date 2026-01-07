import React, { useState, useEffect, useRef, useMemo } from 'react';
import useChat from './hooks/useChat.js';
import PeerService from './services/PeerService.js';
import CallService from './services/CallService.js';
import { lightStyles, darkStyles } from './styles.js';
import { formatId, copyToClipboard } from './constants.js';
import { APP_CONFIG } from './config.js';
import { Storage, createFriendObject } from './utils.js';

const App = () => {
  const [darkMode, setDarkMode] = useState(() => Storage.getTheme() === 'dark');
  const [peerId, setPeerId] = useState(() => Storage.getMyId() || '');
  const [activeFriend, setActiveFriend] = useState(null);
  const [friendList, setFriendList] = useState(() => Storage.getFriends());
  const [showSettings, setShowSettings] = useState(false);
  const [secureFriends, setSecureFriends] = useState({});
  
  const { messages, sendMessage } = useChat(activeFriend);
  const styles = darkMode ? darkStyles : lightStyles;
  const messagesEndRef = useRef(null);

  const currentChatMessages = useMemo(() => {
    if (!activeFriend) return [];
    return messages.filter(m => 
      m.sender === activeFriend || (m.sender === 'me' && activeFriend)
    );
  }, [messages, activeFriend]);

  useEffect(() => {
    PeerService.init(peerId, friendList).then(id => {
      setPeerId(id);
      Storage.saveMyId(id);

      PeerService.peer.on('call', (incomingCall) => {
        const caller = friendList.find(f => f.id === incomingCall.peer)?.name || "Неизвестный";
        if (window.confirm(`Входящий звонок от: ${caller}. Ответить?`)) {
          CallService.answerCall(incomingCall, (remoteStream) => {
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.play();
          });
        } else {
          incomingCall.close();
        }
      });
    });
    
    PeerService.onKeyExchange = (fid) => {
      setSecureFriends(prev => ({ 
        ...prev, 
        [fid]: !!PeerService.friendPublicKeys[fid] 
      }));
    };

    const checker = setInterval(() => {
      friendList.forEach(f => {
        if (!PeerService.connections[f.id] || PeerService.connections[f.id].readyState !== 'open') {
          PeerService.connectToFriend(f.id);
        }
      });
    }, APP_CONFIG.CONNECTION_CHECK_INTERVAL);

    return () => clearInterval(checker);
  }, [friendList, peerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChatMessages]);

  // --- Управление друзьями ---
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
    if (window.confirm("Удалить друга и историю?")) {
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
      <div style={styles.leftColumn}>
        <div style={{padding:'20px', borderBottom: `1px solid ${darkMode?'#334155':'#D1D5DB'}`}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div onClick={() => copyToClipboard(peerId)} style={{cursor:'pointer'}}>
  <div style={{fontSize:'10px', opacity:0.6}}>ВАШ ID</div>
  <div style={{fontWeight:'bold', color: peerId ? '#10B981' : '#EF4444'}}>
    {peerId ? formatId(peerId) : "ПОДКЛЮЧЕНИЕ..."}
  </div>
</div>
            <button onClick={() => setShowSettings(true)} style={styles.iconBtn}>⚙️</button>
          </div>
        </div>

        <div style={{flex:1, overflowY:'auto'}}>
          {friendList.map(f => (
            <div key={f.id} onClick={() => setActiveFriend(f.id)} 
                 style={{...styles.friendItem, ...(activeFriend === f.id ? styles.friendItemActive : {})}}>
              <div style={{display:'flex', alignItems:'center', flex: 1, overflow: 'hidden'}}>
                <div style={{width:'8px', height:'8px', borderRadius:'50%', background: secureFriends[f.id] ? '#10B981' : '#94A3B8', marginRight:'10px', flexShrink: 0}} />
                <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.name}</span>
              </div>
              <div style={{display:'flex', gap: '5px'}}>
                <button onClick={(e) => editFriend(f.id, e)} style={{background:'none', border:'none', cursor:'pointer', fontSize: '14px'}}>✏️</button>
                <button onClick={(e) => deleteFriend(f.id, e)} style={{background:'none', border:'none', cursor:'pointer', fontSize: '14px'}}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:'15px'}}><button onClick={addFriend} style={{...styles.btnBlue, width:'100%'}}>+ Добавить</button></div>
      </div>

      <div style={styles.rightColumn}>
        {activeFriend ? (
          <>
            <div style={styles.chatHeader}>
              <div style={{flex: 1}}>
                <div style={{fontWeight:'bold'}}>{friendList.find(f => f.id === activeFriend)?.name}</div>
                <div style={{fontSize:'11px', color: secureFriends[activeFriend] ? '#10B981' : '#F59E0B'}}>
                  {secureFriends[activeFriend] ? 'Защищено (node-forge)' : 'Установка ключей...'}
                </div>
              </div>
              <button 
                onClick={() => {
                  CallService.makeCall(PeerService.peer, activeFriend, (remoteStream) => {
                    const audio = new Audio();
                    audio.srcObject = remoteStream;
                    audio.play();
                  });
                }}
                style={{...styles.iconBtn, fontSize: '20px'}}
              >📞</button>
            </div>

            <div style={styles.messagesContainer}>
              {currentChatMessages.map(m => (
                <div key={m.id} style={m.sender === 'me' ? styles.myMsg : styles.theirMsg}>
                  <div>{m.text}</div>
                  {m.sender === 'me' && (
                    <div style={{fontSize:'10px', textAlign:'right', opacity:0.5}}>
                        {m.status === 'delivered' ? '✓✓' : '✓'}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={(e) => { 
              e.preventDefault(); 
              const val = e.target.msg.value;
              if(val.trim()) { sendMessage(activeFriend, val); e.target.msg.value=''; } 
            }} style={styles.inputArea}>
              <input name="msg" style={styles.mainInput} placeholder="Сообщение..." autoComplete="off" />
              <button type="submit" style={styles.btnBlue}>ОТПРАВИТЬ</button>
            </form>
          </>
        ) : <div style={{margin:'auto', opacity: 0.5}}>Выберите чат из списка слева</div>}
      </div>

      {showSettings && (
        <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{marginTop: 0}}>Настройки</h3>
            <button onClick={() => { setDarkMode(!darkMode); Storage.saveTheme(!darkMode?'dark':'light'); }} style={{...styles.btnBlue, width:'100%', marginBottom:'10px'}}>Сменить тему</button>
            <button onClick={() => { if(window.confirm("Удалить всё?")) { localStorage.clear(); window.location.reload(); } }} style={{...styles.btnBlue, width:'100%', background:'#EF4444'}}>Удалить всё</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;