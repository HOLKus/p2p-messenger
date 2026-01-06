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
      if (!this.myKeys) this.myKeys = await CryptoService.generateKeys();
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
          initialFriends.forEach(f => this.connectToFriend(f.id));
          resolve(id);
        });

        this.peer.on('connection', (c) => this.setupConnection(c));
        
        this.peer.on('error', (err) => {
          console.error("PeerJS Error:", err.type);
          if (['unavailable-id', 'network', 'socket-error'].includes(err.type)) {
            setTimeout(() => connect(tid), APP_CONFIG.ID_RETRY_INTERVAL);
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
      const pubKey = await CryptoService.exportPublicKey(this.myKeys.publicKey);
      conn.send({ type: 'handshake', publicKey: pubKey });
    } catch (e) { console.error("Handshake error", e); }
  }

  setupConnection(conn) {
    if (!conn || !conn.peer) return;
    const friendId = conn.peer;
    this.connections[friendId] = conn;

    conn.on('open', () => {
      this.sendHandshake(conn);
      this.statusHandlers.forEach(h => h({ type: 'status_update', friendId, online: true }));
    });

    conn.on('data', async (data) => {
      // 1. Обработка ключей
      if (data.type === 'handshake') {
        this.friendPublicKeys[friendId] = await CryptoService.importPublicKey(data.publicKey);
        if (this.onKeyExchange) this.onKeyExchange(friendId);
        if (data.reply !== false) {
           const pubKey = await CryptoService.exportPublicKey(this.myKeys.publicKey);
           conn.send({ type: 'handshake', publicKey: pubKey, reply: false });
        }
      }
      
      // 2. Получение сообщения + Отправка подтверждения
      if (data.type === 'message') {
        try {
          const decrypted = await CryptoService.decryptMessage(data.encryptedMessage, this.myKeys.privateKey);
          this.handlers.forEach(h => h({ id: data.msgId, text: decrypted, sender: friendId }));
          // Отправляем ACK (подтверждение)
          conn.send({ type: 'message_status', msgId: data.msgId, status: 'delivered' });
        } catch (e) { console.error("Decryption error", e); }
      }

      // 3. Получение статуса от собеседника
      if (data.type === 'message_status') {
        this.statusHandlers.forEach(h => h(data));
      }
    });

    conn.on('close', () => {
      delete this.connections[friendId];
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