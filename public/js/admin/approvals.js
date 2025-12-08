const state = {
  ngo: {
    search: '',
    status: '',
    sort: 'newest',
    page: 1,
    limit: 12,
    total: 0,
    data: []
  },
  campaign: {
    search: '',
    status: '',
    sort: 'newest',
    page: 1,
    limit: 12,
    total: 0,
    data: []
  }
};

const elements = {
  stats: {
    ngoTotal: document.getElementById('ngoTotal'),
    ngoPending: document.getElementById('ngoPending'),
    ngoApproved: document.getElementById('ngoApproved'),
    ngoRejected: document.getElementById('ngoRejected'),
    campaignTotal: document.getElementById('campaignTotal'),
    campaignPending: document.getElementById('campaignPending'),
    campaignApproved: document.getElementById('campaignApproved'),
    campaignRejected: document.getElementById('campaignRejected')
  },
  ngo: {
    search: document.getElementById('ngoSearch'),
    status: document.getElementById('ngoStatusFilter'),
    sort: document.getElementById('ngoSort'),
    results: document.getElementById('ngoResults')
  },
  campaign: {
    search: document.getElementById('campaignSearch'),
    status: document.getElementById('campaignStatusFilter'),
    sort: document.getElementById('campaignSort'),
    results: document.getElementById('campaignResults')
  },
  refreshBtn: document.getElementById('refreshApprovals'),
  alertHost: document.getElementById('approvalAlertHost'),
  ngoDetailModal: document.getElementById('ngoDetailModal'),
  ngoDetailContent: document.getElementById('ngoDetailContent'),
  ngoDetailApprove: document.getElementById('ngoDetailApprove'),
  ngoDetailReject: document.getElementById('ngoDetailReject'),
  campaignDetailModal: document.getElementById('campaignDetailModal'),
  campaignDetailContent: document.getElementById('campaignDetailContent'),
  campaignDetailApprove: document.getElementById('campaignDetailApprove'),
  campaignDetailReject: document.getElementById('campaignDetailReject'),
  confirmModal: document.getElementById('approvalsConfirmModal'),
  confirmTitle: document.getElementById('approvalsConfirmTitle'),
  confirmMessage: document.getElementById('approvalsConfirmMessage'),
  confirmBtn: document.getElementById('approvalsConfirmBtn')
};

const modals = {
  ngoDetail: new bootstrap.Modal(elements.ngoDetailModal),
  campaignDetail: new bootstrap.Modal(elements.campaignDetailModal),
  confirm: new bootstrap.Modal(elements.confirmModal)
};

let activeNgoId = null;
let activeCampaignId = null;
let confirmHandler = null;

document.addEventListener('DOMContentLoaded', () => {
  attachEventListeners();
  refreshAll();
});

function attachEventListeners() {
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', refreshAll);
  }

  if (elements.ngo.search) {
    const debounced = debounce(() => {
      state.ngo.search = elements.ngo.search.value.trim();
      loadNgoList();
    }, 350);
    elements.ngo.search.addEventListener('input', debounced);
  }

  if (elements.ngo.status) {
    elements.ngo.status.addEventListener('change', () => {
      state.ngo.status = elements.ngo.status.value;
      loadNgoList();
    });
  }

  if (elements.ngo.sort) {
    elements.ngo.sort.addEventListener('change', () => {
      state.ngo.sort = elements.ngo.sort.value;
      loadNgoList();
    });
  }

  if (elements.campaign.search) {
    const debounced = debounce(() => {
      state.campaign.search = elements.campaign.search.value.trim();
      loadCampaignList();
    }, 350);
    elements.campaign.search.addEventListener('input', debounced);
  }

  if (elements.campaign.status) {
    elements.campaign.status.addEventListener('change', () => {
      state.campaign.status = elements.campaign.status.value;
      loadCampaignList();
    });
  }

  if (elements.campaign.sort) {
    elements.campaign.sort.addEventListener('change', () => {
      state.campaign.sort = elements.campaign.sort.value;
      loadCampaignList();
    });
  }

  if (elements.ngo.results) {
    elements.ngo.results.addEventListener('click', handleNgoAction);
  }

  if (elements.campaign.results) {
    elements.campaign.results.addEventListener('click', handleCampaignAction);
  }

  if (elements.confirmBtn) {
    elements.confirmBtn.addEventListener('click', () => {
      if (typeof confirmHandler === 'function') {
        const handler = confirmHandler;
        confirmHandler = null;
        handler();
      }
      modals.confirm.hide();
    });
  }

  if (elements.ngoDetailApprove) {
    elements.ngoDetailApprove.addEventListener('click', () => {
      if (activeNgoId) approveNgo(activeNgoId);
    });
  }

  if (elements.ngoDetailReject) {
    elements.ngoDetailReject.addEventListener('click', () => {
      if (activeNgoId) rejectNgo(activeNgoId);
    });
  }

  if (elements.campaignDetailApprove) {
    elements.campaignDetailApprove.addEventListener('click', () => {
      if (activeCampaignId) approveCampaign(activeCampaignId);
    });
  }

  if (elements.campaignDetailReject) {
    elements.campaignDetailReject.addEventListener('click', () => {
      if (activeCampaignId) rejectCampaign(activeCampaignId);
    });
  }
}

