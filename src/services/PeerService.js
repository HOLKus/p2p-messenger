import Peer from 'peerjs';
import * as CryptoService from './CryptoService.js';
import { APP_CONFIG } from '../config.js';

class PeerService {
  // Инициализируем Set сразу, чтобы они никогда не были undefined
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
    } catch(e) { console.error("Crypto init failed", e); }
    
    const savedId = existingId || localStorage.getItem('my_peer_id');

    return new Promise((resolve) => {
      const connect = (tid) => {
        if (this.peer) {
          this.peer.off();
          if (!this.peer.destroyed) this.peer.destroy();
          this.peer = null;
        }

        this.peer = new Peer(tid, APP_CONFIG.PEER_OPTIONS);
        
        this.peer.on('open', (id) => {
          this.id = id;
          localStorage.setItem('my_peer_id', id);
          initialFriends.forEach(f => this.connectToFriend(f.id));
          resolve(id);
        });

        this.peer.on('error', (err) => {
          console.error("PeerJS Error:", err.type);
          if (['unavailable-id', 'network', 'socket-error'].includes(err.type)) {
            setTimeout(() => connect(tid), APP_CONFIG.ID_RETRY_INTERVAL);
          }
        });

        this.peer.on('disconnected', () => {
          if (this.peer && !this.peer.destroyed) {
            setTimeout(() => connect(tid), APP_CONFIG.ID_RETRY_INTERVAL);
          }
        });

        this.peer.on('connection', (c) => this.setupConnection(c));
      };
      connect(savedId);
    });
  }

  connectToFriend(friendId) {
    if (!this.peer || this.id === friendId) return;
    if (this.connections[friendId]?.open) {
      this.sendHandshake(this.connections[friendId]);
      return;
    }
    const conn = this.peer.connect(friendId, { reliable: true });
    this.setupConnection(conn);
  }

  async sendHandshake(conn) {
    if (!this.myKeys || !conn || !conn.open) return;
    try {
      const pubKey = await CryptoService.exportPublicKey(this.myKeys.publicKey);
      conn.send({ type: 'handshake', publicKey: pubKey });
    } catch (e) { console.error("Handshake fail", e); }
  }

  setupConnection(conn) {
    if (!conn || !conn.peer) return;
    this.connections[conn.peer] = conn;

    conn.on('open', () => {
      const retry = setInterval(() => {
        if (this.friendPublicKeys[conn.peer] || !this.connections[conn.peer]?.open) {
          clearInterval(retry);
        } else {
          this.sendHandshake(conn);
        }
      }, APP_CONFIG.HANDSHAKE_RETRY_INTERVAL);
      this.sendHandshake(conn);
    });

    conn.on('data', async (data) => {
      if (data.type === 'handshake') {
        this.friendPublicKeys[conn.peer] = await CryptoService.importPublicKey(data.publicKey);
        if (this.onKeyExchange) this.onKeyExchange(conn.peer);
        this.sendHandshake(conn);
      }
      
      if (data.type === 'message') {
        try {
          const decrypted = await CryptoService.decryptMessage(data.encryptedMessage, this.myKeys.privateKey);
          this.handlers.forEach(h => h({ id: data.msgId, text: decrypted, sender: conn.peer }));
        } catch (e) { console.error("Decryption error", e); }
      }

      if (data.type === 'message_status' || data.type === 'call_event') {
        this.statusHandlers.forEach(h => h(data));
      }
    });

    conn.on('close', () => {
      delete this.connections[conn.peer];
      delete this.friendPublicKeys[conn.peer];
      if (this.onKeyExchange) this.onKeyExchange(conn.peer);
    });
  }
  
  async sendMessage(friendId, text) {
    const conn = this.connections[friendId];
    
    // Проверка 1: Есть ли соединение
    if (!conn || !conn.open) {
      console.warn("Соединение не открыто");
      this.connectToFriend(friendId);
      return false;
    }

    // Проверка 2: Обменялись ли ключами
    const publicKey = this.friendPublicKeys[friendId];
    if (!publicKey) {
      console.warn("Ключ шифрования еще не получен");
      this.sendHandshake(conn); // Пробуем пнуть обмен ключами
      return false;
    }

    const msgId = Date.now().toString();
    
    try {
      // Шифруем текст
      const encrypted = await CryptoService.encryptMessage(text, publicKey);
      
      // Отправляем пакет данных
      conn.send({
        type: 'message',
        encryptedMessage: encrypted,
        msgId: msgId
      });

      return {
        id: msgId,
        text: text,
        sender: 'me',
        status: 'sent',
        timestamp: Date.now()
      };
    } catch (e) {
      console.error("Ошибка при шифровании/отправке:", e);
      return false;
    }
  }
}

export default new PeerService();