
const socket = io();

socket.on('urgent_alert', (data) => {
  const banner = document.getElementById('urgent-banner');
  if (banner) {
    banner.innerText = `🚨 Urgent: ${data.message} @ ${data.location}`;
    banner.classList.remove('hidden');
    
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 10000);
  }
});