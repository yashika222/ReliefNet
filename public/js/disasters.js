(function () {
  const listEl = document.getElementById('disaster-list');
  const emptyActionsEl = document.getElementById('empty-actions');
  const lastUpdatedEl = document.getElementById('last-updated');
  const demoStatusEl = document.getElementById('demo-status');
  let lastCount = 0;

  async function fetchData() {
    try {
      const res = await fetch('/disasters/data', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return console.warn('Failed to fetch data');
      const json = await res.json();

      const items = Array.isArray(json.data) ? json.data : [];
      render(items);

      if (json.lastUpdatedAt && lastUpdatedEl) {
        const ts = new Date(json.lastUpdatedAt).toLocaleString();
        lastUpdatedEl.textContent = `Last updated at ${ts}`;
      }
    } catch (e) {
      console.error('Error fetching disasters:', e);
    }
  }

  function render(items) {
    if (!listEl) return;

    if (!items.length) {
      listEl.innerHTML = '';
      if (emptyActionsEl) {
        emptyActionsEl.innerHTML = '<div>No active disasters found. <form action="/disasters/demo-seed" method="post" style="display:inline-block; margin-left:8px;"><button type="submit" class="btn btn-secondary">Seed Demo Data</button></form></div>';
      }
      return;
    }

    if (emptyActionsEl) emptyActionsEl.innerHTML = '';

    if (lastCount && items.length > lastCount) {
      const newCount = items.length - lastCount;
      const msg = `${newCount} new disaster${newCount > 1 ? 's' : ''} added!`;
      showNotification(msg);
    }
    lastCount = items.length;

    const html = items.map((d) => {
      const dateStr = d.date ? new Date(d.date).toLocaleDateString() : '';
      const donateHref = `/donate?disasterId=${encodeURIComponent(d.disasterId || d._id)}`;
      const detailHref = `/disasters/${encodeURIComponent(d.disasterId || d._id)}`;
      return `
        <div class="card" style="border:1px solid #ddd; border-radius:8px; padding:16px; background:#fff; margin-bottom:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <h3 style="margin:0; font-size:18px;">${escapeHtml(d.title || 'Unnamed Disaster')}</h3>
            <span style="font-size:12px; padding:4px 8px; border-radius:12px; background:#f2f2f2;">
              ${escapeHtml(d.type || 'Unknown')}
            </span>
          </div>
          <div style="color:#555; font-size:14px; margin-bottom:8px;">
            <div><strong>Location:</strong> ${escapeHtml(d.location || 'Unknown')}</div>
            <div><strong>Date:</strong> ${escapeHtml(dateStr)}</div>
            <div><strong>Severity:</strong> ${escapeHtml(d.severity || 'Unknown')}</div>
          </div>
          <div style="margin-top:12px; display:flex; gap:8px;">
            <a class="btn btn-primary" href="${donateHref}">Donate</a>
            <a class="btn btn-secondary" href="${detailHref}">Details</a>
          </div>
        </div>`;
    }).join('');
    listEl.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showNotification(msg) {
    const note = document.createElement('div');
    note.textContent = msg;
    note.style.position = 'fixed';
    note.style.bottom = '20px';
    note.style.right = '20px';
    note.style.padding = '10px 16px';
    note.style.background = '#4CAF50';
    note.style.color = '#fff';
    note.style.borderRadius = '8px';
    note.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    note.style.zIndex = '9999';
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 4000);
  }

  async function refreshDemoStatus() {
    try {
      const res = await fetch('/disasters/demo-status', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      const json = await res.json();
      if (demoStatusEl) {
        demoStatusEl.textContent = json.active ? `Demo active (remaining: ${json.remaining})` : 'Demo inactive';
      }
    } catch {}
  }

  // initial + periodic refresh (faster for demo)
  fetchData();
  refreshDemoStatus();
  setInterval(fetchData, 10 * 1000);
  setInterval(refreshDemoStatus, 5 * 1000);
})();