function refreshAll() {
  Promise.all([
    loadNgoStats(),
    loadCampaignStats(),
    loadNgoList(),
    loadCampaignList()
  ]);
}

async function loadNgoStats() {
  try {
    const response = await fetch('/admin/api/ngos/stats');
    if (!response.ok) throw new Error('Unable to load NGO statistics');
    const stats = await response.json();
    renderNgoStats(stats);
  } catch (error) {
    console.error('NGO stats error', error);
    showAlert('Failed to load NGO statistics.', 'danger');
  }
}

async function loadCampaignStats() {
  try {
    const response = await fetch('/admin/api/campaigns/stats');
    if (!response.ok) throw new Error('Unable to load campaign statistics');
    const stats = await response.json();
    renderCampaignStats(stats);
  } catch (error) {
    console.error('Campaign stats error', error);
    showAlert('Failed to load campaign statistics.', 'danger');
  }
}

function renderNgoStats(stats = {}) {
  elements.stats.ngoTotal.textContent = numberFormat(stats.total);
  elements.stats.ngoPending.textContent = numberFormat(stats.pending);
  elements.stats.ngoApproved.textContent = numberFormat(stats.approved);
  elements.stats.ngoRejected.textContent = numberFormat(stats.rejected);
}

function renderCampaignStats(stats = {}) {
  elements.stats.campaignTotal.textContent = numberFormat(stats.total);
  elements.stats.campaignPending.textContent = numberFormat(stats.pending);
  elements.stats.campaignApproved.textContent = numberFormat(stats.approved);
  elements.stats.campaignRejected.textContent = numberFormat(stats.rejected);
}

async function loadNgoList() {
  setLoadingState(elements.ngo.results);
  try {
    const params = new URLSearchParams({
      page: state.ngo.page,
      limit: state.ngo.limit,
      search: state.ngo.search,
      status: state.ngo.status,
      sort: state.ngo.sort
    });
    const response = await fetch(`/admin/api/ngos?${params.toString()}`);
    if (!response.ok) throw new Error('Unable to load NGOs');
    const payload = await response.json();
    state.ngo.total = payload.total;
    state.ngo.data = payload.data || [];
    renderNgoCards();
  } catch (error) {
    console.error('NGO list error', error);
    elements.ngo.results.innerHTML = createErrorState('Unable to load NGOs.');
  }
}

async function loadCampaignList() {
  setLoadingState(elements.campaign.results);
  try {
    const params = new URLSearchParams({
      page: state.campaign.page,
      limit: state.campaign.limit,
      search: state.campaign.search,
      status: state.campaign.status,
      sort: state.campaign.sort
    });
    const response = await fetch(`/admin/api/campaigns?${params.toString()}`);
    if (!response.ok) throw new Error('Unable to load campaigns');
    const payload = await response.json();
    state.campaign.total = payload.total;
    state.campaign.data = payload.data || [];
    renderCampaignCards();
  } catch (error) {
    console.error('Campaign list error', error);
    elements.campaign.results.innerHTML = createErrorState('Unable to load campaigns.');
  }
}

