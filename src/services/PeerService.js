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
          console.log("PeerJS подключен, ID:", id);
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
    if (this.connections[friendId]?.open) return;

    try {
      const conn = this.peer.connect(friendId, { reliable: true });
      if (conn) this.setupConnection(conn);
    } catch (e) {
      console.error("Connect error:", e);
    }
  }

  async sendHandshake(conn) {
    if (!this.myKeys || !conn || !conn.open) return;
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
      console.log("Соединение открыто с:", friendId);
      this.sendHandshake(conn);
    });

    conn.on('data', async (data) => {
      if (data.type === 'handshake') {
        this.friendPublicKeys[friendId] = await CryptoService.importPublicKey(data.publicKey);
        if (this.onKeyExchange) this.onKeyExchange(friendId);
        if (data.reply !== false) {
           const pubKey = await CryptoService.exportPublicKey(this.myKeys.publicKey);
           conn.send({ type: 'handshake', publicKey: pubKey, reply: false });
        }
      }
      
      if (data.type === 'message') {
        try {
          const decrypted = await CryptoService.decryptMessage(data.encryptedMessage, this.myKeys.privateKey);
          this.handlers.forEach(h => h({ id: data.msgId, text: decrypted, sender: friendId }));
        } catch (e) { console.error("Decryption error", e); }
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
    const pubKey = this.friendPublicKeys[friendId];
    if (!conn?.open || !pubKey) return false;

    const msgId = Date.now().toString();
    try {
      const encrypted = await CryptoService.encryptMessage(text, pubKey);
      conn.send({ type: 'message', encryptedMessage: encrypted, msgId });
      return { id: msgId, text, sender: 'me', status: 'sent' };
    } catch (e) { return false; }
  }
}

export default new PeerService();