import Peer from 'peerjs';
import CryptoService from './CryptoService.js';
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
      if (!this.myKeys) {
        console.log("[PeerService] Генерация ключей TweetNaCl...");
        this.myKeys = CryptoService.generateKeys();
      }
    } catch (e) {
      console.error("Crypto init error", e);
    }

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
    } catch (e) {
      console.error("Connect error:", e);
    }
  }

  sendHandshake(conn) {
    if (!this.myKeys || !conn || conn.readyState !== 'open') return;
    try {
      const pubKeyStr = CryptoService.exportKey(this.myKeys.publicKey);
      conn.send({ type: 'handshake', publicKey: pubKeyStr });
    } catch (e) {
      console.error("Handshake error", e);
    }
  }

  setupConnection(conn) {
    if (!conn || !conn.peer) return;
    const friendId = conn.peer;
    this.connections[friendId] = conn;

    conn.on('open', () => {
      console.log("Соединение открыто с:", friendId);
      this.sendHandshake(conn);
    });

    conn.on('data', async (data) => {
      // 1. Обработка обмена ключами
      if (data.type === 'handshake') {
        try {
          this.friendPublicKeys[friendId] = CryptoService.importKey(data.publicKey);
          if (this.onKeyExchange) this.onKeyExchange(friendId);
          if (data.reply !== false) {
            const pubKeyStr = CryptoService.exportKey(this.myKeys.publicKey);
            conn.send({ type: 'handshake', publicKey: pubKeyStr, reply: false });
          }
        } catch (e) {
          console.error("Handshake import error", e);
        }
      }

      // 2. Получение и расшифровка сообщения
      if (data.type === 'message') {
        try {
          const theirPubKey = this.friendPublicKeys[friendId];
          if (theirPubKey) {
            const decrypted = CryptoService.decryptMessage(
              data.encryptedMessage,
              theirPubKey,
              this.myKeys.privateKey
            );
            this.handlers.forEach(h => h({ id: data.msgId, text: decrypted, sender: friendId }));
            conn.send({ type: 'message_status', msgId: data.msgId, status: 'delivered' });
          }
        } catch (e) {
          console.error("Decryption error", e);
        }
      }

      // 3. Статусы доставки
      if (data.type === 'message_status') {
        this.statusHandlers.forEach(h => h(data));
      }
    });

    conn.on('close', () => {
      delete this.connections[friendId];
      delete this.friendPublicKeys[friendId];
      if (this.onKeyExchange) this.onKeyExchange(friendId);
    });
  }

  async sendMessage(friendId, text) {
    const conn = this.connections[friendId];
    const theirPubKey = this.friendPublicKeys[friendId];

    if (!conn || conn.readyState !== 'open' || !theirPubKey) {
      this.connectToFriend(friendId);
      return false;
    }

    const msgId = Date.now().toString();
    try {
      const encrypted = CryptoService.encryptMessage(
        text,
        theirPubKey,
        this.myKeys.privateKey
      );
      conn.send({ type: 'message', encryptedMessage: encrypted, msgId });
      return { id: msgId, text, sender: 'me', status: 'sent' };
    } catch (e) {
      console.error("Send error", e);
      return false;
    }
  }
}

export default new PeerService();