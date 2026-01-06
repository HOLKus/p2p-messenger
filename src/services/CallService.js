class CallService {
  constructor() {
    this.localStream = null;
    this.currentCall = null;
    this.onStream = null;
    this.onClose = null;
  }

  async startLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      return this.localStream;
    } catch (e) {
      console.error("Access denied to media devices:", e);
      throw e;
    }
  }

  handleIncomingCall(call, stream) {
    this.currentCall = call;
    call.answer(stream);
    this.setupCallHandlers(call);
  }

  setupCallHandlers(call) {
    call.on('stream', (remoteStream) => {
      if (this.onStream) this.onStream(remoteStream);
    });
    call.on('close', () => this.stopAll());
    call.on('error', () => this.stopAll());
  }

  stopAll() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.currentCall) this.currentCall.close();
    this.localStream = null;
    this.currentCall = null;
    if (this.onClose) this.onClose();
  }
}

export default new CallService();