function renderNgoCards() {
  if (!state.ngo.data.length) {
    elements.ngo.results.innerHTML = createEmptyState('No NGOs match the current filters.');
    return;
  }
  const cards = state.ngo.data.map(createNgoCard).join('');
  elements.ngo.results.innerHTML = cards;
}

function renderCampaignCards() {
  if (!state.campaign.data.length) {
    elements.campaign.results.innerHTML = createEmptyState('No campaigns match the current filters.');
    return;
  }
  const cards = state.campaign.data.map(createCampaignCard).join('');
  elements.campaign.results.innerHTML = cards;
}

function createNgoCard(ngo) {
  const statusBadge = getStatusBadge(ngo.approvalStatus || (ngo.approved ? 'approved' : 'pending'));
  const registered = formatDate(ngo.createdAt);
  const registrationNumber = ngo.ngoProfile?.registrationNumber || 'N/A';
  const focusAreas = ngo.ngoProfile?.focusAreas?.length
    ? ngo.ngoProfile.focusAreas.map((area) => `<span class="badge bg-light text-dark me-1">${escapeHtml(area)}</span>`).join('')
    : '<span class="text-muted">No focus areas listed</span>';

  return `
    <article class="approval-card" data-ngo-id="${ngo._id}">
      <div class="approval-card__header">
        <div>
          <h3>${escapeHtml(ngo.name)}</h3>
          <div class="text-muted small">Registered ${registered}</div>
          <div class="text-muted small">Email: <a href="mailto:${escapeHtml(ngo.email)}">${escapeHtml(ngo.email)}</a></div>
        </div>
        ${statusBadge}
      </div>
      <div class="approval-card__body">
        <p class="mb-1"><strong>Registration #:</strong> ${escapeHtml(registrationNumber)}</p>
        <p class="mb-0"><strong>Focus areas:</strong> ${focusAreas}</p>
      </div>
      <div class="approval-card__actions">
        <button class="btn btn-sm btn-outline-secondary" data-action="view-ngo" data-id="${ngo._id}">
          <i class="bi bi-eye"></i> View
        </button>
        <button class="btn btn-sm btn-success" data-action="approve-ngo" data-id="${ngo._id}">
          <i class="bi bi-check-circle"></i> Approve
        </button>
        <button class="btn btn-sm btn-warning" data-action="reject-ngo" data-id="${ngo._id}">
          <i class="bi bi-x-circle"></i> Reject
        </button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete-ngo" data-id="${ngo._id}">
          <i class="bi bi-trash"></i> Delete
        </button>
      </div>
    </article>
  `;
}

function createCampaignCard(campaign) {
  const statusBadge = getStatusBadge(campaign.status);
  const createdDate = formatDate(campaign.createdAt);
  const ngoName = campaign.createdBy?.name || 'Unknown NGO';
  const targetAmount = campaign.targetAmount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(campaign.targetAmount) : 'Not specified';

  return `
    <article class="approval-card" data-campaign-id="${campaign._id}">
      <div class="approval-card__header">
        <div>
          <h3>${escapeHtml(campaign.title)}</h3>
          <div class="text-muted small">Created ${createdDate}</div>
          <div class="text-muted small">Submitted by ${escapeHtml(ngoName)}</div>
        </div>
        ${statusBadge}
      </div>
      <div class="approval-card__body">
        <p class="mb-1"><strong>Target amount:</strong> ${targetAmount}</p>
        <p class="text-muted small mb-0">${escapeHtml(truncateText(campaign.description, 160))}</p>
      </div>
      <div class="approval-card__actions">
        <button class="btn btn-sm btn-outline-secondary" data-action="view-campaign" data-id="${campaign._id}">
          <i class="bi bi-eye"></i> View
        </button>
        <button class="btn btn-sm btn-success" data-action="approve-campaign" data-id="${campaign._id}">
          <i class="bi bi-check-circle"></i> Approve
        </button>
        <button class="btn btn-sm btn-warning" data-action="reject-campaign" data-id="${campaign._id}">
          <i class="bi bi-x-circle"></i> Reject
        </button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete-campaign" data-id="${campaign._id}">
          <i class="bi bi-trash"></i> Delete
        </button>
      </div>
    </article>
  `;
}

function handleNgoAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (!action || !id) return;
  activeNgoId = id;
  switch (action) {
    case 'view-ngo':
      openNgoDetail(id);
      break;
    case 'approve-ngo':
      approveNgo(id);
      break;
    case 'reject-ngo':
      rejectNgo(id);
      break;
    case 'delete-ngo':
      confirmAction({
        title: 'Delete NGO',
        message: 'This will remove the NGO and associated campaigns. Continue?',
        variant: 'danger',
        handler: () => deleteNgo(id)
      });
      break;
    default:
      break;
  }
}

function handleCampaignAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (!action || !id) return;
  activeCampaignId = id;
  switch (action) {
    case 'view-campaign':
      openCampaignDetail(id);
      break;
    case 'approve-campaign':
      approveCampaign(id);
      break;
    case 'reject-campaign':
      rejectCampaign(id);
      break;
    case 'delete-campaign':
      confirmAction({
        title: 'Delete Campaign',
        message: 'This campaign will be permanently removed.',
        variant: 'danger',
        handler: () => deleteCampaign(id)
      });
      break;
    default:
      break;
  }
}

async function openNgoDetail(id) {
  elements.ngoDetailContent.innerHTML = '<p class="text-muted mb-0">Loading NGO profile…</p>';
  modals.ngoDetail.show();
  try {
    const response = await fetch(`/admin/api/ngos/${id}`);
    if (!response.ok) throw new Error('Unable to load NGO');
    const payload = await response.json();
    populateNgoDetail(payload);
  } catch (error) {
    console.error('NGO detail error', error);
    elements.ngoDetailContent.innerHTML = createErrorState('Failed to load NGO profile.');
  }
}

function populateNgoDetail({ ngo, campaigns }) {
  if (!ngo) {
    elements.ngoDetailContent.innerHTML = createErrorState('NGO not found.');
    return;
  }

  const documents = ngo.ngoProfile?.documents || [];
  const campaignsList = Array.isArray(campaigns) && campaigns.length
    ? campaigns.map((campaign) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <strong>${escapeHtml(campaign.title)}</strong>
            <div class="text-muted small">${campaign.status} · Created ${formatDate(campaign.createdAt)}</div>
          </div>
          <span class="badge bg-primary-subtle text-primary-emphasis">${campaign.status.toUpperCase()}</span>
        </li>`).join('')
    : '<li class="list-group-item text-muted">No campaigns submitted.</li>';

  const documentList = documents.length
    ? documents.map((doc) => `
        <div class="document-item" data-document-id="${doc._id}">
          <div>
            <strong>${escapeHtml(doc.name || 'Document')}</strong>
            ${doc.url ? `<div><a href="${escapeAttr(doc.url)}" target="_blank" rel="noopener">View document</a></div>` : ''}
            <div class="text-muted small">Status: ${doc.status || 'pending'}</div>
          </div>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-success" data-action="verify-document" data-status="verified" data-id="${doc._id}">Verify</button>
            <button class="btn btn-outline-warning" data-action="verify-document" data-status="pending" data-id="${doc._id}">Pending</button>
            <button class="btn btn-outline-danger" data-action="verify-document" data-status="rejected" data-id="${doc._id}">Reject</button>
          </div>
        </div>`).join('')
    : '<p class="text-muted">No documents uploaded.</p>';

  elements.ngoDetailContent.innerHTML = `
    <section class="mb-4">
      <h4 class="mb-2">Organization</h4>
      <p class="mb-1"><strong>Name:</strong> ${escapeHtml(ngo.name)}</p>
      <p class="mb-1"><strong>Email:</strong> <a href="mailto:${escapeHtml(ngo.email)}">${escapeHtml(ngo.email)}</a></p>
      <p class="mb-1"><strong>Contact Person:</strong> ${escapeHtml(ngo.ngoProfile?.contactPerson || 'Not provided')}</p>
      <p class="mb-1"><strong>Phone:</strong> ${escapeHtml(ngo.ngoProfile?.contactPhone || 'Not provided')}</p>
      <p class="mb-0"><strong>Website:</strong> ${ngo.ngoProfile?.website ? `<a href="${escapeAttr(ngo.ngoProfile.website)}" target="_blank" rel="noopener">${escapeHtml(ngo.ngoProfile.website)}</a>` : 'Not provided'}</p>
    </section>
    <section class="mb-4">
      <h4 class="mb-2">Documentation</h4>
      <div class="document-list" id="ngoDocuments">${documentList}</div>
    </section>
    <section>
      <h4 class="mb-2">Campaigns (${campaigns?.length || 0})</h4>
      <ul class="list-group list-group-flush">${campaignsList}</ul>
    </section>
  `;

  const docsContainer = elements.ngoDetailContent.querySelector('#ngoDocuments');
  if (docsContainer) {
    docsContainer.addEventListener('click', handleDocumentStatusUpdate);
  }
}

function handleDocumentStatusUpdate(event) {
  const button = event.target.closest('button[data-action="verify-document"]');
  if (!button || !activeNgoId) return;
  const documentId = button.dataset.id;
  const status = button.dataset.status;
  if (!documentId || !status) return;
  updateDocumentStatus(activeNgoId, documentId, status);
}

async function updateDocumentStatus(ngoId, documentId, status) {
  try {
    const response = await fetch(`/admin/api/ngos/${ngoId}/documents/${documentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Unable to update document');
    }
    showAlert('Document status updated.', 'success');
    openNgoDetail(ngoId);
  } catch (error) {
    console.error('Document status error', error);
    showAlert(`Failed to update document status: ${error.message}`, 'danger');
  }
}

