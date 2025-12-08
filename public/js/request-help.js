// Request help page functionality
document.addEventListener('DOMContentLoaded', function() {
  const helpForm = document.getElementById('helpForm');
  const statusTracker = document.getElementById('statusTracker');
  const trackIdInput = document.getElementById('trackIdInput');
  const trackBtn = document.getElementById('trackBtn');
  const trackError = document.getElementById('trackError');
  const pastRequestsEl = document.getElementById('pastRequests');
  
  if (helpForm) {
    helpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitButton = e.target.querySelector('button[type="submit"]');
      const statusDiv = document.getElementById('status');
      
      // Show loading state
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span style="margin-right: 0.5rem;">⏳</span>Submitting...';
      }
      
      try {
        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());

        // Remove non-JSON serializable fields and normalize optional values
        if (payload.photo) delete payload.photo;
        if (payload.quantity === '' || payload.quantity === undefined || payload.quantity === null) {
          delete payload.quantity; // backend defaults to 1
        }

        const response = await fetch('/api/requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        
        const resp = await response.json();
        
        if (response.ok) {
          if (statusDiv) {
            statusDiv.innerHTML = `
              <div class="alert alert-success">
                <div class="flex items-center">
                  <span style="font-size: 1.5rem; margin-right: 0.75rem;">✅</span>
                  <div>
                    <h3 class="font-semibold">Request Submitted Successfully!</h3>
                    <p style="font-size: 0.875rem; margin-top: 0.25rem;">Your request ID is: <strong>${(resp.data && (resp.data._id || resp.data.id)) || resp._id || resp.id || 'N/A'}</strong></p>
                    <p style="font-size: 0.875rem; margin-top: 0.25rem;">Our team will contact you shortly. Stay safe!</p>
                  </div>
                </div>
              </div>
            `;
          }
          // Store last ID locally and update tracker
          const createdObj = (resp && resp.data) || resp || {};
          const createdId = createdObj._id || createdObj.id;
          if (createdId) {
            if (trackIdInput) trackIdInput.value = createdId;
            localStorage.setItem('lastRequestId', createdId);
            // Keep a list of my submitted request IDs for persistence across restarts
            const existing = JSON.parse(localStorage.getItem('myRequestIds') || '[]');
            if (!existing.includes(createdId)) {
              existing.unshift(createdId);
              localStorage.setItem('myRequestIds', JSON.stringify(existing.slice(0, 20)));
            }
            // Cache full item payload too so we can render even if server doesn't have it later
            const cache = JSON.parse(localStorage.getItem('myRequests') || '[]');
            const enriched = { ...createdObj };
            if (!enriched._id && createdId) enriched._id = createdId;
            const deduped = [enriched, ...cache.filter(x => (x._id || x.id) !== createdId)];
            localStorage.setItem('myRequests', JSON.stringify(deduped.slice(0, 20)));
            await updateTracker(createdId);
          }
          
          // Reset form
          e.target.reset();
        } else {
          const messages = Array.isArray(resp && resp.errors)
            ? resp.errors.map(err => err.msg || err.message).join('\n')
            : ((resp && resp.message) || 'Failed to submit request');
          throw new Error(messages);
        }
      } catch (error) {
        if (statusDiv) {
          statusDiv.innerHTML = `
            <div class="alert alert-error">
              <div class="flex items-center">
                <span style="font-size: 1.5rem; margin-right: 0.75rem;">❌</span>
                <div>
                  <h3 class="font-semibold">Submission Failed</h3>
                  <p style="font-size: 0.875rem; margin-top: 0.25rem;">${error.message}</p>
                  <p style="font-size: 0.875rem; margin-top: 0.25rem;">Please try again or contact emergency services directly.</p>
                </div>
              </div>
            </div>
          `;
        }
      } finally {
        // Reset button
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = '<span style="margin-right: 0.5rem;">🚨</span>Submit Help Request';
        }
      }
    });
  }
  
  // Auto-detect location (if user allows)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // You could reverse geocode the coordinates to get an address
        // For now, we'll just show a message
        console.log('Location detected:', position.coords);
      },
      (error) => {
        console.log('Location access denied or failed:', error);
      }
    );
  }
  // Load user's past requests (requires authenticated session cookie)
  if (pastRequestsEl) {
    loadPastRequests();
  }

  async function loadPastRequests() {
    try {
      const res = await fetch('/api/requests');
      let items = [];
      if (res.ok) {
        const r = await res.json();
        items = Array.isArray(r) ? r : (r && r.data) || [];
      }
      // Fallback: if not logged in or no results, try localStorage IDs
      if (!Array.isArray(items) || items.length === 0) {
        // Try full cached items first
        const cached = JSON.parse(localStorage.getItem('myRequests') || '[]');
        if (cached.length > 0) {
          items = cached;
        }
      }
      if (!Array.isArray(items) || items.length === 0) {
        const ids = JSON.parse(localStorage.getItem('myRequestIds') || '[]');
        if (ids.length > 0) {
          const fetched = [];
          for (const id of ids) {
            try {
              const it = await fetchRequestById(id);
              if (it && it._id) fetched.push(it);
            } catch (_) {}
          }
          items = fetched;
        }
      }
      renderPastRequests(items);
    } catch (err) {
      // As a last resort, try cached full items then local IDs
      const cached = JSON.parse(localStorage.getItem('myRequests') || '[]');
      if (cached.length > 0) { renderPastRequests(cached); return; }
      const ids = JSON.parse(localStorage.getItem('myRequestIds') || '[]');
      if (ids.length > 0) {
        const fetched = [];
        for (const id of ids) {
          try {
            const it = await fetchRequestById(id);
            if (it && it._id) fetched.push(it);
          } catch (_) {}
        }
        renderPastRequests(fetched);
        return;
      }
      pastRequestsEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  }

  function renderPastRequests(items) {
    if (!Array.isArray(items) || items.length === 0) {
      pastRequestsEl.innerHTML = '<p class="text-center text-gray-600">No past requests found.</p>';
      return;
    }
    const html = items.map(item => {
      const id = item._id;
      const created = new Date(item.createdAt).toLocaleString();
      const status = item.status;
      const type = item.item;
      const qty = item.quantity;
      return `
        <div class="request-help-form-card">
          <div class="request-help-form-header" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div>
              <h3 class="request-help-form-title" style="margin:0;">${type} (x${qty})</h3>
              <p class="request-help-form-description" style="margin:4px 0 0 0;">ID: <code>${id}</code></p>
            </div>
            <div style="text-align:right;">
              <div class="badge">Status: ${status}</div>
              <div style="font-size:12px;color:#666;">${created}</div>
            </div>
          </div>
          <div class="text-right" style="margin-top:8px;">
            <button type="button" class="request-help-form-button" data-track-id="${id}">Track</button>
          </div>
        </div>
      `;
    }).join('');
    pastRequestsEl.innerHTML = html;
    pastRequestsEl.querySelectorAll('[data-track-id]').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const id = ev.currentTarget.getAttribute('data-track-id');
        if (trackIdInput) trackIdInput.value = id;
        localStorage.setItem('lastRequestId', id);
        await updateTracker(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }
  // Restore last tracked ID
  const lastId = localStorage.getItem('lastRequestId');
  if (lastId && trackIdInput) {
    trackIdInput.value = lastId;
    updateTracker(lastId);
  }

  // Manual tracking by ID
  if (trackBtn && trackIdInput) {
    trackBtn.addEventListener('click', async () => {
      if (trackError) trackError.textContent = '';
      const id = (trackIdInput.value || '').trim();
      if (!id) {
        if (trackError) trackError.textContent = 'Please enter a Request ID.';
        return;
      }
      try {
        await updateTracker(id);
        localStorage.setItem('lastRequestId', id);
      } catch (err) {
        if (trackError) trackError.textContent = err.message || 'Failed to fetch request status.';
      }
    });
  }

  async function fetchRequestById(id) {
    const res = await fetch(`/api/requests/${encodeURIComponent(id)}`);
    if (!res.ok) {
      let message = 'Request not found';
      try {
        const data = await res.json();
        message = data.message || message;
      } catch (_) {}
      throw new Error(message);
    }
    const out = await res.json();
    return (out && out.data) || out;
  }

  async function updateTracker(id) {
    const data = await fetchRequestById(id);
    const status = data.status || 'pending';
    highlightTrackerStep(status);
  }

  function highlightTrackerStep(currentStatus) {
    if (!statusTracker) return;
    const steps = statusTracker.querySelectorAll('.request-help-status-item');
    steps.forEach(step => {
      step.classList.remove('active');
      step.style.opacity = '0.5';
    });
    const currentEl = statusTracker.querySelector(`[data-step="${currentStatus}"]`);
    if (currentEl) {
      currentEl.classList.add('active');
      currentEl.style.opacity = '1';
    }
  }
});