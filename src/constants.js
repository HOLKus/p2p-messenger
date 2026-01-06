export const getStatusText = (status) => {
  const map = { 'sending': 'Отправляю...', 'sent': 'Отправлено', 'delivered': 'Доставлено', 'read': 'Прочитано', 'error': 'Ошибка' };
  return map[status] || status;
};

export const formatId = (id) => {
  if (!id || id.length < 10) return id;
  return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`;
};

export const showToast = (message) => {
  const t = document.createElement('div');
  t.textContent = message;
  t.style.cssText = `position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:8px 16px;border-radius:20px;z-index:9999;font-size:14px;`;
  document.body.appendChild(t);
  setTimeout(() => { t.remove(); }, 2000);
};

export const copyToClipboard = (fullId) => {
  navigator.clipboard.writeText(fullId);
  showToast("Полный ID скопирован");
};