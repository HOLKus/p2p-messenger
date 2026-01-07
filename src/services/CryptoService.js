import forge from 'node-forge';

// Генерация пары RSA-ключей (2048 бит)
export const generateKeys = async () => {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keypair) => {
      if (err) reject(err);
      resolve(keypair);
    });
  });
};

// Экспорт публичного ключа в строку (для передачи другу)
export const exportPublicKey = (publicKey) => {
  return forge.pki.publicKeyToPem(publicKey);
};

// Импорт публичного ключа из строки
export const importPublicKey = (pem) => {
  return forge.pki.publicKeyFromPem(pem);
};

// Шифрование сообщения (AES + RSA)
// Мы создаем случайный AES ключ для сообщения, шифруем его через RSA друга, 
// а само сообщение шифруем этим AES ключом.
export const encryptMessage = async (text, friendPublicKey) => {
  try {
    const aesKey = forge.random.getBytesSync(16);
    const iv = forge.random.getBytesSync(16);

    const cipher = forge.cipher.createCipher('AES-CBC', aesKey);
    cipher.start({ iv: iv });
    cipher.update(forge.util.createBuffer(text, 'utf8'));
    cipher.finish();
    const encryptedText = cipher.output.getBytes();

    // Шифруем AES-ключ публичным ключом друга
    const encryptedAesKey = friendPublicKey.encrypt(aesKey, 'RSA-OAEP');

    return JSON.stringify({
      k: forge.util.encode64(encryptedAesKey),
      iv: forge.util.encode64(iv),
      t: forge.util.encode64(encryptedText)
    });
  } catch (e) {
    console.error("Encryption failed:", e);
    return null;
  }
};

// Расшифровка сообщения
export const decryptMessage = async (jsonPackage, myPrivateKey) => {
  try {
    const data = JSON.parse(jsonPackage);
    
    // Декодируем AES ключ своим приватным RSA ключом
    const aesKey = myPrivateKey.decrypt(forge.util.decode64(data.k), 'RSA-OAEP');
    const iv = forge.util.decode64(data.iv);
    const encryptedText = forge.util.decode64(data.t);

    const decipher = forge.cipher.createDecipher('AES-CBC', aesKey);
    decipher.start({ iv: iv });
    decipher.update(forge.util.createBuffer(encryptedText));
    decipher.finish();

    return decipher.output.toString('utf8');
  } catch (e) {
    console.error("Decryption failed:", e);
    return "[Ошибка расшифровки]";
  }
};