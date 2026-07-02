/**
 * admin.js - Admin Dashboard Logic
 * SavanaTattoos - Studio management system.
 * Panels: Leads, Scheduler, Client Profiles, Site Management
 */

const db = initSupabase();

function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    if (!container) {
        var div = document.createElement('div');
        div.id = 'toastContainer';
        document.body.appendChild(div);
        container = div;
    }
    var toasts = container.querySelectorAll('.toast');
    if (toasts.length >= 5) {
        toasts[0].classList.add('toast-exit');
        setTimeout(function() { if (toasts[0].parentNode) toasts[0].remove(); }, 300);
    }
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.classList.add('toast-exit'); setTimeout(function() { toast.remove(); }, 300); }, 3500);
}

function showConfirm(message) {
    return new Promise(function(resolve) {
        var modal = document.getElementById('confirmModal');
        var messageEl = document.getElementById('confirmMessage');
        var okBtn = document.getElementById('confirmOkBtn');
        var cancelBtn = document.getElementById('confirmCancelBtn');
        if (!modal || !messageEl) { resolve(false); return; }
        messageEl.textContent = message;
        modal.style.display = 'flex';
        okBtn.focus();
        function cleanup() {
            modal.style.display = 'none';
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            modal.onclick = null;
            document.removeEventListener('keydown', confirmKeyHandler);
        }
        okBtn.onclick = function() { cleanup(); resolve(true); };
        cancelBtn.onclick = function() { cleanup(); resolve(false); };
        modal.onclick = function(e) { if (e.target === modal) { cleanup(); resolve(false); } };
        function confirmKeyHandler(e) {
            if (e.key === 'Escape') { cleanup(); resolve(false); return; }
            if (e.key === 'Enter') { cleanup(); resolve(true); return; }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    var loginSection = document.getElementById('loginSection');
    var dashboardSection = document.getElementById('dashboardSection');
    var loginBtn = document.getElementById('loginBtn');
    var loginError = document.getElementById('loginError');
    var logoutBtn = document.getElementById('logoutBtn');
    var userEmailDisplay = document.getElementById('userEmail');
    var leadsTableBody = document.getElementById('leadsTableBody');
    var loadingState = document.getElementById('loadingState');
    var emptyState = document.getElementById('emptyState');
    var statsRow = document.getElementById('dashboardStats');
    var sidebar = document.getElementById('sidebar');
    var menuToggle = document.getElementById('menuToggle');
    var closeSidebar = document.getElementById('closeSidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');
    var navItems = document.querySelectorAll('.nav-item[data-panel], .rail-item[data-panel]');
    var panels = document.querySelectorAll('.admin-panel');

    var leads = [];
    var calendarDate = new Date();
    var dailyLeads = [];
    var clients = [];
    var clientProfiles = [];
    var activeLeadId = null;

    // Phone formatting
    ['clientPhone', 'profPhone'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.oninput = function(e) { e.target.value = formatPhoneNumber(e.target.value); };
    });

    // --- Auth ---
    checkUser();

    async function checkUser() {
        try {
            var result = await db.auth.getSession();
            var session = result.data.session;
            var error = result.error;
            if (error) throw error;
            if (session) showDashboard(session);
            else showLogin();
        } catch (err) {
            console.error('Auth Check Error:', err.message);
            showLogin();
        }
    }

    function showDashboard(session) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        userEmailDisplay.textContent = session.user.email || '';
        fetchLeads();
    }

    function showLogin() {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }

    loginBtn.addEventListener('click', async function() {
        var email = document.getElementById('adminEmail').value;
        var password = document.getElementById('adminPassword').value;
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';
        try {
            var err = await db.auth.signInWithPassword({ email: email, password: password });
            if (err.error) throw err.error;
            var result = await db.auth.getSession();
            showDashboard(result.data.session);
        } catch (err) {
            loginError.textContent = err.message || 'Login failed.';
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    });

    logoutBtn.addEventListener('click', async function() {
        await db.auth.signOut();
        showLogin();
    });

    // --- Sidebar Navigation ---
    function switchPanel(panelId) {
        navItems.forEach(function(item) {
            item.classList.toggle('active', item.dataset.panel === panelId);
        });
        panels.forEach(function(panel) {
            panel.classList.toggle('active', panel.id === panelId + 'Panel');
        });
        if (window.innerWidth <= 900) closeMobileSidebar();
        if (panelId === 'appointments') fetchLeads();
        else if (panelId === 'scheduler') renderScheduler();
        else if (panelId === 'client-index') loadClients();
        else if (panelId === 'site-mgmt') initSiteMgmt();
    }

    navItems.forEach(function(item) {
        item.addEventListener('click', function() { switchPanel(item.dataset.panel); });
    });

    if (menuToggle) menuToggle.addEventListener('click', openMobileSidebar);
    if (closeSidebar) closeSidebar.addEventListener('click', closeMobileSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

    function openMobileSidebar() { sidebar.style.transform = 'translateX(0)'; sidebarOverlay.style.display = 'block'; }
    function closeMobileSidebar() { sidebar.style.transform = 'translateX(-100%)'; sidebarOverlay.style.display = 'none'; }

    // --- Leads Panel ---
    async function fetchLeads() {
        loadingState.style.display = 'block';
        emptyState.style.display = 'none';
        var result = await db.from('leads').select('*').neq('status', 'deleted').order('created_at', { ascending: false });
        var data = result.data;
        var error = result.error;
        if (error) { console.error('Leads fetch error:', error); loadingState.style.display = 'none'; return; }
        leads = data || [];
        loadingState.style.display = 'none';
        renderStats(leads);
        renderLeads();
    }

    function renderLeads() {
        var searchInput = document.getElementById('leadsSearch');
        var statusFilter = document.getElementById('leadsStatusFilter');
        var searchTerm = (searchInput ? searchInput.value || '' : '').toLowerCase();
        var statusValue = (statusFilter ? statusFilter.value : 'all') || 'all';
        var filtered = leads.filter(function(lead) {
            var name = (lead.client_name ? lead.client_name + ' ' + (lead.last_name || '') : (lead.name || '')).toLowerCase();
            var matchesSearch = !searchTerm || name.includes(searchTerm) ||
                (lead.service || '').toLowerCase().includes(searchTerm) ||
                (lead.status || '').toLowerCase().includes(searchTerm);
            var matchesStatus = statusValue === 'all' || lead.status === statusValue;
            return matchesSearch && matchesStatus;
        });
        if (!filtered.length) { emptyState.style.display = 'block'; return; }
        emptyState.style.display = 'none';
        leadsTableBody.innerHTML = '';
        var now = Date.now();
        filtered.forEach(function(lead) {
            var tr = document.createElement('tr');
            var submittedDate = lead.requested_date ? new Date(lead.requested_date) : null;
            var submittedDisplay = 'N/A';
            if (submittedDate) {
                var daysAgo = Math.floor((now - submittedDate.getTime()) / 86400000);
                if (daysAgo < 0) daysAgo = 0;
                if (daysAgo === 0) submittedDisplay = 'Today';
                else if (daysAgo === 1) submittedDisplay = '1 day ago';
                else if (daysAgo < 7) submittedDisplay = daysAgo + ' days ago';
                else submittedDisplay = submittedDate.toLocaleDateString();
            }
            var name = lead.client_name ? lead.client_name + ' ' + (lead.last_name || '') : (lead.name || 'Unknown');
            tr.innerHTML =
                '<td>' + escapeHtml(name) + '</td>' +
                '<td>' + escapeHtml(lead.service || '-') + '</td>' +
                '<td>' + escapeHtml(lead.size || '-') + '</td>' +
                '<td><span class="status-badge status-' + escapeHtml(lead.status) + '">' + escapeHtml(lead.status) + '</span></td>' +
                '<td>' + escapeHtml(submittedDisplay) + '</td>' +
                '<td>' +
                    '<select class="status-select" data-action="update-status" data-id="' + lead.id + '">' +
                        '<option value="pending"' + (lead.status === 'pending' ? ' selected' : '') + '>Pending</option>' +
                        '<option value="contacted"' + (lead.status === 'contacted' ? ' selected' : '') + '>Contacted</option>' +
                        '<option value="confirmed"' + (lead.status === 'confirmed' ? ' selected' : '') + '>Confirmed</option>' +
                        '<option value="cancelled"' + (lead.status === 'cancelled' ? ' selected' : '') + '>Cancelled</option>' +
                    '</select>' +
                    '<button class="admin-btn-outline" data-action="view-lead" data-id="' + lead.id + '" style="margin-left:4px;">View</button>' +
                '</td>';
            leadsTableBody.appendChild(tr);
        });
        attachLeadsDelegation();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var STUDIO_START_HOUR = 11;
    var STUDIO_END_HOUR = 19;

    function attachLeadsDelegation() {
        if (leadsTableBody._delegationAttached) return;
        leadsTableBody._delegationAttached = true;
        leadsTableBody.addEventListener('change', function(e) {
            var select = e.target.closest('select[data-action="update-status"]');
            if (!select) return;
            updateLeadStatus(select.dataset.id, select.value);
        });
        leadsTableBody.addEventListener('click', function(e) {
            var btn = e.target.closest('button[data-action="view-lead"]');
            if (btn) viewLead(btn.dataset.id);
        });
    }

    async function updateLeadStatus(id, status) {
        if (status === 'cancelled' || status === 'deleted') {
            var ok = await showConfirm('Change this lead to "' + status + '"?');
            if (!ok) return;
        }
        try {
            await db.from('leads').update({ status: status, updated_at: new Date().toISOString() }).eq('id', id);
            var lead = leads.find(function(l) { return l.id === id; });
            if (lead) lead.status = status;
            if (status === 'confirmed') {
                if (lead) triggerConfirmedEmail(lead);
            }
            renderStats(leads);
            renderLeads();
            showToast('Lead status updated to ' + status, 'success');
        } catch (err) {
            showToast('Error updating status: ' + err.message, 'error');
        }
    }

    async function viewLead(id) {
        var lead = leads.find(function(l) { return l.id === id; });
        if (!lead) {
            var fresh = await db.from('leads').select('*').eq('id', id).single();
            lead = fresh.data;
            if (!lead) { showToast('Lead not found.', 'error'); return; }
        }
        activeLeadId = id;
        var modal = document.getElementById('leadModal');
        var modalBody = document.getElementById('modalBody');
        var name = lead.client_name ? lead.client_name + ' ' + (lead.last_name || '') : (lead.name || 'Unknown');
        var dateStr = lead.requested_date ? new Date(lead.requested_date + 'T00:00:00').toLocaleDateString() : 'N/A';
        var timeStr = lead.requested_time ? formatTime12(lead.requested_time) : 'N/A';
        modalBody.innerHTML =
            '<div style="padding:24px 32px;">' +
                '<h3 style="color:var(--primary);margin-bottom:16px;">Lead Details</h3>' +
                '<div class="form-grid">' +
                    '<div><strong style="color:var(--text-muted);font-size:0.8rem;">NAME</strong><p>' + escapeHtml(name) + '</p></div>' +
                    '<div><strong style="color:var(--text-muted);font-size:0.8rem;">SERVICE</strong><p>' + escapeHtml(lead.service || '-') + '</p></div>' +
                    '<div><strong style="color:var(--text-muted);font-size:0.8rem;">SIZE</strong><p>' + escapeHtml(lead.size || '-') + '</p></div>' +
                    '<div><strong style="color:var(--text-muted);font-size:0.8rem;">PLACEMENT</strong><p>' + escapeHtml(lead.body_placement || '-') + '</p></div>' +
                    '<div><strong style="color:var(--text-muted);font-size:0.8rem;">PHONE</strong><p>' + escapeHtml(lead.phone || '-') + '</p></div>' +
                    '<div><strong style="color:var(--text-muted);font-size:0.8rem;">EMAIL</strong><p>' + escapeHtml(lead.email || '-') + '</p></div>' +
                    '<div><strong style="color:var(--text-muted);font-size:0.8rem;">DATE</strong><p>' + escapeHtml(dateStr) + '</p></div>' +
                    '<div><strong style="color:var(--text-muted);font-size:0.8rem;">TIME</strong><p>' + escapeHtml(timeStr) + '</p></div>' +
                '</div>' +
                '<div style="margin-top:16px;"><strong style="color:var(--text-muted);font-size:0.8rem;">MESSAGE</strong><p style="margin-top:4px;">' + escapeHtml(lead.message || 'No message') + '</p></div>' +
                '<div style="margin-top:16px;"><strong style="color:var(--text-muted);font-size:0.8rem;">STATUS</strong> <span class="status-badge status-' + escapeHtml(lead.status) + '" style="margin-left:8px;">' + escapeHtml(lead.status) + '</span></div>' +
                '<div style="margin-top:16px;display:flex;gap:8px;">' +
                    '<button class="admin-btn" data-action="link-profile" data-id="' + lead.id + '">Link to Client</button>' +
                    (lead.status !== 'confirmed' ? '<button class="admin-btn" data-action="confirm-lead" data-id="' + lead.id + '" style="background:var(--success);">Confirm</button>' : '') +
                    '<button class="admin-btn delete" data-action="archive-lead" data-id="' + lead.id + '">Archive</button>' +
                '</div>' +
            '</div>';
        modal.style.display = 'flex';
        setupModalFocus(modal);
        modal.querySelector('.close-btn').onclick = function() { modal.style.display = 'none'; activeLeadId = null; };
        attachLeadModalActions(id);
    }

    function attachLeadModalActions(id) {
        var modal = document.getElementById('leadModal');
        if (!modal._modalBodyAttached) {
            modal._modalBodyAttached = true;
            modal.addEventListener('click', function(e) {
                var target = e.target.closest('[data-action]');
                if (!target) return;
                var action = target.dataset.action;
                var actionId = target.dataset.id;
                if (action === 'link-profile' || target.closest('[data-action="link-profile"]')) {
                    var linkBtn = target.closest('[data-action="link-profile"]');
                    if (linkBtn) {
                        document.getElementById('leadModal').style.display = 'none';
                        activeLeadId = linkBtn.dataset.id;
                        switchPanel('client-index');
                    }
                }
                if (action === 'confirm-lead' || target.closest('[data-action="confirm-lead"]')) {
                    var confirmBtn = target.closest('[data-action="confirm-lead"]');
                    if (confirmBtn) {
                        (async function() {
                            await db.from('leads').update({ status: 'confirmed', confirmed_time: new Date().toISOString() }).eq('id', confirmBtn.dataset.id);
                            var lead = leads.find(function(l) { return l.id === confirmBtn.dataset.id; });
                            if (lead) lead.status = 'confirmed';
                            if (lead) triggerConfirmedEmail(lead);
                            fetchLeads();
                            showToast('Lead confirmed!', 'success');
                            document.getElementById('leadModal').style.display = 'none';
                        })();
                    }
                }
                if (action === 'archive-lead' || target.closest('[data-action="archive-lead"]')) {
                    var archiveBtn = target.closest('[data-action="archive-lead"]');
                    if (archiveBtn) {
                        (async function() {
                            var ok = await showConfirm('Archive this lead?');
                            if (!ok) return;
                            await db.from('leads').update({ status: 'deleted' }).eq('id', archiveBtn.dataset.id);
                            leads = leads.filter(function(l) { return l.id !== archiveBtn.dataset.id; });
                            fetchLeads();
                            showToast('Lead archived.', 'success');
                            document.getElementById('leadModal').style.display = 'none';
                        })();
                    }
                }
            });
        }
    }

    // --- Scheduler Panel ---
    // Scheduler State
    var schedulerViewMode = 'month';
    var weekStartDate = new Date();
    var dayDate = new Date();
    var blockedSlotsData = [];
    var confirmedDates = {};
    var pendingDates = {};
    var blockedDates = {};

    async function loadClients() {
        var clientsLoading = document.getElementById('clientsLoading');
        if (clientsLoading) clientsLoading.style.display = 'block';
        var grid = document.getElementById('clientGrid');
        if (grid) grid.innerHTML = '';
        try {
            var clientsResult = await db.from('clients').select('*');
            clients = clientsResult.data || [];
            var profilesResult = await db.from('client_profiles').select('*');
            clientProfiles = profilesResult.data || [];
            await renderClients();
            populateClientDropdown();
        } catch (err) {
            console.error('Failed to load clients:', err);
            if (grid) grid.innerHTML = '<div class="empty-state"><p>Failed to load clients. Please refresh.</p></div>';
        } finally {
            if (clientsLoading) clientsLoading.style.display = 'none';
        }
    }

    function populateClientDropdown() {
        var select = document.getElementById('newApptClientId');
        if (!select) return;
        var options = '<option value="">-- New Client --</option>';
        clients.forEach(function(c) {
            options += '<option value="' + c.id + '">' + escapeHtml(c.owner_name) + ' (' + escapeHtml(c.phone) + ')</option>';
        });
        select.innerHTML = options;
    }

  async function renderClients() {
        var today = new Date().toISOString().split('T')[0];
        var upcomingMap = {};
        var lastVisitMap = {};
        try {
            var upcomingRes = await db.from('leads').select('client_ref_id, requested_date, status')
                .eq('status', 'confirmed').gte('requested_date', today);
            var upcomingLeads = upcomingRes.data || [];
            upcomingLeads.forEach(function(l) {
                if (l.client_ref_id) {
                    upcomingMap[l.client_ref_id] = (upcomingMap[l.client_ref_id] || 0) + 1;
                }
            });
        } catch (e) {
            console.error('Failed to fetch upcoming appointments:', e);
        }
        try {
            var lastVisitRes = await db.from('leads').select('client_ref_id, requested_date, status')
                .eq('status', 'confirmed').order('requested_date', { ascending: false });
            var confirmedLeads = lastVisitRes.data || [];
            confirmedLeads.forEach(function(l) {
                if (l.client_ref_id && !lastVisitMap[l.client_ref_id]) {
                    lastVisitMap[l.client_ref_id] = l.requested_date;
                }
            });
        } catch (e) {
            console.error('Failed to fetch last visit dates:', e);
        }
        var grid = document.getElementById('clientGrid');
        var search = document.getElementById('clientSearch');
        var term = (search ? search.value : '') || '';
        term = term.toLowerCase();
        var filtered = clients.filter(function(c) {
            return (c.owner_name || '').toLowerCase().includes(term) ||
                   (c.phone || '').includes(term) ||
                   (c.email || '').toLowerCase().includes(term) ||
                   (c.client_id || '').toLowerCase().includes(term);
        });
        grid.innerHTML = '';
        if (!filtered.length) {
            grid.innerHTML = '<div class="empty-state"><p>No clients found.</p></div>';
            return;
        }
        filtered.forEach(function(client) {
            var profiles = clientProfiles.filter(function(p) { return p.client_ref_id === client.id; });
            var profilesHtml = profiles.map(function(p) {
                var shortNotes = p.notes ? p.notes.substring(0, 30) + (p.notes.length > 30 ? '...' : '') : 'No notes';
                return '<div class="client-profile-mini" data-action="open-profile" data-id="' + p.id + '">' +
                    '<div class="client-icon">&#128100;</div>' +
                    '<div class="client-profile-info"><span class="client-profile-name">' + escapeHtml(p.name) + '</span>' +
                    '<span class="client-profile-notes">' + escapeHtml(shortNotes) + '</span></div></div>';
            }).join('');
            if (!profiles.length) profilesHtml = '<p class="history-empty">No profiles yet.</p>';
            var upcomingCount = upcomingMap[client.id] || 0;
            var upcomingHtml = upcomingCount > 0 ? '<div class="client-upcoming">Upcoming: ' + upcomingCount + ' appointment' + (upcomingCount > 1 ? 's' : '') + '</div>' : '';
            var lastVisit = lastVisitMap[client.id];
            var lastVisitHtml = lastVisit ? '<div class="client-last-visit">Last visit: ' + new Date(lastVisit + 'T00:00:00').toLocaleDateString() + '</div>' : '';
            var card = document.createElement('div');
            card.className = 'profile-card';
            card.innerHTML =
                '<div class="client-card-header">' +
                    '<span class="client-id-badge">' + escapeHtml(client.client_id || 'N/A') + '</span>' +
                    '<h3>' + escapeHtml(client.owner_name) + '</h3>' +
                    '<div class="owner-contact">' + escapeHtml(client.phone) + (client.email ? ' | ' + escapeHtml(client.email) : '') + '</div>' +
                '</div>' +
                (upcomingHtml + lastVisitHtml) +
                '<div class="client-profiles-list">' + profilesHtml + '</div>' +
                '<div class="card-actions-row">' +
                    '<button class="action-btn-outline" data-action="edit-client" data-id="' + client.id + '">Edit</button>' +
                    '<button class="action-btn-primary" data-action="add-profile" data-id="' + client.id + '">+ Profile</button>' +
                '</div>';
            grid.appendChild(card);
        });
        attachClientGridDelegation();
    }

    function attachClientGridDelegation() {
        var grid = document.getElementById('clientGrid');
        if (grid._delegationAttached) return;
        grid._delegationAttached = true;
        grid.addEventListener('click', function(e) {
            var row = e.target.closest('.client-profile-mini[data-action="open-profile"]');
            if (row) { openProfileModalById(row.dataset.id); return; }
            var editBtn = e.target.closest('.action-btn-outline[data-action="edit-client"]');
            if (editBtn) { openClientModalById(editBtn.dataset.id); return; }
            var addBtn = e.target.closest('.action-btn-primary[data-action="add-profile"]');
            if (addBtn) {
                var client = clients.find(function(c) { return c.id === addBtn.dataset.id; });
                if (client) openProfileModal({}, client);
            }
        });
    }

    // --- Client Modal ---
    var clientModal = document.getElementById('clientModal');
    var clientForm = document.getElementById('clientForm');

    document.getElementById('createClientBtn').addEventListener('click', function() { openClientModal({}); });
    document.getElementById('closeClientModal').addEventListener('click', function() { clientModal.style.display = 'none'; });

    window.openClientModal = function(client) {
        client = client || {};
        document.getElementById('clientModalTitle').textContent = client.id ? 'Edit Client' : 'Create New Client';
        document.getElementById('clientModalIdBadge').textContent = 'ID: ' + (client.id ? client.id.substring(0, 8) : 'NEW');
        document.getElementById('clientId').value = client.id || '';
        document.getElementById('clientName').value = client.owner_name || '';
        document.getElementById('clientPhone').value = client.phone || '';
        document.getElementById('clientEmail').value = client.email || '';
        document.getElementById('deleteClientBtn').style.display = client.id ? 'block' : 'none';
        clientModal.style.display = 'block';
        setupModalFocus(clientModal);
    };

    window.openClientModalById = async function(id) {
        var result = await db.from('clients').select('*').eq('id', id).single();
        if (result.data) openClientModal(result.data);
    };

   clientForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var clientName = document.getElementById('clientName').value.trim();
        if (!clientName) { showToast('Client name is required.', 'error'); return; }
        var phone = document.getElementById('clientPhone').value;
        if (!isValidPhoneNumber(phone)) { showToast('Invalid phone number.', 'error'); return; }
        var saveBtn = document.getElementById('saveClientBtn');
        var originalText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
        try {
            var id = document.getElementById('clientId').value;
            var payload = {
                owner_name: document.getElementById('clientName').value,
                phone: phone,
                email: document.getElementById('clientEmail').value || null
            };
            if (id) {
                await db.from('clients').update(payload).eq('id', id);
            } else {
                var newCode = '';
                var attempts = 0;
                var codeExists = true;
                while (codeExists && attempts < 10) {
                    newCode = String(Math.floor(100000 + Math.random() * 900000));
                    var check = await db.from('clients').select('id').eq('client_id', newCode).single();
                    codeExists = !(!check.data || check.error);
                    attempts++;
                }
                if (!codeExists) {
                    showToast('Failed to generate unique client code. Please try again.', 'error');
                    return;
                }
                payload.client_id = newCode;
                await db.from('clients').insert([payload]);
            }
            await loadClients();
            renderClients();
            clientModal.style.display = 'none';
            showToast('Client saved!', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
        }
    });

    document.getElementById('deleteClientBtn').addEventListener('click', async function() {
        var id = document.getElementById('clientId').value;
        if (!id) return;
        var ok = await showConfirm('Delete this client, all their profiles, and unlink them from leads? This action can be undone by soft-deleting leads.');
        if (!ok) return;
        try {
            await db.from('clients').delete().eq('id', id);
            await loadClients();
            renderClients();
            clientModal.style.display = 'none';
            showToast('Client deleted.', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });

    // --- Profile Modal ---
    var profileModal = document.getElementById('profileModal');
    var profileForm = document.getElementById('profileForm');

    document.getElementById('closeProfileModal').addEventListener('click', function() { profileModal.style.display = 'none'; });

    window.openProfileModal = function(profile, client) {
        profile = profile || {};
        client = client || {};
        document.getElementById('profileModalTitle').textContent = profile.id ? 'Edit Profile: ' + profile.name : 'Add Profile to ' + (client.owner_name || 'Client');
        document.getElementById('profileIdBadge').textContent = 'Profile ID: ' + (profile.id ? profile.id.substring(0, 8) : 'NEW');
        var clientCode = client.client_id || client.client_code || 'N/A';
        document.getElementById('profileClientIdBadge').textContent = 'Client: ' + clientCode;
        document.getElementById('profileId').value = profile.id || '';
        document.getElementById('profileClientId').value = client.id || '';
        document.getElementById('profName').value = profile.name || '';
        document.getElementById('profClientId').value = profile.client_id || '';
        document.getElementById('profPhone').value = client.phone || profile.phone || '';
        document.getElementById('profEmail').value = client.email || profile.email || '';
        document.getElementById('profNotes').value = profile.notes || '';
        document.getElementById('deleteProfileBtn').style.display = profile.id ? 'block' : 'none';
        if (profile.id) {
            var historyEl = document.getElementById('profileHistory');
            if (historyEl && historyEl.getAttribute('data-loaded')) {
                // Skip re-fetching already loaded history
            } else {
                fetchProfileHistory(profile.id);
            }
        } else {
            document.getElementById('profileHistory').innerHTML = '<p class="history-empty">Save profile first to see history.</p>';
        }
        profileModal.style.display = 'block';
        setupModalFocus(profileModal);
    };

    window.openProfileModalById = async function(id) {
        var p = await db.from('client_profiles').select('*').eq('id', id).single();
        if (!p.data) return;
        var c = await db.from('clients').select('*').eq('id', p.data.client_ref_id).single();
        openProfileModal(p.data, c.data || {});
    };

   profileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var profName = document.getElementById('profName').value.trim();
        if (!profName) { showToast('Profile name is required.', 'error'); return; }
        var phone = document.getElementById('profPhone').value;
        if (!isValidPhoneNumber(phone)) { showToast('Invalid phone number.', 'error'); return; }
        var saveBtn = document.getElementById('saveProfileBtn');
        var originalText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
        try {
            var id = document.getElementById('profileId').value;
            var clientRefId = document.getElementById('profileClientId').value;
            var payload = {
                name: document.getElementById('profName').value,
                client_id: document.getElementById('profClientId').value || null,
                phone: phone,
                email: document.getElementById('profEmail').value || null,
                notes: document.getElementById('profNotes').value,
                client_ref_id: clientRefId || null
            };
            if (id) await db.from('client_profiles').update(payload).eq('id', id);
            else await db.from('client_profiles').insert([payload]);
            await loadClients();
            renderClients();
            profileModal.style.display = 'none';
            showToast('Profile saved!', 'success');
            if (activeLeadId) {
                var p2 = await db.from('client_profiles').select('id').order('created_at', { ascending: false }).limit(1).single();
                if (p2.data) {
                    await db.from('leads').update({ profile_id: p2.data.id }).eq('id', activeLeadId);
                    activeLeadId = null;
                    fetchLeads();
                }
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
        }
    });

    document.getElementById('deleteProfileBtn').addEventListener('click', async function() {
        var id = document.getElementById('profileId').value;
        if (!id) return;
        var ok = await showConfirm('Delete this profile?');
        if (!ok) return;
        try {
            await db.from('client_profiles').delete().eq('id', id);
            await loadClients();
            renderClients();
            profileModal.style.display = 'none';
            showToast('Profile deleted.', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });

    async function fetchProfileHistory(profileId) {
        var historyEl = document.getElementById('profileHistory');
        if (!historyEl) return;
        historyEl.innerHTML = '<p class="history-loading">Loading history...</p>';
        var result = await db.from('leads').select('requested_date, confirmed_time, service, message, status')
            .eq('profile_id', profileId).order('requested_date', { ascending: false });
        var data = result.data;
        var error = result.error;
        if (error || !data || !data.length) {
            var profileRes = await db.from('client_profiles').select('phone').eq('id', profileId).single();
            var profilePhone = profileRes && profileRes.data ? profileRes.data.phone : null;
            if (profilePhone) {
                var phoneRes = await db.from('leads').select('requested_date, confirmed_time, service, message, status')
                    .eq('phone', profilePhone).order('requested_date', { ascending: false });
                data = phoneRes.data || [];
                if (data && data.length) {
                    historyEl.innerHTML = '';
                    data.forEach(function(appt) {
                        var date = appt.requested_date ? new Date(appt.requested_date + 'T00:00:00').toLocaleDateString() : 'N/A';
                        var time = appt.confirmed_time ? formatTime12(appt.confirmed_time) : 'TBD';
                        var entry = document.createElement('div');
                        entry.className = 'history-entry';
                        entry.innerHTML =
                            '<div class="history-meta">' +
                                '<span class="history-date">' + escapeHtml(date) + '</span>' +
                                '<span class="history-time">' + escapeHtml(time) + '</span>' +
                                '<span class="service-badge">' + escapeHtml(appt.service || 'N/A') + '</span>' +
                                '<span class="status-badge status-' + escapeHtml(appt.status || '') + '">' + escapeHtml(appt.status || '') + '</span>' +
                            '</div>' +
                            (appt.message ? '<p class="history-notes">' + escapeHtml(appt.message) + '</p>' : '');
     historyEl.appendChild(entry);
                    });
                    historyEl.setAttribute('data-loaded', 'true');
                    return;
                }
            }
            historyEl.innerHTML = '<p class="history-empty">No booking history yet.</p>';
            historyEl.setAttribute('data-loaded', 'true');
            return;
        }
        historyEl.innerHTML = '';
        data.forEach(function(appt) {
            var date = appt.requested_date ? new Date(appt.requested_date + 'T00:00:00').toLocaleDateString() : 'N/A';
            var time = appt.confirmed_time ? formatTime12(appt.confirmed_time) : 'TBD';
            var entry = document.createElement('div');
            entry.className = 'history-entry';
            entry.innerHTML =
                '<div class="history-meta">' +
                    '<span class="history-date">' + escapeHtml(date) + '</span>' +
                    '<span class="history-time">' + escapeHtml(time) + '</span>' +
                    '<span class="service-badge">' + escapeHtml(appt.service || 'N/A') + '</span>' +
                    '<span class="status-badge status-' + escapeHtml(appt.status || '') + '">' + escapeHtml(appt.status || '') + '</span>' +
                '</div>' +
                (appt.message ? '<p class="history-notes">' + escapeHtml(appt.message) + '</p>' : '');
            historyEl.appendChild(entry);
        });
        historyEl.setAttribute('data-loaded', 'true');
    }

    // --- Scheduler Calendar ---
    async function fetchSchedulerData(weekStartOverride, weekEndOverride) {
        var startStr, endStr;
        if (weekStartOverride && weekEndOverride) {
            startStr = weekStartOverride.toISOString().split('T')[0];
            endStr = weekEndOverride.toISOString().split('T')[0];
        } else {
            startStr = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).toISOString().split('T')[0];
            endStr = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).toISOString().split('T')[0];
        }
        var blockedRes = await db.from('blocked_slots').select('*').gte('date', startStr).lte('date', endStr);
        blockedSlotsData = blockedRes.data || [];
        var leadsRes = await db.from('leads').select('*').gte('requested_date', startStr).lte('requested_date', endStr);
        dailyLeads = leadsRes.data || [];
        confirmedDates = {};
        pendingDates = {};
        dailyLeads.forEach(function(l) {
            if (l.status === 'confirmed' || l.status === 'completed') {
                confirmedDates[l.requested_date] = (confirmedDates[l.requested_date] || 0) + 1;
            } else if (l.status === 'pending' || l.status === 'new_lead') {
                pendingDates[l.requested_date] = (pendingDates[l.requested_date] || 0) + 1;
            }
        });
        blockedDates = {};
        blockedSlotsData.forEach(function(s) {
            var d = s.date;
            if (!blockedDates[d]) blockedDates[d] = { is_full_day: false, has_partial: false };
            if (s.is_full_day) blockedDates[d].is_full_day = true;
            else blockedDates[d].has_partial = true;
        });
    }

    function generateCalendarDays(month, year) {
        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var today = new Date().toISOString().split('T')[0];
        var html = '';
        for (var i = 0; i < firstDay; i++) {
            html += '<div class="calendar-day empty-day"></div>';
        }
        for (var day = 1; day <= daysInMonth; day++) {
            var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            var blocked = blockedDates[dateStr];
            var classes = ['calendar-day'];
            if (dateStr === today) classes.push('today');
            if (blocked) {
                if (blocked.is_full_day) classes.push('fully-blocked');
                else if (blocked.has_partial) classes.push('partially-blocked');
            }
            var indicators = '<div class="dot-container">';
            if (confirmedDates[dateStr]) indicators += '<span class="scheduler-dot confirmed-dot" title="Confirmed appointments"></span>';
            if (pendingDates[dateStr]) indicators += '<span class="scheduler-dot pending-dot" title="Pending requests"></span>';
            indicators += '</div>';
            html += '<div class="' + classes.join(' ') + '" data-date="' + dateStr + '"><span class="day-number">' + day + '</span>' + indicators + '</div>';
        }
        return html;
    }

    function timeToIdx(timeStr) {
        if (!timeStr) return 0;
        var parts = timeStr.split(':').map(Number);
        return (parts[0] - STUDIO_START_HOUR) * 2 + (parts[1] >= 30 ? 1 : 0);
    }

    function scrollToTimeGrid() {
        var grid = document.querySelector('.time-grid');
        if (!grid) return;
        var appts = grid.querySelectorAll('.day-appt-card');
        if (appts.length) {
            var first = appts[0];
            var top = parseInt(first.style.top) || 0;
            var gridRect = grid.getBoundingClientRect();
            var scrollTarget = grid.scrollTop + top - gridRect.top - gridRect.height / 3;
            grid.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
        } else {
            grid.scrollTop = 0;
        }
    }

    function showBlockTimeButton() {
        var btn = document.getElementById('newApptBtn');
        if (btn) btn.style.display = 'inline-block';
    }

    function hideBlockTimeButton() {
        var btn = document.getElementById('newApptBtn');
        if (btn) btn.style.display = 'none';
    }

    async function renderScheduler() {
        var schedulerLoading = document.getElementById('schedulerLoading');
        var schedulerContainer = document.getElementById('schedulerContainer');
        if (schedulerLoading) schedulerLoading.style.display = 'block';
        if (schedulerContainer) schedulerContainer.style.display = 'none';
        
        try {
            if (schedulerViewMode === 'month') await renderMonthlyView();
            else if (schedulerViewMode === 'week') await renderWeeklyView();
            else if (schedulerViewMode === 'day') await renderDailyView();
        } finally {
            if (schedulerLoading) schedulerLoading.style.display = 'none';
            if (schedulerContainer) schedulerContainer.style.display = 'block';
        }
    }

    async function renderMonthlyView() {
        await fetchSchedulerData();
        var container = document.getElementById('schedulerContainer');
        var year = calendarDate.getFullYear();
        var month = calendarDate.getMonth();
        var monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarDate);
        var todayStr = new Date().toISOString().split('T')[0];
        var html = '<div class="scheduler-header">' +
            '<div class="scheduler-nav">' +
                '<button class="nav-btn" id="schedPrevMonth">&#8249;</button>' +
                '<span class="scheduler-month-label">' + monthName + '</span>' +
                '<button class="nav-btn" id="schedNextMonth">&#8250;</button>' +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 8px;">' +
                '<button class="sched-today-btn" id="schedTodayMonth">Today</button>' +
                '<div class="view-toggle">' +
                    '<button class="view-btn active" data-view="month">Month</button>' +
                    '<button class="view-btn" data-view="week">Week</button>' +
                    '<button class="view-btn" data-view="day">Day</button>' +
                '</div>' +
            '</div>' +
        '</div><div class="scheduler-grid">' +
            '<div class="scheduler-day-header">Sun</div><div class="scheduler-day-header">Mon</div>' +
            '<div class="scheduler-day-header">Tue</div><div class="scheduler-day-header">Wed</div>' +
            '<div class="scheduler-day-header">Thu</div><div class="scheduler-day-header">Fri</div>' +
            '<div class="scheduler-day-header">Sat</div>' + generateCalendarDays(month, year) + '</div>';
        html += '<div class="scheduler-legend">' +
            '<span class="legend-item"><span class="scheduler-dot confirmed-dot"></span> Confirmed</span>' +
            '<span class="legend-item"><span class="scheduler-dot pending-dot"></span> Pending</span>' +
            '<span class="legend-item"><span class="scheduler-dot blocked-dot"></span> Blocked</span>' +
        '</div>';
        container.innerHTML = html;

        document.getElementById('schedPrevMonth').onclick = function() { calendarDate.setMonth(calendarDate.getMonth() - 1); renderScheduler(); };
        document.getElementById('schedNextMonth').onclick = function() { calendarDate.setMonth(calendarDate.getMonth() + 1); renderScheduler(); };
        var todayMonthBtn = document.getElementById('schedTodayMonth');
        if (todayMonthBtn) {
            todayMonthBtn.onclick = function() {
                dayDate = new Date();
                schedulerViewMode = 'day';
                container.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
                container.querySelector('.view-btn[data-view="day"]')?.classList.add('active');
                renderScheduler();
                setTimeout(scrollToTimeGrid, 100);
            };
        }

        container.querySelectorAll('.calendar-day[data-date]').forEach(function(cell) {
            cell.onclick = function() {
                dayDate = new Date(cell.dataset.date + 'T00:00:00');
                schedulerViewMode = 'day';
                container.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
                container.querySelector('.view-btn[data-view="day"]')?.classList.add('active');
                renderScheduler();
                setTimeout(scrollToTimeGrid, 100);
            };
        });

        container.querySelectorAll('.view-btn').forEach(function(btn) {
            btn.onclick = function() {
                container.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                schedulerViewMode = btn.dataset.view;
                renderScheduler();
            };
        });

        hideBlockTimeButton();
    }

    async function renderWeeklyView() {
        await fetchSchedulerData(weekStartDate, new Date(weekStartDate.getTime() + 6 * 86400000));
        var container = document.getElementById('schedulerContainer');
        var weekEnd = new Date(weekStartDate.getTime() + 6 * 86400000);
        var startLabel = weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        var endLabel = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      var html = '<div class="scheduler-header">' +
                '<div class="scheduler-nav">' +
                    '<button class="nav-btn" id="schedPrevWeek">&#8249;</button>' +
                    '<span class="scheduler-month-label">Week of ' + startLabel + ' - ' + endLabel + '</span>' +
                    '<button class="nav-btn" id="schedNextWeek">&#8250;</button>' +
                '</div>' +
                '<div style="display: flex; align-items: center; gap: 8px;">' +
                    '<button class="sched-today-btn" id="schedTodayWeek">Today</button>' +
                    '<div class="view-toggle">' +
                        '<button class="view-btn" data-view="month">Month</button>' +
                        '<button class="view-btn active" data-view="week">Week</button>' +
                        '<button class="view-btn" data-view="day">Day</button>' +
                    '</div>' +
                '</div>' +
            '</div><div class="week-grid">';
        for (var d = 0; d < 7; d++) {
            var curDate = new Date(weekStartDate.getTime() + d * 86400000);
            var dateStr = curDate.toISOString().split('T')[0];
            var dayName = curDate.toLocaleDateString('en-US', { weekday: 'short' });
            var dayNum = curDate.getDate();
            var blocked = blockedDates[dateStr];
            var indicators = '<div class="week-indicators">';
            if (confirmedDates[dateStr]) indicators += '<span class="scheduler-dot confirmed-dot" title="Confirmed"></span>';
            if (pendingDates[dateStr]) indicators += '<span class="scheduler-dot pending-dot" title="Pending"></span>';
            if (blocked) {
                if (blocked.is_full_day) indicators += '<span class="scheduler-dot blocked-dot" title="Blocked"></span>';
                else if (blocked.has_partial) indicators += '<span class="scheduler-dot blocked-dot" title="Partial block"></span>';
            }
            indicators += '</div>';
            var today = new Date().toISOString().split('T')[0];
            var dateCls = dateStr === today ? ' week-today' : '';
            var colHtml = '<div class="week-column" data-date="' + dateStr + '">' +
                '<div class="week-column-header"><span class="week-day-name">' + dayName + '</span>' +
                '<span class="week-day-num' + dateCls + '">' + dayNum + '</span></div>' + indicators;
            var dayLeads = (dailyLeads || []).filter(function(l) { return l.requested_date === dateStr && l.status !== 'deleted'; });
            if (blocked && blocked.is_full_day) {
                colHtml += '<div class="full-day-block-label">FULLY BLOCKED</div>';
            }
            dayLeads.forEach(function(lead) {
                var timeStr = lead.requested_time ? formatTime12(lead.requested_time) : '';
                var dur = parseInt(lead.duration_minutes) || 60;
                var durLabel = dur >= 60 ? Math.round(dur / 60) + 'hr' : dur + 'min';
                colHtml += '<div class="appt-card" data-action="edit-appt" data-id="' + lead.id + '">' +
                    '<div class="appt-time">' + escapeHtml(timeStr) + '</div>' +
                    '<div class="appt-client">' + escapeHtml(lead.name || 'Unknown') + '</div>' +
                    '<div class="appt-service">' + escapeHtml(lead.service || '') + '</div>' +
                    '<span class="appt-duration">' + durLabel + '</span>' +
                    '<span class="status-badge status-' + escapeHtml(lead.status) + '" style="font-size:0.65rem;padding:1px 4px;">' + escapeHtml(lead.status) + '</span>' +
                '</div>';
            });
            if (dayLeads.length) {
                colHtml += '<a class="view-day-link" data-date="' + dateStr + '">View Day &#8250;</a>';
            }
            colHtml += '</div>';
            html += colHtml;
        }
        html += '</div>';
        container.innerHTML = html;

        document.getElementById('schedPrevWeek').onclick = function() { weekStartDate.setDate(weekStartDate.getDate() - 7); renderScheduler(); };
        document.getElementById('schedNextWeek').onclick = function() { weekStartDate.setDate(weekStartDate.getDate() + 7); renderScheduler(); };
        var todayWeekBtn = document.getElementById('schedTodayWeek');
        if (todayWeekBtn) {
            todayWeekBtn.onclick = function() {
                weekStartDate = new Date();
                renderScheduler();
            };
        }

        container.querySelectorAll('.week-column').forEach(function(col) {
            col.onclick = function(e) {
                if (e.target.closest('.view-day-link')) return;
                dayDate = new Date(col.dataset.date + 'T00:00:00');
                schedulerViewMode = 'day';
                container.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
                container.querySelector('.view-btn[data-view="day"]')?.classList.add('active');
                renderScheduler();
                setTimeout(scrollToTimeGrid, 100);
            };
        });

        container.querySelectorAll('.view-day-link').forEach(function(link) {
            link.onclick = function(e) {
                e.preventDefault();
                dayDate = new Date(link.dataset.date + 'T00:00:00');
                schedulerViewMode = 'day';
                container.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
                container.querySelector('.view-btn[data-view="day"]')?.classList.add('active');
                renderScheduler();
                setTimeout(scrollToTimeGrid, 100);
            };
        });

        container.querySelectorAll('.view-btn').forEach(function(btn) {
            btn.onclick = function() {
                container.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                schedulerViewMode = btn.dataset.view;
                renderScheduler();
            };
        });

        setupDayViewEvents(container);
        hideBlockTimeButton();
    }

    async function renderDailyView() {
        await fetchSchedulerData(dayDate, dayDate);
        var container = document.getElementById('schedulerContainer');
        var dateStr = dayDate.toISOString().split('T')[0];
        var headerDate = dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
var html = '<div class="scheduler-header">' +
                '<div class="scheduler-nav">' +
                    '<button class="nav-btn" id="schedPrevDay">&#8249;</button>' +
                    '<span class="scheduler-month-label">' + headerDate + '</span>' +
                    '<button class="nav-btn" id="schedNextDay">&#8250;</button>' +
                '</div>' +
                '<div style="display: flex; align-items: center; gap: 8px;">' +
                    '<button class="sched-today-btn" id="schedTodayDay">Today</button>' +
                    '<div class="view-toggle">' +
                        '<button class="view-btn" data-view="month">Month</button>' +
                        '<button class="view-btn" data-view="week">Week</button>' +
                        '<button class="view-btn active" data-view="day">Day</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        html += '<button class="admin-btn" id="blockDayBtn">Block Time</button>';
        var blocked = blockedDates[dateStr];
        if (blocked && blocked.is_full_day) {
            html += '<div class="full-day-block-banner"><strong>FULLY BLOCKED</strong>' +
                '<button class="remove-full-day-block-btn" data-date="' + dateStr + '">Remove Block</button></div>';
        } else if (blocked && blocked.has_partial) {
            html += '<div class="partial-block-banner">Partial block today - click Block Time to add/remove</div>';
        }
       html += '<div class="time-grid-content">';
        for (var i = 0; i < (STUDIO_END_HOUR - STUDIO_START_HOUR) * 2; i++) {
            var h = STUDIO_START_HOUR + Math.floor(i / 2);
            var m = (i % 2) * 30;
            var displayH = h > 12 ? h - 12 : h;
            var ampm = h >= 12 ? 'PM' : 'AM';
            var timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
            html += '<div class="time-slot" data-time="' + timeStr + '">' +
                '<span class="time-slot-label">' + displayH + ':' + String(m).padStart(2, '0') + ' ' + ampm + '</span>' +
                '<span class="time-slot-click"></span>' +
            '</div>';
        }
        var dayLeads = (dailyLeads || []).filter(function(l) { return l.requested_date === dateStr && l.status !== 'deleted'; });
        var apptCards = '';
        dayLeads.forEach(function(lead) {
            var startIdx = timeToIdx(lead.requested_time);
            var dur = parseInt(lead.duration_minutes) || 60;
            var rowDur = Math.ceil(dur / 30);
            var topPos = startIdx * 48;
            var cardHeight = rowDur * 48;
            var durLabel = dur >= 60 ? Math.round(dur / 60) + 'hr' : dur + 'min';
            apptCards += '<div class="appt-card day-appt-card" data-action="edit-appt" data-id="' + lead.id + '" style="top:' + topPos + 'px;height:' + cardHeight + 'px;">' +
                '<div class="appt-time">' + (lead.requested_time ? formatTime12(lead.requested_time) : '') + '</div>' +
                '<div class="appt-details">' +
                    '<div class="appt-client">' + escapeHtml(lead.name || 'Unknown') + '</div>' +
                    '<div class="appt-service">' + escapeHtml(lead.service || '') + (lead.size ? ' - ' + escapeHtml(lead.size) : '') + '</div>' +
                    '<span class="appt-duration">' + durLabel + '</span>' +
                    (lead.message ? '<div class="appt-message">' + escapeHtml(lead.message) + '</div>' : '') +
                    '<span class="status-badge status-' + escapeHtml(lead.status) + '">' + escapeHtml(lead.status) + '</span>' +
                '</div>' +
            '</div>';
        });
        html += '<div class="appt-overlay">' + apptCards + '</div></div>';
        var pendingLeads = (dailyLeads || []).filter(function(l) { return l.requested_date === dateStr && (l.status === 'pending' || l.status === 'new_lead'); });
        if (pendingLeads.length) {
            html += '<div class="day-pending-section"><h3>Pending Requests for ' + dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</h3>';
            pendingLeads.forEach(function(lead) {
                html += '<div class="pending-request-card">' +
                    '<div class="pending-header"><strong>' + escapeHtml(lead.name || 'Unknown') + '</strong>' +
                    '<span class="status-badge status-new_lead">New Lead</span></div>' +
                    '<div class="pending-details">' +
                        '<div>' + escapeHtml(lead.service || '') + ' - ' + escapeHtml(lead.size || '-') + '</div>' +
                        (lead.message ? '<div class="pending-message">"' + escapeHtml(lead.message) + '"</div>' : '') +
                        '<div class="pending-actions">' +
                            '<button class="admin-btn-outline" data-action="confirm-pending" data-id="' + lead.id + '">Confirm</button>' +
                        '</div>' +
                    '</div></div>';
            });
            html += '</div>';
        }
        container.innerHTML = html;

        document.getElementById('schedPrevDay').onclick = function() { dayDate.setDate(dayDate.getDate() - 1); renderScheduler(); };
        document.getElementById('schedNextDay').onclick = function() { dayDate.setDate(dayDate.getDate() + 1); renderScheduler(); };
        var todayDayBtn = document.getElementById('schedTodayDay');
        if (todayDayBtn) {
            todayDayBtn.onclick = function() {
                dayDate = new Date();
                renderScheduler();
                setTimeout(scrollToTimeGrid, 100);
            };
        }

        var blockBtn = document.getElementById('blockDayBtn');
        if (blockBtn) {
            blockBtn.onclick = function() {
                document.getElementById('blockTimePopover').dataset.date = dateStr;
                openBlockPopover(dateStr);
            };
        }

        container.querySelectorAll('.view-btn').forEach(function(btn) {
            btn.onclick = function() {
                container.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                schedulerViewMode = btn.dataset.view;
                renderScheduler();
            };
        });

        setupDayViewEvents(container);
        showBlockTimeButton();
    }

    function setupDayViewEvents(container) {
        if (container._dayEventsAttached) return;
        container._dayEventsAttached = true;
            container.addEventListener('click', function(e) {
            var apptCard = e.target.closest('.appt-card[data-action="edit-appt"]');
            if (apptCard) { openEditApptPopover(apptCard.dataset.id); return; }
            var timeSlot = e.target.closest('.time-slot');
            if (timeSlot) {
                var timeStr = timeSlot.dataset.time;
                var dateStr = dayDate.toISOString().split('T')[0];
                openNewApptFromTimeSlot(dateStr, timeStr);
                return;
            }
            var blockBar = e.target.closest('.blocked-slot-bar[data-action="delete-block"]');
            if (blockBar) {
                e.stopPropagation();
                showConfirm('Remove this blocked time slot?').then(function(ok) {
                    if (!ok) return;
                    db.from('blocked_slots').delete().eq('id', blockBar.dataset.blockId).then(function() {
                        renderScheduler();
                        showToast('Block removed.', 'success');
                    });
                });
                return;
            }
            var removeBlockBtn = e.target.closest('.remove-full-day-block-btn');
            if (removeBlockBtn) {
                var date = removeBlockBtn.dataset.date;
                var slot = blockedSlotsData.find(function(s) { return s.date === date && s.is_full_day; });
                if (slot) {
                    db.from('blocked_slots').delete().eq('id', slot.id).then(function() {
                        renderScheduler();
                        showToast('Full-day block removed.', 'success');
                    });
                }
            }
        });
    }

    async function openNewApptFromTimeSlot(dateStr, timeStr) {
        await loadClients();
        var modal = document.getElementById('newApptModal');
        modal.style.display = 'block';
        setupModalFocus(modal);
        var dateInput = document.getElementById('newApptDate');
        var timeInput = document.getElementById('newApptTime');
        var timeSection = document.getElementById('newApptTimeSection');
        initNewApptPickers();
        dateInput.value = dateStr;
        newApptCalendarPicker.setSelectedDate(dateStr);
        newApptCalendarPicker.render();
        timeInput.value = timeStr;
        timeSection.style.display = 'block';
        newApptSelectedTime = timeStr;
        await showNewApptTimePicker(dateStr);
        var retryCount = 0;
        var highlightBtn = function() {
            var btn = document.querySelector('#newApptTimeGrid .time-slot-btn[data-time="' + timeStr + '"]');
            if (btn) {
                if (!btn.disabled) {
                    btn.style.background = 'var(--primary)';
                    btn.style.borderColor = 'var(--primary)';
                    btn.style.color = '#fff';
                    newApptSelectedTime = timeStr;
                    document.getElementById('newApptTime').value = timeStr;
                }
                return;
            }
            retryCount++;
            if (document.querySelector('#newApptTimeGrid') && retryCount < 20) {
                setTimeout(highlightBtn, 200);
            }
        };
        setTimeout(highlightBtn, 100);
    }

    // --- Block Time Popover ---
    function openBlockPopover(dateStr) {
        var popover = document.getElementById('blockTimePopover');
        document.getElementById('blockType').value = 'range';
        document.getElementById('timeRangeInputs').style.display = 'block';
        document.getElementById('blockNote').value = '';
        populateTimeSelects('blockStart', STUDIO_START_HOUR, STUDIO_END_HOUR);
        populateTimeSelects('blockEnd', STUDIO_START_HOUR, STUDIO_END_HOUR);
        popover.dataset.date = dateStr;
        popover.style.display = 'flex';
    }

    document.getElementById('saveBlockBtn').addEventListener('click', async function() {
        var date = document.getElementById('blockTimePopover').dataset.date;
        var type = document.getElementById('blockType').value;
        var note = document.getElementById('blockNote').value;
        var payload = { date: date, is_full_day: type === 'full', note: note || null };
        if (type === 'range') {
            payload.start_time = document.getElementById('blockStart').value + ':00';
            payload.end_time = document.getElementById('blockEnd').value + ':00';
        }
        var saveBtn = document.getElementById('saveBlockBtn');
        var originalText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
        try {
            await db.from('blocked_slots').insert([payload]);
            document.getElementById('blockTimePopover').style.display = 'none';
            renderScheduler();
            showToast('Block saved!', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
        }
    });

    document.getElementById('cancelBlockBtn').addEventListener('click', function() {
        document.getElementById('blockTimePopover').style.display = 'none';
    });

    function populateTimeSelects(selectId, startHour, endHour) {
        var select = document.getElementById(selectId);
        select.innerHTML = '';
        for (var h = startHour; h <= endHour; h++) {
            for (var m = 0; m < 60; m += 30) {
                if (h === endHour && m > 0) continue;
                var timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
                var opt = document.createElement('option');
                opt.value = timeStr;
                opt.textContent = formatTime12(timeStr);
                select.appendChild(opt);
            }
        }
    }

    // --- Edit Appointment Popover ---
    function openEditApptPopover(id) {
        var lead = dailyLeads.find(function(l) { return l.id === id; });
        if (!lead) return;
        activeLeadId = id;
        document.getElementById('editApptId').value = id;
        document.getElementById('editApptService').textContent = lead.service || '-';
        document.getElementById('editApptSize').textContent = lead.size || '-';
        var dateStr = lead.requested_date ? new Date(lead.requested_date + 'T00:00:00').toLocaleDateString() : 'N/A';
        var timeStr = lead.requested_time ? formatTime12(lead.requested_time) : 'N/A';
        document.getElementById('editApptDateTime').textContent = dateStr + ' ' + timeStr;
        document.getElementById('editApptMessage').textContent = lead.message || 'No customer notes';
        document.getElementById('editApptDuration').value = lead.duration_minutes || 60;
        document.getElementById('editApptStatus').value = lead.status || 'pending';
        populateTimeSelects('editApptTime', STUDIO_START_HOUR, STUDIO_END_HOUR);
        document.getElementById('editApptPopover').style.display = 'flex';
    }

    // --- Save Appointment Handler ---
    document.getElementById('saveApptBtn').addEventListener('click', async function() {
        var id = document.getElementById('editApptId').value;
        var confirmedTime = document.getElementById('editApptTime').value;
        var duration = parseInt(document.getElementById('editApptDuration').value) || 60;
        var status = document.getElementById('editApptStatus').value;
        if (status === 'cancelled') {
            var ok = await showConfirm('Cancel this appointment?');
            if (!ok) return;
        }
        var startMin = timeToIdx(confirmedTime) * 30 + 480;
        var endMin = startMin + duration;
        var activeLeads = (dailyLeads || []).filter(function(l) { return l.requested_date === dayDate.toISOString().split('T')[0] && l.status !== 'deleted' && l.id !== id; });
        for (var i = 0; i < activeLeads.length; i++) {
            if (activeLeads[i].requested_time) {
                var lStart = timeToIdx(activeLeads[i].requested_time) * 30 + 480;
                var lEnd = lStart + (parseInt(activeLeads[i].duration_minutes) || 60);
                if (startMin < lEnd && endMin > lStart) {
                    showToast('Time conflict with ' + (activeLeads[i].name || 'another appointment') + ' at ' + formatTime12(activeLeads[i].requested_time), 'error');
                    return;
                }
            }
        }
        var saveBtn = document.getElementById('saveApptBtn');
        var originalText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
        try {
            await db.from('leads').update({
                confirmed_time: confirmedTime + ':00',
                duration_minutes: duration,
                status: status
            }).eq('id', id);
            document.getElementById('editApptPopover').style.display = 'none';
            renderScheduler();
            fetchLeads();
            showToast('Appointment updated!', 'success');
            if (status === 'confirmed') {
                var lead = leads.find(function(l) { return l.id === id; });
                if (lead) triggerConfirmedEmail(lead);
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
        }
    });

    document.getElementById('closeApptPopover').addEventListener('click', function() {
        document.getElementById('editApptPopover').style.display = 'none';
    });

    // --- New Appointment Modal ---
    var newApptSelectedTime = null;

    document.getElementById('newApptBtn').addEventListener('click', async function() {
        await loadClients();
        var modal = document.getElementById('newApptModal');
        modal.style.display = 'block';
        setupModalFocus(modal);
        document.getElementById('newApptDate').value = '';
        document.getElementById('newApptTime').value = '';
        document.getElementById('newApptTimeSection').style.display = 'none';
        initNewApptPickers();
    });

    document.getElementById('closeNewApptModal').addEventListener('click', function() {
        document.getElementById('newApptModal').style.display = 'none';
    });

    function initNewApptPickers() {
        newApptSelectedTime = null;
        document.getElementById('newApptDate').value = '';
        document.getElementById('newApptTime').value = '';
        document.getElementById('newApptTimeSection').style.display = 'none';

        newApptCalendarPicker = createCalendarPicker({
            gridId: 'newApptCalendarGrid',
            monthYearId: 'newApptCalMonthYear',
            prevBtnId: 'newApptPrevMonth',
            nextBtnId: 'newApptNextMonth',
            pickerDate: new Date(),
            blockedDates: new Set(),
            blockedDayOfWeek: [],
            selectedDate: null,
            onSelectDate: function(dateStr) {
                document.getElementById('newApptDate').value = dateStr;
                showNewApptTimePicker(dateStr);
            }
        });

        document.getElementById('newApptPrevMonth').onclick = function() {
            newApptCalendarPicker.setPickerMonth(newApptCalendarPicker.getPickerMonth() - 1);
            newApptCalendarPicker.render();
        };
        document.getElementById('newApptNextMonth').onclick = function() {
            newApptCalendarPicker.setPickerMonth(newApptCalendarPicker.getPickerMonth() + 1);
            newApptCalendarPicker.render();
        };

        var newApptSize = document.getElementById('newApptSize');
        var newApptService = document.getElementById('newApptService');
        if (newApptSize) newApptSize.onchange = function() {
            if (document.getElementById('newApptDate').value) showNewApptTimePicker(document.getElementById('newApptDate').value);
        };
        if (newApptService) newApptService.onchange = function() {
            if (document.getElementById('newApptDate').value) showNewApptTimePicker(document.getElementById('newApptDate').value);
        };

        newApptCalendarPicker.render();
    }

    async function showNewApptTimePicker(dateStr) {
        if (!dateStr) return;
        var section = document.getElementById('newApptTimeSection');
        section.style.display = 'block';
        newApptSelectedTime = null;
        document.getElementById('newApptTime').value = '';
        document.getElementById('newApptUnavailableMsg').style.display = 'none';

        var service = document.getElementById('newApptService').value;
        var size = document.getElementById('newApptSize').value;

        var slotsHtml = '';
        var serviceMap = {
            'Small Tattoo': 'Small Tattoo', 'Medium Tattoo': 'Medium Tattoo', 'Large Tattoo': 'Large Tattoo',
            'Custom Design': 'Custom Design', 'Cover-Up': 'Cover-Up', 'Touch-Up': 'Touch-Up',
            'Flash Tattoo': 'Flash Tattoo', 'Consultation': 'Consultation'
        };
        var serviceKey = serviceMap[service] || 'Consultation';
        var duration = getSuggestedDuration(serviceKey, size, null);

        var startTime = STUDIO_START_HOUR * 60;
        var endTime = STUDIO_END_HOUR * 60;

        var leadsRes = await db.from('leads').select('*').eq('requested_date', dateStr);
        var blockedRes = await db.from('blocked_slots').select('*').eq('date', dateStr);

        var allLeads = (leadsRes.data || []).filter(function(l) { return l.status !== 'deleted'; });
        var allBlocked = (blockedRes.data || []).filter(function(b) { return !b.is_full_day; });

        var unavailable = buildUnavailableIntervals(allLeads, allBlocked, null);

        for (var t = startTime; t < endTime; t += 30) {
            var slotEnd = t + 30;
            if (slotEnd - duration > endTime) continue;
            var h = Math.floor(t / 60);
            var m = t % 60;
            var slotStart = t;
            var slotEndAbs = t + duration;
            var overlaps = false;
            for (var i = 0; i < unavailable.length; i++) {
                if (slotStart < unavailable[i].end && slotEndAbs > unavailable[i].start) {
                    overlaps = true;
                    break;
                }
            }
            var disabled = overlaps ? 'disabled' : '';
            var label = minutesToTime12(t);
            slotsHtml += '<button type="button" class="time-slot-btn ' + (disabled ? 'disabled' : '') + '" data-time="' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + '">' + label + '</button>';
        }

        var grid = document.getElementById('newApptTimeGrid');
        var msg = document.getElementById('newApptUnavailableMsg');
        if (!slotsHtml) {
            msg.style.display = 'block';
            grid.innerHTML = '';
        } else {
            msg.style.display = 'none';
            grid.innerHTML = slotsHtml;
            grid.querySelectorAll('.time-slot-btn:not(.disabled)').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    grid.querySelectorAll('.time-slot-btn').forEach(function(b) { b.style.background = ''; b.style.borderColor = ''; b.style.color = ''; });
                    btn.style.background = 'var(--primary)';
                    btn.style.borderColor = 'var(--primary)';
                    btn.style.color = '#fff';
                    newApptSelectedTime = btn.dataset.time;
                    document.getElementById('newApptTime').value = newApptSelectedTime;
                });
            });
        }
    }

    // --- New Appt Form Submit ---
    var newApptForm = document.getElementById('newApptForm');
    if (newApptForm) {
        newApptForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var confirmBtn = document.getElementById('confirmNewApptBtn');
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Creating...';
            try {
                var date = document.getElementById('newApptDate').value;
                var time = document.getElementById('newApptTime').value;
                if (!date || !time) {
                    showToast('Please select a date and time.', 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Confirm Appointment';
                    return;
                }
                var service = document.getElementById('newApptService').value;
                var size = document.getElementById('newApptSize').value;
                var duration = document.getElementById('newApptDuration').value;
                var durationMin = parseInt(duration);
                var clientId = document.getElementById('newApptClientId').value;
                var payload = {
                    service: service,
                    size: size,
                    body_placement: document.getElementById('newApptPlacement').value || null,
                    requested_date: date,
                    requested_time: time,
                    duration_minutes: durationMin,
                    message: document.getElementById('newApptMessage').value || null,
                    status: 'confirmed',
                    client_id: null,
                    profile_id: null
                };
                if (clientId) {
                    var clientRes = await db.from('clients').select('*').eq('id', clientId).single();
                    payload.client_id = clientRes.data.id;
                    payload.owner_name = clientRes.data.owner_name;
                    payload.phone = clientRes.data.phone;
                    payload.email = clientRes.data.email || null;
                } else {
                    payload.new_client = {
                        owner_name: 'Walk-in',
                        phone: 'N/A',
                        email: null
                    };
                }
                var resp = await fetch('/api/booking/create', {
                    method: 'POST',
                    headers: await getAuthHeaders(db),
                    body: JSON.stringify(payload)
                });
                var text;
                try {
                    text = await resp.text();
                } catch (e) {
                    throw new Error('Failed to read booking response.');
                }
                var result;
                try {
                    result = text ? JSON.parse(text) : {};
                } catch (e) {
                    throw new Error('Server returned an invalid response.');
                }
                if (!resp.ok) throw new Error(result.error || 'Booking failed');
                showToast('Appointment confirmed!', 'success');
                document.getElementById('newApptModal').style.display = 'none';
                renderScheduler();
                await fetchLeads();
                loadClients().then(renderClients);
            } catch (err) {
                showToast(err.message || 'Failed to create appointment.', 'error');
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm Appointment';
            }
        });
    }

    // --- Dashboard Stats ---
    function renderStats(data) {
        if (!statsRow) return;
        var pending = data.filter(function(l) { return l.status === 'pending'; }).length;
        var contacted = data.filter(function(l) { return l.status === 'contacted'; }).length;
        var confirmed = data.filter(function(l) { return l.status === 'confirmed'; }).length;
        var cancelled = data.filter(function(l) { return l.status === 'cancelled'; }).length;
        statsRow.innerHTML =
            '<div class="stat-card"><span class="stat-number">' + pending + '</span><span class="stat-label">Pending</span></div>' +
            '<div class="stat-card"><span class="stat-number">' + contacted + '</span><span class="stat-label">Contacted</span></div>' +
            '<div class="stat-card"><span class="stat-number">' + confirmed + '</span><span class="stat-label">Confirmed</span></div>' +
            '<div class="stat-card"><span class="stat-number">' + cancelled + '</span><span class="stat-label">Cancelled</span></div>';
    }

    // --- Confirmation Email ---
    function triggerConfirmedEmail(lead) {
        fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'appointment-confirmed',
                name: lead.client_name || lead.name,
                email: lead.email,
                service: lead.service,
                date: lead.requested_date,
                time: lead.requested_time
            })
        }).catch(function(err) { console.warn('Email failed:', err.message); });
    }

    // --- Search ---
    var clientSearch = document.getElementById('clientSearch');
    if (clientSearch && !clientSearch._listenerAttached) {
        clientSearch.addEventListener('input', function() { renderClients(); });
        clientSearch._listenerAttached = true;
    }

    // Leads search & status filter
    (function initLeadsSearch() {
        var leadsSearchInput = document.getElementById('leadsSearch');
        var leadsStatusFilterEl = document.getElementById('leadsStatusFilter');
        if (leadsSearchInput) {
            var searchTimeout;
            leadsSearchInput.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(function() { renderLeads(); }, 200);
            });
        }
        if (leadsStatusFilterEl) {
            leadsStatusFilterEl.addEventListener('change', function() { renderLeads(); });
        }
    })();

    // --- Site Management ---
    function isValidImageUrl(url) {
        if (!url || typeof url !== 'string' || !url.trim()) return false;
        try {
            var parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }

    function editGalleryItem(id) {
        var item = galleryItems.find(function(g) { return g.id == id; });
        if (!item) { showToast('Gallery item not found.', 'error'); return; }
        var modal = document.getElementById('addGalleryModal');
        if (!modal) return;
        document.getElementById('editGalleryId').value = item.id;
        document.getElementById('galleryImageUrl').value = item.image_url || '';
        document.getElementById('galleryTitle').value = item.title || '';
        document.getElementById('galleryDisplayOrder').value = item.display_order || '';
        document.getElementById('galleryIsActive').checked = !!item.is_active;
        document.getElementById('saveGalleryBtn').textContent = 'Update Item';
        modal.style.display = 'flex';
        setupModalFocus(modal);
    }

    var galleryItems = [];
    var flashItems = [];
    var reviewsData = [];
    var feedbackData = [];
    var siteMgmtActive = false;

    function initSiteMgmt() {
        var siteMgmtLoading = document.getElementById('siteMgmtLoading');
        if (siteMgmtLoading) siteMgmtLoading.style.display = 'block';
        var mgmtTabs = document.querySelector('.mgmt-tabs');
        var mgmtPanels = document.querySelectorAll('.mgmt-panel');
        if (mgmtTabs) mgmtTabs.style.display = 'none';
        mgmtPanels.forEach(function(p) { p.style.display = 'none'; });
        
        siteMgmtActive = true;
        Promise.all([
            loadGalleryItems(),
            loadFlashItems(),
            loadReviews(),
            loadFeedback()
        ]).finally(function() {
            if (!siteMgmtActive) return;
            if (siteMgmtLoading) siteMgmtLoading.style.display = 'none';
            if (mgmtTabs) mgmtTabs.style.display = 'flex';
            var activeTab = document.querySelector('.mgmt-tabs .tab-btn.active');
            if (activeTab) {
                var panelId = activeTab.dataset.tab + 'Tab';
                document.getElementById(panelId)?.classList.add('active');
            }
        });
    }

    // Gallery management
    async function loadGalleryItems() {
        var result = await db.from('gallery_items').select('*').order('display_order', { ascending: true });
        galleryItems = result.data || [];
        renderGalleryMgmt();
    }

    function renderGalleryMgmt() {
        var grid = document.getElementById('galleryMgmtGrid');
        grid.innerHTML = '';
        galleryItems.forEach(function(item) {
            var card = document.createElement('div');
            card.className = 'mgmt-card';
            var imgErrorId = 'galleryImg' + item.id;
            card.innerHTML =
                '<div class="mgmt-card-img">' +
                    '<img id="' + imgErrorId + '" src="' + escapeHtml(item.image_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
                    '<div id="broken-' + imgErrorId + '" class="broken-image-overlay" style="display:none;align-items:center;justify-content:center;height:100%;background:var(--bg-input);flex-direction:column;gap:6px;">' +
                        '<span style="font-size:28px;">&#x1F5BC;</span>' +
                        '<button class="mgmt-fix-url" data-id="' + item.id + '" style="font-size:12px;padding:4px 8px;">Fix URL</button>' +
                    '</div>' +
                '</div>' +
                '<div class="mgmt-card-body">' +
                    '<div class="mgmt-card-title">' + escapeHtml(item.title || '') + '</div>' +
                    '<div class="mgmt-card-desc">Order: ' + (item.display_order || 0) + ' | Active: ' + (item.is_active ? 'Yes' : 'No') + '</div>' +
                '</div>' +
                '<div class="card-actions-row">' +
                    '<button class="mgmt-move mgmt-move-up" data-id="' + item.id + '" title="Move up">&#9650;</button>' +
                    '<button class="mgmt-move mgmt-move-down" data-id="' + item.id + '" title="Move down">&#9660;</button>' +
                    '<button class="admin-btn-outline mgmt-edit-gallery" data-id="' + item.id + '">Edit</button>' +
                    '<button class="admin-btn delete mgmt-delete-gallery" data-id="' + item.id + '">Delete</button>' +
                '</div>';
            grid.appendChild(card);
        });
        attachGalleryMgmtEvents();
    }

    function attachGalleryMgmtEvents() {
        var grid = document.getElementById('galleryMgmtGrid');
        if (!grid || grid._delegationAttached) return;
        grid._delegationAttached = true;
        grid.addEventListener('click', async function(e) {
            var deleteBtn = e.target.closest('.mgmt-delete-gallery');
            if (deleteBtn) {
                var ok = await showConfirm('Delete this gallery item?');
                if (!ok) return;
                await db.from('gallery_items').delete().eq('id', deleteBtn.dataset.id);
                loadGalleryItems();
                showToast('Gallery item deleted.', 'success');
                return;
            }
            var editBtn = e.target.closest('.mgmt-edit-gallery');
            if (editBtn) {
                editGalleryItem(editBtn.dataset.id);
                return;
            }
            var fixBtn = e.target.closest('.mgmt-fix-url');
            if (fixBtn) {
                var newItem = galleryItems.find(function(g) { return g.id == fixBtn.dataset.id; });
                if (!newItem) return;
                var newUrl = prompt('Enter new image URL:', newItem.image_url);
                if (!newUrl || !newUrl.trim()) return;
                try {
                    await db.from('gallery_items').update({ image_url: newUrl.trim() }).eq('id', fixBtn.dataset.id);
                    loadGalleryItems();
                    showToast('URL updated.', 'success');
                } catch (err) {
                    showToast('Error: ' + err.message, 'error');
                }
                return;
            }
            var moveBtn = e.target.closest('.mgmt-move');
            if (moveBtn) {
                var dir = moveBtn.classList.contains('mgmt-move-up') ? 'up' : 'down';
                var item = galleryItems.find(function(g) { return g.id == moveBtn.dataset.id; });
                if (!item) return;
                var items = galleryItems.slice().sort(function(a,b) { return (a.display_order||0) - (b.display_order||0); });
                var curIdx = items.findIndex(function(x) { return x.id == item.id; });
                var swapIdx = dir === 'up' ? curIdx - 1 : curIdx + 1;
                if (swapIdx < 0 || swapIdx >= items.length) { showToast(dir === 'up' ? 'Already first.' : 'Already last.', 'info'); return; }
                var swapItem = items[swapIdx];
                try {
                    await Promise.all([
                        db.from('gallery_items').update({ display_order: swapItem.display_order }).eq('id', item.id),
                        db.from('gallery_items').update({ display_order: item.display_order }).eq('id', swapItem.id)
                    ]);
                    loadGalleryItems();
                    showToast('Item reordered.', 'success');
                } catch (err) {
                    showToast('Error: ' + err.message, 'error');
                }
                return;
            }
        });
    }

    document.getElementById('addGalleryItemBtn').addEventListener('click', function() {
        var modal = document.getElementById('addGalleryModal');
        if (!modal) return;
        document.getElementById('editGalleryId').value = '';
        document.getElementById('galleryImageUrl').value = '';
        document.getElementById('galleryTitle').value = '';
        document.getElementById('galleryDisplayOrder').value = '';
        document.getElementById('galleryIsActive').checked = true;
        document.getElementById('saveGalleryBtn').textContent = 'Save Item';
        modal.style.display = 'flex';
        setupModalFocus(modal);
    });

    // Flash management
    async function loadFlashItems() {
        var result = await db.from('flash_gallery').select('*').order('display_order', { ascending: true });
        flashItems = result.data || [];
        renderFlashMgmt();
    }

    function renderFlashMgmt() {
        var grid = document.getElementById('flashMgmtGrid');
        grid.innerHTML = '';
        flashItems.forEach(function(item) {
            var card = document.createElement('div');
            card.className = 'mgmt-card';
            var imgErrorId = 'flashImg' + item.id;
            card.innerHTML =
                '<div class="mgmt-card-img">' +
                    '<img id="' + imgErrorId + '" src="' + escapeHtml(item.image_url) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
                    '<div id="broken-' + imgErrorId + '" class="broken-image-overlay" style="display:none;align-items:center;justify-content:center;height:100%;background:var(--bg-input);flex-direction:column;gap:6px;">' +
                        '<span style="font-size:28px;">&#x1F5BC;</span>' +
                        '<button class="mgmt-fix-url" data-id="' + item.id + '" style="font-size:12px;padding:4px 8px;">Fix URL</button>' +
                    '</div>' +
                '</div>' +
                '<div class="mgmt-card-body">' +
                    '<div class="mgmt-card-title">' + escapeHtml(item.title || 'Flash') + '</div>' +
                    '<div class="flash-card-desc" style="font-size:0.85rem;color:var(--text-muted);">' + escapeHtml(item.description || '') + '</div>' +
                    (item.price ? '<div class="flash-card-price" style="margin-top:4px;">' + escapeHtml(item.price) + '</div>' : '') +
                    '<div class="mgmt-card-desc">Order: ' + (item.display_order || 0) + ' | Active: ' + (item.is_active ? 'Yes' : 'No') + '</div>' +
                '</div>' +
                '<div class="card-actions-row">' +
                    '<button class="mgmt-move mgmt-move-up" data-id="' + item.id + '" title="Move up">&#9650;</button>' +
                    '<button class="mgmt-move mgmt-move-down" data-id="' + item.id + '" title="Move down">&#9660;</button>' +
                    '<button class="admin-btn-outline mgmt-toggle-flash" data-id="' + item.id + '">' + (item.is_active ? 'Deactivate' : 'Activate') + '</button>' +
                    '<button class="admin-btn delete mgmt-delete-flash" data-id="' + item.id + '">Delete</button>' +
                '</div>';
            grid.appendChild(card);
        });
        attachFlashMgmtEvents();
    }

    function attachFlashMgmtEvents() {
        var grid = document.getElementById('flashMgmtGrid');
        if (!grid || grid._delegationAttached) return;
        grid._delegationAttached = true;
        grid.addEventListener('click', async function(e) {
            var deleteBtn = e.target.closest('.mgmt-delete-flash');
            if (deleteBtn) {
                var ok = await showConfirm('Delete this flash design?');
                if (!ok) return;
                await db.from('flash_gallery').delete().eq('id', deleteBtn.dataset.id);
                loadFlashItems();
                showToast('Flash design deleted.', 'success');
                return;
            }
            var toggleBtn = e.target.closest('.mgmt-toggle-flash');
            if (toggleBtn) {
                var ok = await showConfirm('Toggle flash design active status?');
                if (!ok) return;
                var item = flashItems.find(function(f) { return f.id == toggleBtn.dataset.id; });
                if (item) {
                    await db.from('flash_gallery').update({ is_active: !item.is_active }).eq('id', toggleBtn.dataset.id);
                    loadFlashItems();
                    showToast('Flash design updated.', 'success');
                }
                return;
            }
            var fixBtn = e.target.closest('.mgmt-fix-url');
            if (fixBtn) {
                var item = flashItems.find(function(f) { return f.id == fixBtn.dataset.id; });
                if (!item) return;
                var newUrl = prompt('Enter new image URL:', item.image_url);
                if (!newUrl || !newUrl.trim()) return;
                try {
                    await db.from('flash_gallery').update({ image_url: newUrl.trim() }).eq('id', fixBtn.dataset.id);
                    loadFlashItems();
                    showToast('URL updated.', 'success');
                } catch (err) {
                    showToast('Error: ' + err.message, 'error');
                }
                return;
            }
            var moveBtn = e.target.closest('.mgmt-move');
            if (moveBtn) {
                var dir = moveBtn.classList.contains('mgmt-move-up') ? 'up' : 'down';
                var item = flashItems.find(function(f) { return f.id == moveBtn.dataset.id; });
                if (!item) return;
                var items = flashItems.slice().sort(function(a,b) { return (a.display_order||0) - (b.display_order||0); });
                var curIdx = items.findIndex(function(x) { return x.id == item.id; });
                var swapIdx = dir === 'up' ? curIdx - 1 : curIdx + 1;
                if (swapIdx < 0 || swapIdx >= items.length) { showToast(dir === 'up' ? 'Already first.' : 'Already last.', 'info'); return; }
                var swapItem = items[swapIdx];
                try {
                    await Promise.all([
                        db.from('flash_gallery').update({ display_order: swapItem.display_order }).eq('id', item.id),
                        db.from('flash_gallery').update({ display_order: item.display_order }).eq('id', swapItem.id)
                    ]);
                    loadFlashItems();
                    showToast('Item reordered.', 'success');
                } catch (err) {
                    showToast('Error: ' + err.message, 'error');
                }
                return;
            }
        });
    }

    document.getElementById('addFlashBtn').addEventListener('click', function() {
        var modal = document.getElementById('addFlashModal');
        if (!modal) return;
        document.getElementById('editFlashId').value = '';
        document.getElementById('flashImageUrl').value = '';
        document.getElementById('flashTitle').value = '';
        document.getElementById('flashDescription').value = '';
        document.getElementById('flashPrice').value = '';
        document.getElementById('flashDisplayOrder').value = '';
        document.getElementById('flashIsActive').checked = true;
        document.getElementById('saveFlashBtn').textContent = 'Save Design';
        modal.style.display = 'flex';
        setupModalFocus(modal);
    });

    // Reviews management
    async function loadReviews() {
        var result = await db.from('reviews').select('*').order('display_order', { ascending: true });
        reviewsData = result.data || [];
        renderReviewsMgmt();
    }

    function renderReviewsMgmt() {
        var grid = document.getElementById('reviewsMgmtGrid');
        grid.innerHTML = '';
        reviewsData.forEach(function(item) {
            var card = document.createElement('div');
            card.className = 'mgmt-card';
            var filled = '\u2605'.repeat(item.rating || 5);
            var empty = '\u2606'.repeat(5 - (item.rating || 5));
            var starsHtml = '<span class="stars">' + filled + empty + '</span>';
            card.innerHTML =
                '<div class="mgmt-card-body">' +
                    '<div class="mgmt-card-title">' + escapeHtml(item.reviewer_name || 'Anonymous') + '</div>' +
                    '<p style="margin:8px 0;font-style:italic;">' + escapeHtml(item.review_text) + '</p>' +
                    '<div class="flash-card-desc">' + starsHtml + ' | Order: ' + (item.display_order || 0) + '</div>' +
                '</div>' +
                '<div class="card-actions-row">' +
                    '<button class="mgmt-move mgmt-move-up" data-id="' + item.id + '" title="Move up">&#9650;</button>' +
                    '<button class="mgmt-move mgmt-move-down" data-id="' + item.id + '" title="Move down">&#9660;</button>' +
                    '<button class="admin-btn-outline mgmt-toggle-review" data-id="' + item.id + '">' + (item.is_active ? 'Deactivate' : 'Activate') + '</button>' +
                    '<button class="admin-btn delete mgmt-delete-review" data-id="' + item.id + '">Delete</button>' +
                '</div>';
            grid.appendChild(card);
        });
        attachReviewsMgmtEvents();
    }

    function attachReviewsMgmtEvents() {
        var grid = document.getElementById('reviewsMgmtGrid');
        if (!grid || grid._delegationAttached) return;
        grid._delegationAttached = true;
        grid.addEventListener('click', async function(e) {
            var deleteBtn = e.target.closest('.mgmt-delete-review');
            if (deleteBtn) {
                var ok = await showConfirm('Delete this review?');
                if (!ok) return;
                await db.from('reviews').delete().eq('id', deleteBtn.dataset.id);
                loadReviews();
                showToast('Review deleted.', 'success');
                return;
            }
            var toggleBtn = e.target.closest('.mgmt-toggle-review');
            if (toggleBtn) {
                var ok = await showConfirm('Toggle review active status?');
                if (!ok) return;
                var review = reviewsData.find(function(r) { return r.id === toggleBtn.dataset.id; });
                if (review) {
                    await db.from('reviews').update({ is_active: !review.is_active }).eq('id', toggleBtn.dataset.id);
                    loadReviews();
                    showToast('Review updated.', 'success');
                }
                return;
            }
            var moveBtn = e.target.closest('.mgmt-move');
            if (moveBtn) {
                var dir = moveBtn.classList.contains('mgmt-move-up') ? 'up' : 'down';
                var item = reviewsData.find(function(r) { return r.id == moveBtn.dataset.id; });
                if (!item) return;
                var items = reviewsData.slice().sort(function(a,b) { return (a.display_order||0) - (b.display_order||0); });
                var curIdx = items.findIndex(function(x) { return x.id == item.id; });
                var swapIdx = dir === 'up' ? curIdx - 1 : curIdx + 1;
                if (swapIdx < 0 || swapIdx >= items.length) { showToast(dir === 'up' ? 'Already first.' : 'Already last.', 'info'); return; }
                var swapItem = items[swapIdx];
                try {
                    await Promise.all([
                        db.from('reviews').update({ display_order: swapItem.display_order }).eq('id', item.id),
                        db.from('reviews').update({ display_order: item.display_order }).eq('id', swapItem.id)
                    ]);
                    loadReviews();
                    showToast('Review reordered.', 'success');
                } catch (err) {
                    showToast('Error: ' + err.message, 'error');
                }
                return;
            }
        });
    }

    document.getElementById('addReviewBtn').addEventListener('click', function() {
        var modal = document.getElementById('addReviewModal');
        if (!modal) return;
        document.getElementById('editReviewId').value = '';
        document.getElementById('reviewName').value = '';
        document.getElementById('reviewText').value = '';
        document.getElementById('reviewDisplayOrder').value = '';
        document.getElementById('reviewIsActive').checked = true;
        document.getElementById('saveReviewBtn').textContent = 'Save Review';
        setReviewStars(5);
        modal.style.display = 'flex';
        setupModalFocus(modal);
    });

    // Feedback management
    async function loadFeedback() {
        var result = await db.from('site_feedback').select('*').neq('deleted', true).order('created_at', { ascending: false });
        feedbackData = result.data || [];
        renderFeedback();
    }

    function renderFeedback() {
        var tbody = document.getElementById('feedbackTableBody');
        tbody.innerHTML = '';
        feedbackData.forEach(function(item) {
            var tr = document.createElement('tr');
            var date = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A';
            var statusBadge = item.is_deleted ? '<span class="status-badge" style="background:#6b7280;">Deleted</span>' : '';
            tr.innerHTML =
                '<td>' + escapeHtml(date) + '</td>' +
                '<td><span class="status-badge status-' + escapeHtml(item.priority) + '">' + escapeHtml(item.priority) + '</span></td>' +
                '<td>' + escapeHtml(item.comment || '') + '</td>' +
                '<td><button class="admin-btn delete mgmt-delete-feedback" data-id="' + item.id + '">Soft Delete</button></td>';
            tbody.appendChild(tr);
        });
        attachFeedbackMgmtEvents();
    }

    function attachFeedbackMgmtEvents() {
        var tbody = document.getElementById('feedbackTableBody');
        if (!tbody || tbody._delegationAttached) return;
        tbody._delegationAttached = true;
        tbody.addEventListener('click', async function(e) {
            var deleteBtn = e.target.closest('.mgmt-delete-feedback');
            if (deleteBtn) {
                var ok = await showConfirm('Soft-delete this feedback? It will be hidden from the active list but preserved.');
                if (!ok) return;
                try {
                    await db.from('site_feedback').update({ deleted: true }).eq('id', deleteBtn.dataset.id);
                    loadFeedback();
                    showToast('Feedback soft-deleted.', 'success');
                } catch (err) {
                    showToast('Error: ' + err.message, 'error');
                }
            }
        });
    }

    document.getElementById('addFeedbackBtn').addEventListener('click', function() {
        var form = document.getElementById('inlineFeedbackForm');
        form.style.display = 'block';
        document.getElementById('newFeedbackDate').value = new Date().toLocaleDateString();
        document.getElementById('newFeedbackComment').value = '';
    });

    document.querySelector('[data-action="save-feedback"]').addEventListener('click', async function() {
        var comment = document.getElementById('newFeedbackComment').value;
        var priority = document.getElementById('newFeedbackPriority').value;
        if (!comment.trim()) { showToast('Please enter a comment.', 'error'); return; }
        var saveBtn = document.querySelector('[data-action="save-feedback"]');
        var originalText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
        try {
            await db.from('site_feedback').insert([{ comment: comment, priority: priority }]);
            document.getElementById('inlineFeedbackForm').style.display = 'none';
            loadFeedback();
            showToast('Feedback added.', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
        }
    });

    document.querySelector('[data-action="cancel-feedback"]').addEventListener('click', function() {
        document.getElementById('inlineFeedbackForm').style.display = 'none';
    });

    // --- Modal close buttons (generic) ---
    document.querySelectorAll('.close-modal-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var modal = btn.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    // --- Modal focus trapping ---
    var trapFocusHandlers = {};
    function setupModalFocus(modal) {
        if (trapFocusHandlers[modal.id]) return;
        trapFocusHandlers[modal.id] = true;
        var focusableSelectors = 'input, select, textarea, button, [tabindex]:not([tabindex="-1"])';
        modal.addEventListener('keydown', function(e) {
            if (e.key !== 'Tab') return;
            var focusable = modal.querySelectorAll(focusableSelectors);
            var firstFocusable = focusable[0];
            var lastFocusable = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        });
        var firstInput = modal.querySelector(focusableSelectors);
        if (firstInput) {
            setTimeout(function() { firstInput.focus(); }, 100);
        }
    }

    // --- Global Escape key closes all modals ---
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        var modals = document.querySelectorAll('.modal');
        modals.forEach(function(modal) {
            if (modal.style.display === 'flex' || modal.style.display === 'block') {
                if (modal.id === 'confirmModal') return;
                modal.style.display = 'none';
            }
        });
    });

    // --- Review star rating selection ---
    var currentRating = 5;
    function setReviewStars(rating) {
        currentRating = rating;
        var spans = document.querySelectorAll('#reviewStars span');
        spans.forEach(function(span) {
            span.textContent = parseInt(span.dataset.rating) <= rating ? '\u2605' : '\u2606';
        });
    }
    var reviewStarsEl = document.getElementById('reviewStars');
    if (reviewStarsEl) {
        reviewStarsEl.addEventListener('click', function(e) {
            var span = e.target.closest('span[data-rating]');
            if (span) setReviewStars(parseInt(span.dataset.rating));
        });
        reviewStarsEl.addEventListener('mouseover', function(e) {
            var span = e.target.closest('span[data-rating]');
            if (!span) return;
            var rating = parseInt(span.dataset.rating);
            reviewStarsEl.querySelectorAll('span').forEach(function(s) {
                s.textContent = parseInt(s.dataset.rating) <= rating ? '\u2605' : '\u2606';
            });
        });
        reviewStarsEl.addEventListener('mouseout', function() { setReviewStars(currentRating); });
    }

    // --- Gallery form submit ---
    (function initGalleryForm() {
        var form = document.getElementById('galleryForm');
        if (!form) return;
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var editId = document.getElementById('editGalleryId').value;
            var url = document.getElementById('galleryImageUrl').value.trim();
            if (!isValidImageUrl(url)) { showToast('Invalid image URL format.', 'error'); return; }
            var title = document.getElementById('galleryTitle').value.trim();
            var orderVal = document.getElementById('galleryDisplayOrder').value;
            var displayOrder = orderVal ? parseInt(orderVal) : null;
            var isActive = document.getElementById('galleryIsActive').checked;
            var saveBtn = document.getElementById('saveGalleryBtn');
            var originalText = saveBtn ? saveBtn.textContent : '';
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
            try {
                if (editId) {
                    var update = { image_url: url, title: title, is_active: isActive };
                    if (displayOrder !== null) update.display_order = displayOrder;
                    await db.from('gallery_items').update(update).eq('id', editId);
                } else {
                    var maxOrder = galleryItems.reduce(function(max, item) { return Math.max(max, item.display_order || 0); }, 0);
                    await db.from('gallery_items').insert([{ image_url: url, title: title, display_order: displayOrder || maxOrder + 1, is_active: isActive }]);
                }
                document.getElementById('addGalleryModal').style.display = 'none';
                loadGalleryItems();
                showToast(editId ? 'Gallery item updated.' : 'Gallery item added.', 'success');
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            } finally {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
            }
        });
    })();

    // --- Flash form submit ---
    (function initFlashForm() {
        var form = document.getElementById('flashForm');
        if (!form) return;
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var editId = document.getElementById('editFlashId').value;
            var url = document.getElementById('flashImageUrl').value.trim();
            if (!isValidImageUrl(url)) { showToast('Invalid image URL format.', 'error'); return; }
            var title = document.getElementById('flashTitle').value.trim();
            if (!title) { showToast('Title is required.', 'error'); return; }
            var price = document.getElementById('flashPrice').value.trim() || null;
            var desc = document.getElementById('flashDescription').value.trim() || null;
            var orderVal = document.getElementById('flashDisplayOrder').value;
            var displayOrder = orderVal ? parseInt(orderVal) : null;
            var isActive = document.getElementById('flashIsActive').checked;
            var saveBtn = document.getElementById('saveFlashBtn');
            var originalText = saveBtn ? saveBtn.textContent : '';
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
            try {
                if (editId) {
                    await db.from('flash_gallery').update({ image_url: url, title: title, price: price, description: desc, is_active: isActive }).eq('id', editId);
                } else {
                    var maxOrder = flashItems.reduce(function(max, item) { return Math.max(max, item.display_order || 0); }, 0);
                    await db.from('flash_gallery').insert([{ image_url: url, title: title, price: price, description: desc, display_order: displayOrder || maxOrder + 1, is_active: isActive }]);
                }
                document.getElementById('addFlashModal').style.display = 'none';
                loadFlashItems();
                showToast(editId ? 'Flash design updated.' : 'Flash design added.', 'success');
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            } finally {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
            }
        });
    })();

    // --- Review form submit ---
    (function initReviewForm() {
        var form = document.getElementById('reviewForm');
        if (!form) return;
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var editId = document.getElementById('editReviewId').value;
            var name = document.getElementById('reviewName').value.trim();
            if (!name) { showToast('Name is required.', 'error'); return; }
            var text = document.getElementById('reviewText').value.trim();
            if (!text) { showToast('Review text is required.', 'error'); return; }
            var orderVal = document.getElementById('reviewDisplayOrder').value;
            var displayOrder = orderVal ? parseInt(orderVal) : null;
            var isActive = document.getElementById('reviewIsActive').checked;
            var saveBtn = document.getElementById('saveReviewBtn');
            var originalText = saveBtn ? saveBtn.textContent : '';
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
            try {
                if (editId) {
                    await db.from('reviews').update({ reviewer_name: name, review_text: text, rating: currentRating, display_order: displayOrder, is_active: isActive }).eq('id', editId);
                } else {
                    var maxOrder = reviewsData.reduce(function(max, r) { return Math.max(max, r.display_order || 0); }, 0);
                    await db.from('reviews').insert([{ reviewer_name: name, review_text: text, rating: currentRating, display_order: displayOrder || maxOrder + 1, is_active: isActive }]);
                }
                document.getElementById('addReviewModal').style.display = 'none';
                loadReviews();
                showToast(editId ? 'Review updated.' : 'Review added.', 'success');
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            } finally {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = originalText; }
            }
        });
    })();

    // --- Tab switching for Site Management ---
    var mgmtTabs = document.querySelectorAll('.mgmt-tabs .tab-btn');
    var mgmtPanels = document.querySelectorAll('.mgmt-panel');
    mgmtTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            mgmtTabs.forEach(function(t) { t.classList.remove('active'); });
            mgmtPanels.forEach(function(p) { p.classList.remove('active'); });
            tab.classList.add('active');
            var panelId = tab.dataset.tab + 'Tab';
            document.getElementById(panelId).classList.add('active');
        });
    });

    // --- Close popovers on backdrop click ---
    document.getElementById('editApptPopover').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });
    document.getElementById('blockTimePopover').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });

    // --- Year in footer ---
    var yearEl = document.getElementById('currentYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
});
