import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

class CryptoService {
  generateKeys() {
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.secretKey
    };
  }

  exportKey(key) {
    return encodeBase64(key);
  }

  importKey(keyStr) {
    return decodeBase64(keyStr);
  }

  encryptMessage(text, theirPublicKey, myPrivateKey) {
    try {
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const messageUint8 = decodeUTF8(text);
      const encrypted = nacl.box(messageUint8, nonce, theirPublicKey, myPrivateKey);
      const full = new Uint8Array(nonce.length + encrypted.length);
      full.set(nonce);
      full.set(encrypted, nonce.length);
      return encodeBase64(full);
    } catch (e) {
      console.error("Encryption error:", e);
      return null;
    }
  }

  decryptMessage(messageBase64, theirPublicKey, myPrivateKey) {
    try {
      const data = decodeBase64(messageBase64);
      const nonce = data.slice(0, nacl.box.nonceLength);
      const message = data.slice(nacl.box.nonceLength);
      const decrypted = nacl.box.open(message, nonce, theirPublicKey, myPrivateKey);
      return decrypted ? encodeUTF8(decrypted) : "[Ошибка расшифровки]";
    } catch (e) {
      return "[Ошибка данных]";
    }
  }
}

export default new CryptoService();