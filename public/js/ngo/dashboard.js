document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('campaignForm');
  const statusEl = document.getElementById('campaignStatus');
  const reloadBtn = document.getElementById('reloadCampaigns');
  const tbody = document.getElementById('campaignsTableBody');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (statusEl) statusEl.innerHTML = '<span class="text-gray-600">Submitting...</span>';
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      try {
        const res = await fetch('/ngo/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create campaign');
        statusEl.innerHTML = '<span class="text-green-700">Campaign submitted for approval.</span>';
        form.reset();
        await loadCampaigns();
      } catch (e) {
        statusEl.innerHTML = `<span class="text-red-700">${e.message}</span>`;
      }
    });
  }

  if (reloadBtn) reloadBtn.addEventListener('click', loadCampaigns);

  async function loadCampaigns() {
    try {
      const res = await fetch('/ngo/campaigns');
      const resp = await res.json();
      const list = resp.data || [];
      if (!list.length) {
        tbody.innerHTML = '<tr><td class="p-2 text-center" colspan="3">No campaigns yet</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(c => `
        <tr class="border-b">
          <td class="p-2">${escapeHtml(c.title)}</td>
          <td class="p-2"><span class="px-2 py-0.5 rounded text-white ${c.status==='approved' ? 'bg-green-600' : (c.status==='rejected' ? 'bg-red-600' : 'bg-yellow-600')}">${c.status}</span></td>
          <td class="p-2">${new Date(c.createdAt).toLocaleDateString()}</td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td class="p-2 text-center text-red-600" colspan="3">Failed to load campaigns</td></tr>';
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return s.toString().replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
