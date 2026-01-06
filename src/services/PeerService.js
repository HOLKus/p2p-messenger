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
  }

  async init(existingId = null, initialFriends = []) {
    try {
      if (!this.myKeys) this.myKeys = await CryptoService.generateKeys();
    } catch(e) { console.error("Crypto error", e); }
    
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
          if (['unavailable-id', 'network', 'socket-error'].includes(err.type)) {
            setTimeout(() => connect(tid), APP_CONFIG.ID_RETRY_INTERVAL);
          }
        });
      };
      connect(savedId);
    });
  }

  connectToFriend(friendId) {
    // Если peer еще не готов, мы сами не онлайн или уже есть соединение — выходим
    if (!this.peer || this.peer.destroyed || this.id === friendId) return;
    if (this.connections[friendId]?.open) return;

    console.log(`[PeerService] Попытка установить связь с: ${friendId}`);
    
    try {
      const conn = this.peer.connect(friendId, { reliable: true });
      
      // ЗАЩИТА: проверяем, что объект conn создался, прежде чем передавать его дальше
      if (conn) {
        this.setupConnection(conn);
      }
    } catch (e) {
      console.error("[PeerService] Ошибка при вызове peer.connect:", e);
    }
  }

  async sendHandshake(conn) {
    if (!this.myKeys || !conn || !conn.open) return;
    const pubKey = await CryptoService.exportPublicKey(this.myKeys.publicKey);
    conn.send({ type: 'handshake', publicKey: pubKey });
  }

  setupConnection(conn) {
    this.connections[conn.peer] = conn;
    conn.on('open', () => this.sendHandshake(conn));
    conn.on('data', async (data) => {
      if (!conn || !conn.peer) {
      console.warn("[PeerService] Попытка настроить пустое соединение (undefined)");
      return;
    }

    const friendId = conn.peer;
    this.connections[friendId] = conn;

    conn.on('open', () => {
      console.log(`[PeerService] Канал связи открыт с: ${friendId}`);
      this.sendHandshake(conn);
    });

    conn.on('data', async (data) => {
      // ... (ваш код обработки данных)
      console.log(`[PeerService] Получены данные от ${friendId}:`, data.type);
      
      if (data.type === 'handshake') {
        this.friendPublicKeys[friendId] = await CryptoService.importPublicKey(data.publicKey);
        if (this.onKeyExchange) this.onKeyExchange(friendId);
        
        if (data.reply !== false) {
           this.sendHandshake(conn);
        }
      }
      if (data.type === 'handshake') {
        this.friendPublicKeys[conn.peer] = await CryptoService.importPublicKey(data.publicKey);
        if (this.onKeyExchange) this.onKeyExchange(conn.peer);
        // Если мы получили ключ, но еще не отправили свой — отправляем
        if (data.reply !== false) {
           const pubKey = await CryptoService.exportPublicKey(this.myKeys.publicKey);
           conn.send({ type: 'handshake', publicKey: pubKey, reply: false });
        }
      }
      if (data.type === 'message') {
        const decrypted = await CryptoService.decryptMessage(data.encryptedMessage, this.myKeys.privateKey);
        this.handlers.forEach(h => h({ id: data.msgId, text: decrypted, sender: conn.peer }));
      }
    });
    conn.on('error', (err) => {
      console.error(`[PeerService] Ошибка соединения с ${friendId}:`, err);
    });

    conn.on('close', () => {
      console.log(`[PeerService] Соединение закрыто: ${friendId}`);
      delete this.connections[friendId];
      delete this.friendPublicKeys[friendId];
      if (this.onKeyExchange) this.onKeyExchange(friendId);
    });
  }
  }

  async sendMessage(friendId, text) {
    const conn = this.connections[friendId];
    const pubKey = this.friendPublicKeys[friendId];
    if (!conn?.open || !pubKey) return false;

    const msgId = Date.now().toString();
    const encrypted = await CryptoService.encryptMessage(text, pubKey);
    conn.send({ type: 'message', encryptedMessage: encrypted, msgId });
    
    return { id: msgId, text, sender: 'me', status: 'sent' };
  }
}

export default new PeerService();