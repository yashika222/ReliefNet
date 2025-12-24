(() => {
  if (window.__manageVolunteersLoaded) return;
  window.__manageVolunteersLoaded = true;

  document.addEventListener('DOMContentLoaded', () => waitForBootstrap(init));

  function waitForBootstrap(callback, retries = 20) {
    if (window.bootstrap) {
      callback();
      return;
    }
    if (retries <= 0) {
      console.error('Bootstrap not detected. manage-volunteers.js requires bootstrap.bundle.');
      return;
    }
    setTimeout(() => waitForBootstrap(callback, retries - 1), 150);
  }

  function init() {
    const state = {
      page: 1,
      limit: 10,
      search: '',
      status: '',
      sort: 'newest',
      blockedOnly: false,
      total: 0,
      totalPages: 0,
      volunteers: [],
      volunteerMap: new Map(),
      disastersLoaded: false,
      activeVolunteer: null
    };

    const elements = {
      summary: {
        total: document.getElementById('totalVolunteers'),
        active: document.getElementById('activeVolunteers'),
        pending: document.getElementById('pendingVolunteers'),
        rejected: document.getElementById('rejectedVolunteers'),
        blocked: document.getElementById('blockedVolunteers'),
        totalTasks: document.getElementById('totalTasks'),
        completedTasks: document.getElementById('completedTasks'),
        inProgressTasks: document.getElementById('inProgressTasks'),
        overdueTasks: document.getElementById('overdueTasks'),
        warnedTasks: document.getElementById('warnedTasks'),
        autoWarningMeta: document.getElementById('autoWarningMeta')
      },
      tableBody: document.getElementById('volunteersTableBody'),
      tableMeta: document.getElementById('tableMeta'),
      pagination: document.getElementById('pagination'),
      searchInput: document.getElementById('searchInput'),
      statusFilter: document.getElementById('statusFilter'),
      sortFilter: document.getElementById('sortFilter'),
      blockedToggle: document.getElementById('blockedToggle'),
      refreshBtn: document.getElementById('refreshBtn'),
      alertHost: document.getElementById('alertHost'),
      assignTaskForm: document.getElementById('assignTaskForm'),
      emailForm: document.getElementById('emailVolunteerForm'),
      taskDisasterSelect: document.getElementById('taskDisaster'),
      confirmActionTitle: document.getElementById('confirmActionTitle'),
      confirmActionMessage: document.getElementById('confirmActionMessage'),
      confirmActionBtn: document.getElementById('confirmActionBtn'),
      openFullTaskHistory: document.getElementById('openFullTaskHistory'),
      taskHistoryContent: document.getElementById('taskHistoryContent'),
      taskHistoryTitle: document.getElementById('taskHistoryTitle'),
      profileAssignTask: document.getElementById('profileAssignTask'),
      profileEmailVolunteer: document.getElementById('profileEmailVolunteer'),
      assignVolunteerName: document.getElementById('assignTaskVolunteerName'),
      assignVolunteerEmail: document.getElementById('assignTaskVolunteerEmail'),
      assignVolunteerIdInput: document.getElementById('volunteerId'),
      emailVolunteerId: document.getElementById('emailVolunteerId'),
      emailVolunteerTo: document.getElementById('emailVolunteerTo'),
      taskTitle: document.getElementById('taskTitle'),
      taskDescription: document.getElementById('taskDescription'),
      taskPriority: document.getElementById('taskPriority'),
      taskDeadline: document.getElementById('taskDeadline'),
      relatedRequest: document.getElementById('relatedRequest'),
      sendEmailOnAssign: document.getElementById('sendEmailOnAssign'),
      emailSubject: document.getElementById('emailSubject'),
      emailMessage: document.getElementById('emailMessage'),
      profile: {
        name: document.getElementById('profileName'),
        email: document.getElementById('profileEmail'),
        emailLink: document.getElementById('profileEmailLink'),
        approvalBadge: document.getElementById('profileApprovalBadge'),
        blockedBadge: document.getElementById('profileBlockedBadge'),
        location: document.getElementById('profileLocation'),
        phone: document.getElementById('profilePhone'),
        joined: document.getElementById('profileJoined'),
        lastAssignment: document.getElementById('profileLastAssignment'),
        skills: document.getElementById('profileSkills'),
        notes: document.getElementById('profileNotes'),
        tasksAssigned: document.getElementById('profileTasksAssigned'),
        tasksCompleted: document.getElementById('profileTasksCompleted'),
        tasksOverdue: document.getElementById('profileTasksOverdue'),
        tasksWarned: document.getElementById('profileTasksWarned'),
        activeTasks: document.getElementById('profileActiveTasks')
      }
    };

    const modals = {
      profile: safeModal('volunteerProfileModal'),
      assignTask: safeModal('assignTaskModal'),
      email: safeModal('emailVolunteerModal'),
      confirm: safeModal('confirmActionModal'),
      taskHistory: safeModal('taskHistoryModal')
    };

    let confirmHandler = null;

    attachEventListeners();
    refreshAll();
    loadDisasters();

    // Check for volunteer query parameter and open profile modal
    const urlParams = new URLSearchParams(window.location.search);
    const volunteerId = urlParams.get('volunteer');
    if (volunteerId) {
      // Wait a bit for page to load, then open profile modal
      setTimeout(() => {
        openProfileModal(volunteerId);
        // Clean up URL by removing the query parameter
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 500);
    }

    function safeModal(id) {
      const el = document.getElementById(id);
      return el ? new bootstrap.Modal(el) : null;
    }

    function attachEventListeners() {
      elements.refreshBtn?.addEventListener('click', refreshAll);

      if (elements.searchInput) {
        const debounced = debounce(() => {
          state.search = elements.searchInput.value.trim();
          loadVolunteers(1);
        }, 350);
        elements.searchInput.addEventListener('input', debounced);
      }

      elements.statusFilter?.addEventListener('change', () => {
        state.status = elements.statusFilter.value;
        loadVolunteers(1);
      });

      elements.sortFilter?.addEventListener('change', () => {
        state.sort = elements.sortFilter.value;
        loadVolunteers();
      });

      elements.blockedToggle?.addEventListener('change', () => {
        state.blockedOnly = Boolean(elements.blockedToggle.checked);
        loadVolunteers(1);
      });

      elements.pagination?.addEventListener('click', (event) => {
        const target = event.target.closest('a[data-page]');
        if (!target) return;
        event.preventDefault();
        const page = Number(target.dataset.page);
        if (page >= 1 && page <= state.totalPages) {
          loadVolunteers(page);
        }
      });

      elements.tableBody?.addEventListener('click', handleTableAction);

      elements.assignTaskForm?.addEventListener('submit', handleAssignTaskSubmit);
      elements.emailForm?.addEventListener('submit', handleEmailSubmit);

      elements.confirmActionBtn?.addEventListener('click', () => {
        if (typeof confirmHandler === 'function') {
          const handler = confirmHandler;
          confirmHandler = null;
          handler();
        }
        modals.confirm?.hide();
      });

      elements.openFullTaskHistory?.addEventListener('click', () => {
        if (!state.activeVolunteer) return;
        loadTaskHistory(state.activeVolunteer.id);
      });

      elements.profileAssignTask?.addEventListener('click', () => {
        if (!state.activeVolunteer) return;
        openAssignTaskModal(state.activeVolunteer);
      });

      elements.profileEmailVolunteer?.addEventListener('click', () => {
        if (!state.activeVolunteer) return;
        openEmailModal(state.activeVolunteer);
      });
    }

    function refreshAll() {
      loadSummary();
      loadVolunteers(1);
    }

    async function loadSummary() {
      try {
        const data = await request('/admin/api/volunteers/summary');
        renderSummary(data);
      } catch (error) {
        console.error('Summary load error', error);
        showAlert(`Failed to load volunteer summary: ${error.message}`, 'danger');
      }
    }

    function renderSummary(data = {}) {
      elements.summary.total.textContent = numberFormat(data.totalVolunteers);
      elements.summary.active.textContent = numberFormat(data.activeVolunteers);
      elements.summary.pending.textContent = numberFormat(data.pendingApprovals);
      elements.summary.rejected.textContent = numberFormat(data.rejectedVolunteers);
      elements.summary.blocked.textContent = numberFormat(data.blockedVolunteers);
      elements.summary.totalTasks.textContent = numberFormat(data.totalTasksAssigned);
      elements.summary.completedTasks.textContent = numberFormat(data.tasksCompleted);
      elements.summary.inProgressTasks.textContent = numberFormat(data.tasksInProgress);
      elements.summary.overdueTasks.textContent = numberFormat(data.tasksOverdue);
      elements.summary.warnedTasks.textContent = numberFormat(data.tasksWarned);

      if (data.autoWarningTriggered) {
        elements.summary.autoWarningMeta.textContent = `Auto warnings sent (${data.autoWarningCount})`;
        elements.summary.autoWarningMeta.classList.remove('text-muted');
        elements.summary.autoWarningMeta.classList.add('text-danger');
      } else {
        elements.summary.autoWarningMeta.textContent = 'Auto alerts idle';
        elements.summary.autoWarningMeta.classList.add('text-muted');
        elements.summary.autoWarningMeta.classList.remove('text-danger');
      }
    }

    async function loadVolunteers(page = state.page) {
      state.page = page;
      setTableLoading();
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(state.limit),
          search: state.search,
          status: state.status,
          sort: state.sort
        });
        if (state.blockedOnly) params.set('blocked', 'true');
        const data = await request(`/admin/api/volunteers?${params.toString()}`);
        state.total = data.total || 0;
        state.totalPages = data.totalPages || 1;
        state.volunteers = Array.isArray(data.data) ? data.data : [];
        state.volunteerMap.clear();
        state.volunteers.forEach((vol) => state.volunteerMap.set(vol._id, vol));
        renderVolunteerTable();
      } catch (error) {
        console.error('Volunteer list error', error);
        renderTableError(error.message);
        showAlert(`Failed to load volunteers: ${error.message}`, 'danger');
      }
    }

    function setTableLoading() {
      if (!elements.tableBody) return;
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4">
            <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            <span class="ms-2 text-muted">Loading volunteers...</span>
          </td>
        </tr>
      `;
    }

    function renderTableError(message) {
      if (!elements.tableBody) return;
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle me-2"></i>${escapeHtml(message)}
          </td>
        </tr>
      `;
      elements.pagination.innerHTML = '';
      elements.tableMeta.textContent = '';
    }

    function renderVolunteerTable() {
      if (!elements.tableBody) return;
      if (!state.volunteers.length) {
        elements.tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center text-muted py-4">
              <i class="bi bi-inbox me-2"></i>No volunteers match the current filters.
            </td>
          </tr>
        `;
        elements.pagination.innerHTML = '';
        elements.tableMeta.textContent = '';
        return;
      }

      const rows = state.volunteers.map(createVolunteerRow).join('');
      elements.tableBody.innerHTML = rows;
      renderTableMeta();
      renderPagination();
    }

    function renderTableMeta() {
      if (!elements.tableMeta) return;
      const start = (state.page - 1) * state.limit + 1;
      const end = Math.min(state.page * state.limit, state.total);
      elements.tableMeta.textContent = `Showing ${start}-${end} of ${state.total} volunteers`;
    }

    function renderPagination() {
      if (!elements.pagination) return;
      if (state.totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
      }
      const pages = [];
      const addPage = (page, label = page, disabled = false, active = false) => {
        pages.push(`
          <li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}">
            <a class="page-link" href="#" data-page="${page}">${label}</a>
          </li>
        `);
      };

      addPage(Math.max(1, state.page - 1), '&laquo;', state.page === 1);

      const windowSize = 5;
      let start = Math.max(1, state.page - Math.floor(windowSize / 2));
      let end = start + windowSize - 1;
      if (end > state.totalPages) {
        end = state.totalPages;
        start = Math.max(1, end - windowSize + 1);
      }
      for (let page = start; page <= end; page += 1) {
        addPage(page, page, false, page === state.page);
      }

      addPage(Math.min(state.totalPages, state.page + 1), '&raquo;', state.page === state.totalPages);
      elements.pagination.innerHTML = pages.join('');
    }

    function createVolunteerRow(vol) {
      const metrics = vol.metrics || {};
      const location = vol.volunteerProfile?.currentLocation || vol.address?.state || '—';
      const phone = vol.contact?.phone || '—';
      const statusBadges = getStatusBadges(vol);
      const lastActivity = formatRelative(vol.volunteerProfile?.lastAssignmentAt || vol.updatedAt);
      const overdue = metrics.tasksOverdue || 0;
      const warned = metrics.tasksWarned || 0;

      const actions = [];
      actions.push(`<button class="btn btn-sm btn-outline-secondary me-1" data-action="view-volunteer" data-id="${vol._id}"><i class="bi bi-eye"></i></button>`);

      if (vol.approvalStatus !== 'approved') {
        actions.push(`<button class="btn btn-sm btn-success me-1" data-action="approve-volunteer" data-id="${vol._id}">Approve</button>`);
        actions.push(`<button class="btn btn-sm btn-outline-warning me-1" data-action="reject-volunteer" data-id="${vol._id}">Reject</button>`);
      } else {
        actions.push(`<button class="btn btn-sm btn-primary me-1" data-action="assign-task" data-id="${vol._id}" data-name="${escapeAttr(vol.name)}" data-email="${escapeAttr(vol.email)}">Assign</button>`);
        actions.push(`<button class="btn btn-sm btn-outline-primary me-1" data-action="email-volunteer" data-id="${vol._id}" data-name="${escapeAttr(vol.name)}" data-email="${escapeAttr(vol.email)}"><i class="bi bi-envelope"></i></button>`);
      }

      if (vol.blocked) {
        actions.push(`<button class="btn btn-sm btn-outline-success me-1" data-action="unblock-volunteer" data-id="${vol._id}">Unblock</button>`);
      } else {
        actions.push(`<button class="btn btn-sm btn-outline-danger me-1" data-action="block-volunteer" data-id="${vol._id}">Block</button>`);
      }

      if (overdue > 0 || warned > 0) {
        actions.push(`<button class="btn btn-sm btn-outline-warning me-1" data-action="warn-volunteer" data-id="${vol._id}">Warn</button>`);
      }

      actions.push(`<button class="btn btn-sm btn-outline-secondary" data-action="tasks-volunteer" data-id="${vol._id}" data-name="${escapeAttr(vol.name)}">Tasks</button>`);

      return `
        <tr>
          <td>
            <div class="fw-semibold">${escapeHtml(vol.name || 'Unnamed')}</div>
            <div class="text-muted small">${escapeHtml(vol.email)}</div>
          </td>
          <td>
            <div>${escapeHtml(phone)}</div>
          </td>
          <td>${escapeHtml(location)}</td>
          <td>${statusBadges}</td>
          <td>
            <div class="fw-semibold">${numberFormat(metrics.tasksAssigned)}</div>
            <div class="text-muted small">Completed ${numberFormat(metrics.tasksCompleted)}</div>
          </td>
          <td>
            <div class="${overdue ? 'text-danger fw-semibold' : 'text-muted'}">${numberFormat(overdue)}</div>
            <div class="text-muted small">Warned ${numberFormat(warned)}</div>
          </td>
          <td>${escapeHtml(lastActivity)}</td>
          <td class="text-end">${actions.join('')}</td>
        </tr>
      `;
    }

    function getStatusBadges(vol) {
      const pieces = [];
      if (vol.approvalStatus === 'approved') {
        pieces.push('<span class="badge bg-success-subtle text-success-emphasis me-1">Approved</span>');
      } else if (vol.approvalStatus === 'rejected') {
        pieces.push('<span class="badge bg-secondary-subtle text-secondary-emphasis me-1">Rejected</span>');
      } else {
        pieces.push('<span class="badge bg-warning-subtle text-warning-emphasis me-1">Pending</span>');
      }
      if (vol.blocked) {
        pieces.push('<span class="badge bg-danger-subtle text-danger-emphasis">Blocked</span>');
      }
      return pieces.join('');
    }

    function handleTableAction(event) {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const { action, id } = button.dataset;
      if (!id) return;
      const name = button.dataset.name || (state.volunteerMap.get(id)?.name ?? '');
      const email = button.dataset.email || (state.volunteerMap.get(id)?.email ?? '');

      switch (action) {
        case 'view-volunteer':
          openProfileModal(id);
          break;
        case 'approve-volunteer':
          confirmAction({
            title: 'Approve volunteer',
            message: 'Approve this volunteer? They will be able to receive assignments immediately.',
            variant: 'success',
            handler: () => approveVolunteer(id, button)
          });
          break;
        case 'reject-volunteer':
          rejectVolunteer(id);
          break;
        case 'block-volunteer':
          confirmAction({
            title: 'Block volunteer',
            message: 'Blocked volunteers cannot log in. Continue?',
            variant: 'danger',
            handler: () => blockVolunteer(id, button)
          });
          break;
        case 'unblock-volunteer':
          confirmAction({
            title: 'Unblock volunteer',
            message: 'Restore access for this volunteer?',
            variant: 'primary',
            handler: () => unblockVolunteer(id, button)
          });
          break;
        case 'assign-task':
          openAssignTaskModal({ id, name, email });
          break;
        case 'email-volunteer':
          openEmailModal({ id, name, email });
          break;
        case 'warn-volunteer':
          confirmAction({
            title: 'Send warning',
            message: 'Warn this volunteer about their overdue tasks?',
            variant: 'warning',
            handler: () => warnVolunteer(id, button)
          });
          break;
        case 'tasks-volunteer':
          loadTaskHistory(id, name);
          break;
        default:
          break;
      }
    }

    async function openProfileModal(id) {
      try {
        modals.profile?.show();
        setProfileLoading();
        const payload = await request(`/admin/api/volunteers/${id}`);
        state.activeVolunteer = {
          id,
          name: payload.volunteer?.name || '',
          email: payload.volunteer?.email || ''
        };
        populateProfileModal(payload);
      } catch (error) {
        console.error('Volunteer profile error', error);
        showAlert(`Failed to load volunteer: ${error.message}`, 'danger');
        modals.profile?.hide();
      }
    }

    function setProfileLoading() {
      if (!elements.profile) return;
      elements.profile.name.textContent = 'Loading volunteer…';
      elements.profile.email.textContent = '';
      elements.profile.emailLink.removeAttribute('href');
      elements.profile.activeTasks.innerHTML = '<p class="text-muted mb-0">Loading tasks…</p>';
    }

    function populateProfileModal(data) {
      const volunteer = data.volunteer || {};
      const stats = data.stats || {};
      const activeTasks = data.activeTasks || [];

      elements.profile.name.textContent = volunteer.name || 'Volunteer';
      elements.profile.email.textContent = volunteer.email || '';
      elements.profile.emailLink.href = volunteer.email ? `mailto:${volunteer.email}` : '#';
      elements.profile.approvalBadge.textContent = (volunteer.approvalStatus || 'pending').toUpperCase();
      elements.profile.approvalBadge.className = `badge rounded-pill ${volunteer.approvalStatus === 'approved'
          ? 'bg-success'
          : volunteer.approvalStatus === 'rejected'
            ? 'bg-secondary'
            : 'bg-warning text-dark'
        }`;

      if (volunteer.blocked) {
        elements.profile.blockedBadge.classList.remove('d-none');
      } else {
        elements.profile.blockedBadge.classList.add('d-none');
      }

      elements.profile.location.textContent = volunteer.volunteerProfile?.currentLocation || volunteer.address?.state || '—';
      elements.profile.phone.textContent = volunteer.contact?.phone || '—';
      elements.profile.joined.textContent = formatDate(volunteer.createdAt);
      elements.profile.lastAssignment.textContent = formatRelative(volunteer.volunteerProfile?.lastAssignmentAt);
      elements.profile.skills.innerHTML = renderSkills(volunteer.volunteerProfile?.skills);
      elements.profile.notes.textContent = volunteer.volunteerProfile?.notes || '';
      elements.profile.tasksAssigned.textContent = numberFormat(stats.totalTasks);
      elements.profile.tasksCompleted.textContent = numberFormat(stats.completedTasks);
      elements.profile.tasksOverdue.textContent = numberFormat(stats.overdueTasks);
      elements.profile.tasksWarned.textContent = numberFormat(
        volunteer.metrics?.tasksWarned || volunteer.volunteerProfile?.tasksWarned || 0
      );
      elements.profile.activeTasks.innerHTML = renderActiveTasks(activeTasks);
    }

    function renderSkills(skills = []) {
      if (!skills.length) return '<span class="text-muted">No skills registered.</span>';
      return skills.map((skill) => `<span class="badge bg-light text-dark me-1">${escapeHtml(skill)}</span>`).join('');
    }

    function renderActiveTasks(tasks = []) {
      if (!tasks.length) {
        return '<p class="text-muted mb-0">No active tasks at the moment.</p>';
      }
      return tasks
        .map(
          (task) => `
          <article class="volunteer-task-item">
            <div>
              <div class="fw-semibold">${escapeHtml(task.title)}</div>
              <div class="text-muted small">${task.disaster?.title || 'General'} · Due ${formatDate(task.deadline)}</div>
            </div>
            <span class="badge bg-light text-dark text-uppercase">${escapeHtml(task.status)}</span>
          </article>
        `
        )
        .join('');
    }

    function openAssignTaskModal(vol) {
      state.activeVolunteer = vol;
      elements.assignVolunteerIdInput.value = vol.id;
      elements.assignVolunteerName.textContent = vol.name || 'Volunteer';
      elements.assignVolunteerEmail.textContent = vol.email || '';
      elements.taskTitle.value = '';
      elements.taskDescription.value = '';
      elements.taskPriority.value = 'medium';
      elements.taskDeadline.value = '';
      elements.relatedRequest.value = '';
      elements.taskDisasterSelect.value = '';
      modals.assignTask?.show();
    }

    function openEmailModal(vol) {
      state.activeVolunteer = vol;
      elements.emailVolunteerId.value = vol.id;
      elements.emailVolunteerTo.textContent = vol.email || vol.name || 'Volunteer';
      elements.emailSubject.value = '';
      elements.emailMessage.value = '';
      modals.email?.show();
    }

    async function handleAssignTaskSubmit(event) {
      event.preventDefault();
      console.log('Admin: Assign Task form submitted'); // Debug log

      const volunteerId = elements.assignVolunteerIdInput.value;
      if (!volunteerId) {
        console.error('Admin: No volunteer ID found in form');
        return;
      }
      const payload = {
        title: elements.taskTitle.value.trim(),
        description: elements.taskDescription.value.trim(),
        priority: elements.taskPriority.value,
        deadline: elements.taskDeadline.value,
        disasterId: elements.taskDisasterSelect.value,
        relatedRequest: elements.relatedRequest.value.trim(),
        sendEmail: elements.sendEmailOnAssign?.checked !== false // Default to true if checkbox exists
      };
      if (!payload.title) {
        showAlert('Task title is required.', 'warning');
        return;
      }
      try {
        const response = await request(`/admin/api/volunteers/${volunteerId}/assign-task`, {
          method: 'POST',
          body: payload
        });
        showAlert('Task assigned successfully.' + (payload.sendEmail ? ' Email notification sent to volunteer.' : ''), 'success');
        modals.assignTask?.hide();
        // Reset form
        elements.assignTaskForm?.reset();
        if (elements.sendEmailOnAssign) elements.sendEmailOnAssign.checked = true;
        loadVolunteers(state.page);
      } catch (error) {
        console.error('Assign task error', error);
        showAlert(`Failed to assign task: ${error.message}`, 'danger');
      }
    }

    async function handleEmailSubmit(event) {
      event.preventDefault();
      console.log('Admin: Email form submitted'); // Debug log

      const volunteerId = elements.emailVolunteerId.value;
      if (!volunteerId) {
        console.error('Admin: No volunteer ID found in email form');
        return;
      }
      const payload = {
        subject: elements.emailSubject.value.trim(),
        message: elements.emailMessage.value.trim()
      };
      if (!payload.subject || !payload.message) {
        showAlert('Subject and message are required.', 'warning');
        return;
      }
      try {
        await request(`/admin/api/volunteers/${volunteerId}/email`, {
          method: 'POST',
          body: payload
        });
        showAlert('Email sent successfully.', 'success');
        modals.email?.hide();
      } catch (error) {
        console.error('Email volunteer error', error);
        showAlert(`Failed to send email: ${error.message}`, 'danger');
      }
    }

    function confirmAction({ title, message, variant = 'danger', handler }) {
      if (!modals.confirm || !elements.confirmActionBtn) {
        // fallback
        if (window.confirm(message || title)) handler();
        return;
      }
      elements.confirmActionTitle.textContent = title;
      elements.confirmActionMessage.textContent = message;
      elements.confirmActionBtn.className = `btn btn-${variant}`;
      confirmHandler = handler;
      modals.confirm.show();
    }

    async function approveVolunteer(id, button) {
      await performAction({
        button,
        loadingText: 'Approving…',
        requestConfig: { url: `/admin/api/volunteers/${id}/approve`, method: 'PUT' },
        successMessage: 'Volunteer approved.',
        onSuccess: refreshAll
      });
    }

    async function rejectVolunteer(id) {
      const reason = window.prompt('Provide a reason for rejection (optional):', '') || '';
      await performAction({
        requestConfig: {
          url: `/admin/api/volunteers/${id}/reject`,
          method: 'PUT',
          body: { reason }
        },
        successMessage: 'Volunteer rejected.',
        onSuccess: refreshAll
      });
    }

    async function blockVolunteer(id, button) {
      await performAction({
        button,
        loadingText: 'Blocking…',
        requestConfig: { url: `/admin/api/volunteers/${id}/block`, method: 'PUT' },
        successMessage: 'Volunteer blocked.',
        onSuccess: loadVolunteers.bind(null, state.page)
      });
    }

    async function unblockVolunteer(id, button) {
      await performAction({
        button,
        loadingText: 'Unblocking…',
        requestConfig: { url: `/admin/api/volunteers/${id}/unblock`, method: 'PUT' },
        successMessage: 'Volunteer unblocked.',
        onSuccess: loadVolunteers.bind(null, state.page)
      });
    }

    async function warnVolunteer(id, button) {
      await performAction({
        button,
        loadingText: 'Warning…',
        requestConfig: { url: `/admin/api/volunteers/${id}/warn`, method: 'PUT' },
        successMessage: 'Warning issued.',
        onSuccess: loadVolunteers.bind(null, state.page)
      });
    }

    async function loadTaskHistory(id, name) {
      try {
        if (elements.taskHistoryTitle) {
          elements.taskHistoryTitle.textContent = name ? `Task history — ${name}` : 'Task history';
        }
        if (elements.taskHistoryContent) {
          elements.taskHistoryContent.innerHTML = `
            <div class="text-center text-muted py-3">
              <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
              <span class="ms-2">Loading tasks…</span>
            </div>
          `;
        }
        modals.taskHistory?.show();
        const data = await request(`/admin/api/volunteers/${id}/tasks`);
        renderTaskHistory(data.data || []);
      } catch (error) {
        console.error('Task history error', error);
        showAlert(`Failed to load task history: ${error.message}`, 'danger');
        if (elements.taskHistoryContent) {
          elements.taskHistoryContent.innerHTML = `<div class="text-danger py-3 text-center">${escapeHtml(error.message)}</div>`;
        }
      }
    }

    function renderTaskHistory(tasks) {
      if (!elements.taskHistoryContent) return;
      if (!tasks.length) {
        elements.taskHistoryContent.innerHTML = '<div class="text-center text-muted py-4">No tasks recorded.</div>';
        return;
      }
      elements.taskHistoryContent.innerHTML = tasks
        .map(
          (task) => `
            <div class="list-group-item">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-semibold">${escapeHtml(task.title)}</div>
                  <div class="text-muted small">
                    ${escapeHtml(task.disaster?.title || 'General')} · ${escapeHtml(task.status)} · Assigned ${formatDate(task.createdAt)}
                  </div>
                </div>
                <span class="badge bg-light text-dark">${escapeHtml(task.priority || 'normal')}</span>
              </div>
              ${task.description ? `<p class="mb-0 mt-2 text-muted">${escapeHtml(task.description)}</p>` : ''}
            </div>
          `
        )
        .join('');
    }

    async function loadDisasters() {
      if (state.disastersLoaded || !elements.taskDisasterSelect) return;
      try {
        const data = await request('/admin/api/volunteers/disasters/active');
        const options = ['<option value="">No disaster linkage</option>'];
        (data.data || []).forEach((disaster) => {
          options.push(`<option value="${disaster._id}">${escapeHtml(disaster.title)} (${escapeHtml(disaster.severity || 'N/A')})</option>`);
        });
        elements.taskDisasterSelect.innerHTML = options.join('');
        state.disastersLoaded = true;
      } catch (error) {
        console.warn('Disaster load error', error);
      }
    }

    async function performAction({ button, loadingText = 'Working…', requestConfig, successMessage, onSuccess }) {
      try {
        setButtonLoading(button, true, loadingText);
        await request(requestConfig.url, {
          method: requestConfig.method || 'POST',
          body: requestConfig.body
        });
        if (successMessage) showAlert(successMessage, 'success');
        if (typeof onSuccess === 'function') onSuccess();
      } catch (error) {
        console.error('Action error', error);
        showAlert(error.message, 'danger');
      } finally {
        setButtonLoading(button, false);
      }
    }

    async function request(url, options = {}) {
      const config = {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        method: options.method || 'GET',
        body: options.body ?? null
      };
      if (config.body && typeof config.body !== 'string') {
        config.body = JSON.stringify(config.body);
      }
      const response = await fetch(url, config);
      let payload = null;
      const text = await response.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch (error) {
          payload = { message: text };
        }
      }
      if (!response.ok) {
        throw new Error(payload?.message || `Request failed with status ${response.status}`);
      }
      return payload || {};
    }

    function showAlert(message, variant = 'info', timeout = 4000) {
      if (!elements.alertHost) return;
      const wrapper = document.createElement('div');
      wrapper.className = `alert alert-${variant} alert-dismissible fade show`;
      wrapper.innerHTML = `
        <span>${message}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;
      elements.alertHost.appendChild(wrapper);
      if (timeout) {
        setTimeout(() => {
          const alertInstance = bootstrap.Alert.getOrCreateInstance(wrapper);
          alertInstance.close();
        }, timeout);
      }
    }

    function setButtonLoading(button, isLoading, text = 'Working…') {
      if (!button) return;
      if (isLoading) {
        if (!button.dataset.originalHtml) {
          button.dataset.originalHtml = button.innerHTML;
        }
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span>${text}`;
      } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
          button.innerHTML = button.dataset.originalHtml;
          delete button.dataset.originalHtml;
        }
      }
    }

    function formatDate(value) {
      if (!value) return '—';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleDateString();
    }

    function formatRelative(value) {
      if (!value) return '—';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      const diff = Date.now() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes} min ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
      return date.toLocaleDateString();
    }

    function numberFormat(value) {
      const num = typeof value === 'number' ? value : Number(value) || 0;
      return new Intl.NumberFormat().format(num);
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
      return value.toString().replace(/"/g, '&quot;');
    }

    function debounce(fn, delay = 300) {
      let timer = null;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(null, args), delay);
      };
    }
  }
})();
