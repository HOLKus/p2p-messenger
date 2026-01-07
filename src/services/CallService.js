class CallService {
  constructor() {
    this.localStream = null;
    this.currentCall = null;
    this.onStream = null;
    this.onClose = null;
  }

  async startLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return this.localStream;
    } catch (e) {
      console.error("Доступ к микрофону запрещен или отсутствует:", e);
      alert("Ошибка: Не удалось получить доступ к микрофону.");
      return null;
    }
  }

  async makeCall(peer, friendId, remoteStreamHandler) {
    if (!peer || !friendId) {
      console.error("Не удается совершить звонок: peer или friendId не определены");
      return;
    }

    this.onStream = remoteStreamHandler;
    const stream = await this.startLocalStream();
    if (!stream) return;

    try {
      this.currentCall = peer.call(friendId, stream);
      
      // ЗАЩИТА: проверяем, что объект звонка создан
      if (!this.currentCall) {
        console.error("PeerJS не смог создать объект звонка.");
        return;
      }

      this.setupCallEvents(this.currentCall);
    } catch (e) {
      console.error("Ошибка при вызове peer.call:", e);
    }
  }

  async answerCall(call, remoteStreamHandler) {
    if (!call) return;
    this.currentCall = call;
    this.onStream = remoteStreamHandler;
    const stream = await this.startLocalStream();
    
    if (stream) {
      call.answer(stream);
      this.setupCallEvents(call);
    } else {
      call.close();
    }
  }

  setupCallEvents(call) {
    // Еще одна проверка перед подпиской на события
    if (!call || typeof call.on !== 'function') {
      console.error("Передан некорректный объект вызова в setupCallEvents");
      return;
    }

    call.on('stream', (remoteStream) => {
      console.log("Получен удаленный аудио-поток");
      if (this.onStream) this.onStream(remoteStream);
    });

    const handleEnd = () => {
      console.log("Звонок завершен");
      this.stopCall();
    };

    call.on('close', handleEnd);
    call.on('error', (err) => {
      console.error("Ошибка во время звонка:", err);
      handleEnd();
    });
  }

  stopCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.currentCall) {
      this.currentCall.close();
      this.currentCall = null;
    }
    if (this.onClose) this.onClose();
  }
}

export default new CallService();