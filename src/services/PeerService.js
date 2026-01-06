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
    if (!this.peer || this.id === friendId || this.connections[friendId]?.open) return;
    const conn = this.peer.connect(friendId, { reliable: true });
    this.setupConnection(conn);
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