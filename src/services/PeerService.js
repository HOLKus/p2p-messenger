import Peer from 'peerjs';
import CryptoService from './CryptoService.js';

class PeerService {
  constructor() {
    this.peer = null;
    this.id = null;
    this.connections = {};
    this.friendPublicKeys = {};
    this.myKeys = null;
    this.handlers = new Set();
    this.onKeyExchange = null;
  }

  async init(existingId, initialFriends = []) {
    if (!this.myKeys) this.myKeys = CryptoService.generateKeys();
    
    // Если в браузере CORS/403, пробуем очистить ID
    const tid = existingId || localStorage.getItem('my_peer_id');

    return new Promise((resolve) => {
      const connect = (idToUse) => {
        if (this.peer) this.peer.destroy();
        
        // Используем стандартные настройки PeerJS для обхода блокировок
        this.peer = new Peer(idToUse || undefined);

        this.peer.on('open', (id) => {
          this.id = id;
          localStorage.setItem('my_peer_id', id);
          initialFriends.forEach(f => this.connectToFriend(f.id));
          resolve(id);
        });

        this.peer.on('connection', (conn) => this.setupConnection(conn));
        
        this.peer.on('error', (err) => {
          if (err.type === 'server-error' || err.type === 'unavailable-id') {
            console.warn("Ошибка сервера, пробуем сбросить ID...");
            localStorage.removeItem('my_peer_id');
            setTimeout(() => connect(null), 3000);
          }
        });
      };
      connect(tid);
    });
  }

  connectToFriend(friendId) {
    if (!this.peer || this.connections[friendId]) return;
    const conn = this.peer.connect(friendId);
    this.setupConnection(conn);
  }

  setupConnection(conn) {
    const friendId = conn.peer;
    this.connections[friendId] = conn;

    conn.on('open', () => {
      const myPub = CryptoService.exportKey(this.myKeys.publicKey);
      conn.send({ type: 'handshake', publicKey: myPub });
    });

    conn.on('data', (data) => {
      if (data.type === 'handshake') {
        this.friendPublicKeys[friendId] = CryptoService.importKey(data.publicKey);
        if (this.onKeyExchange) this.onKeyExchange(friendId);
        if (data.reply !== false) {
          const myPub = CryptoService.exportKey(this.myKeys.publicKey);
          conn.send({ type: 'handshake', publicKey: myPub, reply: false });
        }
      }

      if (data.type === 'message') {
        const decrypted = CryptoService.decryptMessage(
          data.encrypted, 
          this.friendPublicKeys[friendId], 
          this.myKeys.privateKey
        );
        this.handlers.forEach(h => h({ id: Date.now(), text: decrypted, sender: friendId }));
      }
    });

    conn.on('close', () => delete this.connections[friendId]);
  }

  async sendMessage(friendId, text) {
    const conn = this.connections[friendId];
    const pub = this.friendPublicKeys[friendId];
    if (!conn || !pub) return false;

    const encrypted = CryptoService.encryptMessage(text, pub, this.myKeys.privateKey);
    conn.send({ type: 'message', encrypted });
    return { id: Date.now(), text, sender: 'me' };
  }
}

export default new PeerService();