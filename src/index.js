import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

// Находим элемент в HTML
const rootElement = document.getElementById('root');

// Создаем корень React
const root = ReactDOM.createRoot(rootElement);

// Отрисовываем приложение
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);