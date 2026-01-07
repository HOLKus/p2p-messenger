export const APP_CONFIG = {
    // Список бесплатных STUN-серверов от Google и Mozilla
    PEER_OPTIONS: {
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun.services.mozilla.com' }
            ],
            // Это заставляет соединение держаться дольше
            iceCandidatePoolSize: 10
        }
    },
    CONNECTION_CHECK_INTERVAL: 5000,
    AUTO_SCROLL_SMOOTH: true,
    DEDUPLICATION_ENABLED: true
};