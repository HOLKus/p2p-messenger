import Peer from 'peerjs';
import * as CryptoService from './CryptoService.js';
import { APP_CONFIG } from '../config.js';

class PeerService {
  handlers = new Set();
  statusHandlers = new Set();

  constructor() {
    this.peer = null;
    this.id = null;
    this.connections = {};
    this.friendPublicKeys = {};
    this.myKeys = null;
    this.onKeyExchange = null;
  }

  async init(existingId = null, initialFriends = []) {
    try {
      // Генерируем ключи forge (теперь это объекты с методами .encrypt/.decrypt)
      if (!this.myKeys) {
        console.log("[PeerService] Генерация RSA ключей...");
        this.myKeys = await CryptoService.generateKeys();
      }
    } catch(e) { console.error("Crypto init error", e); }
    
    const savedId = existingId || localStorage.getItem('my_peer_id');

    return new Promise((resolve) => {
      const connect = (tid) => {
        if (this.peer) {
          this.peer.off();
          if (!this.peer.destroyed) this.peer.destroy();
        }

        this.peer = new Peer(tid, APP_CONFIG.PEER_OPTIONS);
        
        this.peer.on('open', (id) => {
          this.id = id;
          localStorage.setItem('my_peer_id', id);
          console.log("Ваш Peer ID:", id);
          initialFriends.forEach(f => this.connectToFriend(f.id));
          resolve(id);
        });

        this.peer.on('connection', (c) => this.setupConnection(c));
        
        this.peer.on('error', (err) => {
          if (['unavailable-id', 'network', 'socket-error'].includes(err.type)) {
            setTimeout(() => connect(tid), 5000);
          }
        });
      };
      connect(savedId);
    });
  }

  connectToFriend(friendId) {
    if (!this.peer || this.peer.destroyed || this.id === friendId) return;
    if (this.connections[friendId]?.readyState === 'open') return;

    try {
      const conn = this.peer.connect(friendId, { reliable: true });
      if (conn) this.setupConnection(conn);
    } catch (e) { console.error("Connect error:", e); }
  }

  async sendHandshake(conn) {
    if (!this.myKeys || !conn || conn.readyState !== 'open') return;
    try {
      // Экспортируем публичный ключ в PEM-строку для передачи
      const pubKeyPem = CryptoService.exportPublicKey(this.myKeys.publicKey);
      conn.send({ type: 'handshake', publicKey: pubKeyPem });
      console.log(`[PeerService] Handshake отправлен другу: ${conn.peer}`);
    } catch (e) { console.error("Handshake error", e); }
  }

  setupConnection(conn) {
    if (!conn || !conn.peer) return;
    const friendId = conn.peer;
    this.connections[friendId] = conn;

    conn.on('open', () => {
      console.log(`[PeerService] Канал открыт: ${friendId}`);
      this.sendHandshake(conn);
    });

    conn.on('data', async (data) => {
      if (data.type === 'handshake') {
        try {
          // Импортируем полученную PEM-строку обратно в объект ключа forge
          this.friendPublicKeys[friendId] = CryptoService.importPublicKey(data.publicKey);
          console.log(`[PeerService] Защита установлена для: ${friendId}`);
          
          if (this.onKeyExchange) this.onKeyExchange(friendId);
          
          if (data.reply !== false) {
             const pubKeyPem = CryptoService.exportPublicKey(this.myKeys.publicKey);
             conn.send({ type: 'handshake', publicKey: pubKeyPem, reply: false });
          }
        } catch (e) { console.error("Ошибка импорта ключа:", e); }
      }
      
      if (data.type === 'message') {
        try {
          // Расшифровываем через forge
          const decrypted = await CryptoService.decryptMessage(data.encryptedMessage, this.myKeys.privateKey);
          this.handlers.forEach(h => h({ id: data.msgId, text: decrypted, sender: friendId }));
          conn.send({ type: 'message_status', msgId: data.msgId, status: 'delivered' });
        } catch (e) { console.error("Ошибка расшифровки:", e); }
      }

      if (data.type === 'message_status') {
        this.statusHandlers.forEach(h => h(data));
      }
    });

    conn.on('close', () => {
      delete this.connections[friendId];
      delete this.friendPublicKeys[friendId];
      this.statusHandlers.forEach(h => h({ type: 'status_update', friendId, online: false }));
    });
  }

  async sendMessage(friendId, text) {
    const conn = this.connections[friendId];
    const pubKey = this.friendPublicKeys[friendId];

    if (!conn || conn.readyState !== 'open' || !pubKey) {
      this.connectToFriend(friendId);
      return { id: Date.now().toString(), text, sender: 'me', status: 'error' };
    }

    const msgId = Date.now().toString();
    try {
      const encrypted = await CryptoService.encryptMessage(text, pubKey);
      conn.send({ type: 'message', encryptedMessage: encrypted, msgId });
      return { id: msgId, text, sender: 'me', status: 'sent' };
    } catch (e) { 
      return { id: msgId, text, sender: 'me', status: 'error' }; 
    }
  }
}

export default new PeerService();