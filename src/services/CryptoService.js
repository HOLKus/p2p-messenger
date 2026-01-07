import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

class CryptoService {
  // Генерация новой пары ключей
  generateKeys() {
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.secretKey
    };
  }

  // Преобразование ключа в строку для передачи через PeerJS
  exportKey(key) {
    return encodeBase64(key);
  }

  // Восстановление ключа из строки
  importKey(keyStr) {
    return decodeBase64(keyStr);
  }

  // Шифрование сообщения
  encryptMessage(text, theirPublicKey, myPrivateKey) {
    try {
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const messageUint8 = decodeUTF8(text);
      const encrypted = nacl.box(
        messageUint8,
        nonce,
        theirPublicKey,
        myPrivateKey
      );

      // Пакет: nonce + зашифрованное сообщение
      const fullMessage = new Uint8Array(nonce.length + encrypted.length);
      fullMessage.set(nonce);
      fullMessage.set(encrypted, nonce.length);

      return encodeBase64(fullMessage);
    } catch (e) {
      console.error("Encryption error:", e);
      return null;
    }
  }

  // Расшифровка сообщения
  decryptMessage(messageWithNonceBase64, theirPublicKey, myPrivateKey) {
    try {
      const messageWithNonceAsUint8Array = decodeBase64(messageWithNonceBase64);
      const nonce = messageWithNonceAsUint8Array.slice(0, nacl.box.nonceLength);
      const message = messageWithNonceAsUint8Array.slice(nacl.box.nonceLength);

      const decrypted = nacl.box.open(
        message,
        nonce,
        theirPublicKey,
        myPrivateKey
      );

      if (!decrypted) {
        throw new Error("Could not decrypt message");
      }

      return encodeUTF8(decrypted);
    } catch (e) {
      console.error("Decryption error:", e);
      return "[Ошибка расшифровки]";
    }
  }
}

export default new CryptoService();