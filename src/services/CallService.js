class CallService {
  constructor() {
    this.localStream = null;
    this.currentCall = null;
    this.onStream = null; // Коллбэк для передачи удаленного потока в UI
    this.onClose = null;  // Коллбэк для завершения звонка
  }

  // Запуск микрофона
  async startLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return this.localStream;
    } catch (e) {
      console.error("Не удалось получить доступ к микрофону:", e);
      return null;
    }
  }

  // Инициировать звонок
  async makeCall(peer, friendId, remoteStreamHandler) {
    this.onStream = remoteStreamHandler;
    const stream = await this.startLocalStream();
    if (!stream) return;

    this.currentCall = peer.call(friendId, stream);
    this.setupCallEvents(this.currentCall);
  }

  // Ответить на звонок
  async answerCall(call, remoteStreamHandler) {
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
    call.on('stream', (remoteStream) => {
      if (this.onStream) this.onStream(remoteStream);
    });

    call.on('close', () => this.stopCall());
    call.on('error', () => this.stopCall());
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