async function approveNgo(id) {
  try {
    const response = await fetch(`/admin/api/ngos/${id}/approve`, { method: 'PUT' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Unable to approve NGO');
    }
    showAlert('NGO approved successfully.', 'success');
    modals.ngoDetail.hide();
    refreshAll();
  } catch (error) {
    console.error('Approve NGO error', error);
    showAlert(`Failed to approve NGO: ${error.message}`, 'danger');
  }
}

async function rejectNgo(id) {
  const reason = window.prompt('Provide a reason for rejection (optional):') || '';
  try {
    const response = await fetch(`/admin/api/ngos/${id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Unable to reject NGO');
    }
    showAlert('NGO rejected.', 'warning');
    modals.ngoDetail.hide();
    refreshAll();
  } catch (error) {
    console.error('Reject NGO error', error);
    showAlert(`Failed to reject NGO: ${error.message}`, 'danger');
  }
}

async function deleteNgo(id) {
  try {
    const response = await fetch(`/admin/api/ngos/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Unable to delete NGO');
    }
    showAlert('NGO deleted.', 'success');
    modals.ngoDetail.hide();
    refreshAll();
  } catch (error) {
    console.error('Delete NGO error', error);
    showAlert(`Failed to delete NGO: ${error.message}`, 'danger');
  }
}

async function openCampaignDetail(id) {
  elements.campaignDetailContent.innerHTML = '<p class="text-muted mb-0">Loading campaign…</p>';
  modals.campaignDetail.show();
  try {
    const response = await fetch(`/admin/api/campaigns/${id}`);
    if (!response.ok) throw new Error('Unable to load campaign');
    const payload = await response.json();
    populateCampaignDetail(payload.campaign);
  } catch (error) {
    console.error('Campaign detail error', error);
    elements.campaignDetailContent.innerHTML = createErrorState('Failed to load campaign details.');
  }
}

function populateCampaignDetail(campaign) {
  if (!campaign) {
    elements.campaignDetailContent.innerHTML = createErrorState('Campaign not found.');
    return;
  }

  elements.campaignDetailContent.innerHTML = `
    <section class="mb-4">
      <h4>${escapeHtml(campaign.title)}</h4>
      <p class="text-muted">Status: ${campaign.status} · Created ${formatDate(campaign.createdAt)}</p>
      <p>${escapeHtml(campaign.description || 'No description provided.')}</p>
      <p><strong>Target amount:</strong> ${campaign.targetAmount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(campaign.targetAmount) : 'Not specified'}</p>
    </section>
    <section>
      <h5>NGO</h5>
      <p class="mb-1"><strong>Name:</strong> ${escapeHtml(campaign.createdBy?.name || 'Unknown')}</p>
      <p class="mb-0"><strong>Email:</strong> ${campaign.createdBy?.email ? `<a href="mailto:${escapeHtml(campaign.createdBy.email)}">${escapeHtml(campaign.createdBy.email)}</a>` : 'Not provided'}</p>
    </section>
  `;
}

async function approveCampaign(id) {
  try {
    const response = await fetch(`/admin/api/campaigns/${id}/approve`, { method: 'PUT' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Unable to approve campaign');
    }
    showAlert('Campaign approved.', 'success');
    modals.campaignDetail.hide();
    refreshAll();
  } catch (error) {
    console.error('Approve campaign error', error);
    showAlert(`Failed to approve campaign: ${error.message}`, 'danger');
  }
}

async function rejectCampaign(id) {
  try {
    const response = await fetch(`/admin/api/campaigns/${id}/reject`, { method: 'PUT' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Unable to reject campaign');
    }
    showAlert('Campaign rejected.', 'warning');
    modals.campaignDetail.hide();
    refreshAll();
  } catch (error) {
    console.error('Reject campaign error', error);
    showAlert(`Failed to reject campaign: ${error.message}`, 'danger');
  }
}

async function deleteCampaign(id) {
  try {
    const response = await fetch(`/admin/api/campaigns/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Unable to delete campaign');
    }
    showAlert('Campaign deleted.', 'success');
    modals.campaignDetail.hide();
    refreshAll();
  } catch (error) {
    console.error('Delete campaign error', error);
    showAlert(`Failed to delete campaign: ${error.message}`, 'danger');
  }
}

function confirmAction({ title, message, variant = 'primary', handler }) {
  if (elements.confirmTitle) elements.confirmTitle.textContent = title;
  if (elements.confirmMessage) elements.confirmMessage.textContent = message;
  if (elements.confirmBtn) {
    elements.confirmBtn.className = `btn btn-${variant}`;
  }
  confirmHandler = handler;
  modals.confirm.show();
}

function showAlert(message, variant = 'info', timeout = 4000) {
  if (!elements.alertHost) return;
  const alert = document.createElement('div');
  alert.className = `alert alert-${variant} alert-dismissible fade show`;
  alert.innerHTML = `
    <span>${message}</span>
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  elements.alertHost.appendChild(alert);
  if (timeout) {
    setTimeout(() => {
      const instance = bootstrap.Alert.getOrCreateInstance(alert);
      instance.close();
    }, timeout);
  }
}

function setLoadingState(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="approval-empty-state">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Loading…</p>
    </div>`;
}

function createEmptyState(message) {
  return `
    <div class="approval-empty-state">
      <i class="bi bi-inbox"></i>
      <p class="mt-2 text-muted">${message}</p>
    </div>`;
}

function createErrorState(message) {
  return `
    <div class="approval-empty-state">
      <i class="bi bi-exclamation-octagon text-danger"></i>
      <p class="mt-2 text-danger">${message}</p>
    </div>`;
}

function numberFormat(value) {
  if (typeof value !== 'number') value = Number(value) || 0;
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(dateInput) {
  if (!dateInput) return '—';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function truncateText(text = '', length = 120) {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}…`;
}

function getStatusBadge(status = '') {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'approved':
      return '<span class="badge bg-success-subtle text-success-emphasis">Approved</span>';
    case 'rejected':
      return '<span class="badge bg-secondary-subtle text-secondary-emphasis">Rejected</span>';
    default:
      return '<span class="badge bg-warning-subtle text-dark">Pending</span>';
  }
}

function escapeHtml(value) {
  if (value == null) return '';
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  if (value == null) return '';
  return value
    .toString()
    .replace(/"/g, '&quot;');
}

function debounce(fn, delay = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
