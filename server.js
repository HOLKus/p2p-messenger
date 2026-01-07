const { PeerServer } = require('peer');

const port = process.env.PORT || 9000;

const peerServer = PeerServer({ 
    port: port, 
    path: '/myapp',
    proxied: true // Важно для работы на Render/Railway
});

console.log(`PeerJS сервер запущен на порту ${port}`);