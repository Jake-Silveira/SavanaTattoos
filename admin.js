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
        div.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;background:' + (type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6') + ';color:#fff;z-index:9999;font-size:14px;';
        div.textContent = message;
        document.body.appendChild(div);
        setTimeout(function() { div.remove(); }, 3500);
    } else {
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(function() { toast.classList.add('toast-exit'); setTimeout(function() { toast.remove(); }, 300); }, 3500);
    }
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
        var result = await db.from('leads').select('*').order('created_at', { ascending: false });
        var data = result.data;
        var error = result.error;
        if (error) { console.error('Leads fetch error:', error); loadingState.style.display = 'none'; return; }
        leads = data || [];
        loadingState.style.display = 'none';
        renderStats(leads);
        renderLeads();
    }

    function renderLeads() {
        if (!leads.length) { emptyState.style.display = 'block'; return; }
        emptyState.style.display = 'none';
        leadsTableBody.innerHTML = '';
        leads.forEach(function(lead) {
            var tr = document.createElement('tr');
            var submitted = lead.requested_date ? new Date(lead.requested_date).toLocaleDateString() : 'N/A';
            var name = lead.client_name ? lead.client_name + ' ' + (lead.last_name || '') : (lead.name || 'Unknown');
            tr.innerHTML =
                '<td>' + escapeHtml(name) + '</td>' +
                '<td>' + escapeHtml(lead.service || '-') + '</td>' +
                '<td>' + escapeHtml(lead.size || '-') + '</td>' +
                '<td><span class="status-badge status-' + escapeHtml(lead.status) + '">' + escapeHtml(lead.status) + '</span></td>' +
                '<td>' + escapeHtml(submitted) + '</td>' +
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
        try {
            await db.from('leads').update({ status: status, updated_at: new Date().toISOString() }).eq('id', id);
            var lead = leads.find(function(l) { return l.id === id; });
            if (lead) lead.status = status;
            if (status === 'confirmed') {
                var leadData = leads.find(function(l) { return l.id === id; });
                if (leadData) triggerConfirmedEmail(leadData);
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
        if (!lead) return;
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
        modal.querySelector('.close-btn').onclick = function() { modal.style.display = 'none'; activeLeadId = null; };
        attachLeadModalActions(id);
    }

    function attachLeadModalActions(id) {
        document.querySelectorAll('[data-action="link-profile"]').forEach(function(btn) {
            btn.onclick = function() {
                document.getElementById('leadModal').style.display = 'none';
                activeLeadId = id;
                switchPanel('client-index');
            };
        });
        document.querySelectorAll('[data-action="confirm-lead"]').forEach(function(btn) {
            btn.onclick = async function() {
                await db.from('leads').update({ status: 'confirmed', confirmed_time: new Date().toISOString() }).eq('id', id);
                var lead = leads.find(function(l) { return l.id === id; });
                if (lead) lead.status = 'confirmed';
                if (lead) triggerConfirmedEmail(lead);
                fetchLeads();
                showToast('Lead confirmed!', 'success');
                document.getElementById('leadModal').style.display = 'none';
            };
        });
        document.querySelectorAll('[data-action="archive-lead"]').forEach(function(btn) {
            btn.onclick = async function() {
                var ok = await showConfirm('Archive this lead?');
                if (!ok) return;
                await db.from('leads').update({ status: 'deleted' }).eq('id', id);
                leads = leads.filter(function(l) { return l.id !== id; });
                fetchLeads();
                showToast('Lead archived.', 'success');
                document.getElementById('leadModal').style.display = 'none';
            };
        });
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
        var clientsResult = await db.from('clients').select('*');
        clients = clientsResult.data || [];
        var profilesResult = await db.from('client_profiles').select('*');
        clientProfiles = profilesResult.data || [];
        renderClients();
        populateClientDropdown();
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

    function renderClients() {
        var grid = document.getElementById('clientGrid');
        var search = document.getElementById('clientSearch');
        var term = (search ? search.value : '') || '';
        term = term.toLowerCase();
        var filtered = clients.filter(function(c) {
            return (c.owner_name || '').toLowerCase().includes(term) ||
                   (c.phone || '').includes(term) ||
                   (c.email || '').toLowerCase().includes(term);
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
                return '<div class="pet-mini-row" data-action="open-profile" data-id="' + p.id + '">' +
                    '<div class="pet-mini-pic">&#128100;</div>' +
                    '<div class="pet-mini-info"><span class="pet-name">' + escapeHtml(p.name) + '</span>' +
                    '<span class="pet-breed">' + escapeHtml(shortNotes) + '</span></div></div>';
            }).join('');
            if (!profiles.length) profilesHtml = '<p class="history-empty">No profiles yet.</p>';
            var card = document.createElement('div');
            card.className = 'profile-card';
            card.innerHTML =
                '<div class="household-header">' +
                    '<span class="client-id-badge">' + escapeHtml(client.client_id || 'N/A') + '</span>' +
                    '<h3>' + escapeHtml(client.owner_name) + '</h3>' +
                    '<div class="owner-contact">' + escapeHtml(client.phone) + (client.email ? ' | ' + escapeHtml(client.email) : '') + '</div>' +
                '</div>' +
                '<div class="household-pets-list">' + profilesHtml + '</div>' +
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
            var row = e.target.closest('.pet-mini-row[data-action="open-profile"]');
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
    };

    window.openClientModalById = async function(id) {
        var result = await db.from('clients').select('*').eq('id', id).single();
        if (result.data) openClientModal(result.data);
    };

    clientForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var phone = document.getElementById('clientPhone').value;
        if (!isValidPhoneNumber(phone)) { showToast('Invalid phone number.', 'error'); return; }
        var id = document.getElementById('clientId').value;
        var payload = {
            owner_name: document.getElementById('clientName').value,
            phone: phone,
            email: document.getElementById('clientEmail').value || null
        };
        try {
            if (id) {
                await db.from('clients').update(payload).eq('id', id);
            } else {
                payload.client_id = String(Math.floor(100000 + Math.random() * 900000));
                await db.from('clients').insert([payload]);
            }
            await loadClients();
            renderClients();
            clientModal.style.display = 'none';
            showToast('Client saved!', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });

    document.getElementById('deleteClientBtn').addEventListener('click', async function() {
        var id = document.getElementById('clientId').value;
        if (!id) return;
        var ok = await showConfirm('Delete this client and all their profiles?');
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
        if (profile.id) fetchProfileHistory(profile.id);
        else document.getElementById('profileHistory').innerHTML = '<p class="history-empty">Save profile first to see history.</p>';
        profileModal.style.display = 'block';
    };

    window.openProfileModalById = async function(id) {
        var p = await db.from('client_profiles').select('*').eq('id', id).single();
        if (!p.data) return;
        var c = await db.from('clients').select('*').eq('id', p.data.client_ref_id).single();
        openProfileModal(p.data, c.data || {});
    };

    profileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var phone = document.getElementById('profPhone').value;
        if (!isValidPhoneNumber(phone)) { showToast('Invalid phone number.', 'error'); return; }
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
        try {
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
            historyEl.innerHTML = '<p class="history-empty">No booking history yet.</p>';
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

    function generateTimeLabels() {
        var html = '';
        for (var h = 8; h <= 17; h++) {
            var displayH = h > 12 ? h - 12 : h;
            var ampm = h >= 12 ? 'PM' : 'AM';
            html += '<div class="time-label">' + displayH + ':00 ' + ampm + '</div>';
            html += '<div class="time-label half-hour">' + displayH + ':30 ' + ampm + '</div>';
        }
        return html;
    }

    function renderTimeGridBackground() {
        var html = '<div class="grid-background">';
        for (var i = 0; i < 20; i++) {
            html += '<div class="grid-row"></div>';
        }
        html += '</div>';
        return html;
    }

    function timeToIdx(timeStr) {
        if (!timeStr) return 0;
        var parts = timeStr.split(':').map(Number);
        return (parts[0] - 8) * 2 + (parts[1] >= 30 ? 1 : 0);
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
        if (schedulerViewMode === 'month') renderMonthlyView();
        else if (schedulerViewMode === 'week') renderWeeklyView();
        else if (schedulerViewMode === 'day') renderDailyView();
    }

    function renderMonthlyView() {
        fetchSchedulerData();
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
                calendarDate = new Date();
                renderScheduler();
            };
        }

        container.querySelectorAll('.calendar-day[data-date]').forEach(function(cell) {
            cell.onclick = function() {
                dayDate = new Date(cell.dataset.date + 'T00:00:00');
                renderScheduler();
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

    function renderWeeklyView() {
        fetchSchedulerData(weekStartDate, new Date(weekStartDate.getTime() + 6 * 86400000));
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
                colHtml += '<div class="appt-card" data-action="edit-appt" data-id="' + lead.id + '">' +
                    '<div class="appt-time">' + escapeHtml(timeStr) + '</div>' +
                    '<div class="appt-client">' + escapeHtml(lead.name || 'Unknown') + '</div>' +
                    '<div class="appt-service">' + escapeHtml(lead.service || '') + '</div>' +
                    '<span class="status-badge status-' + escapeHtml(lead.status) + '" style="font-size:0.65rem;padding:1px 4px;">' + escapeHtml(lead.status) + '</span>' +
                '</div>';
            });
            if (dayLeads.length) {
                colHtml += '<a href="#" class="view-day-link" data-date="' + dateStr + '">View Day &#8250;</a>';
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
                renderScheduler();
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

    function renderDailyView() {
        fetchSchedulerData(dayDate, dayDate);
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
        html += '<div class="day-view-layout"><div class="time-grid">' +
            '<div class="time-grid-labels">' + generateTimeLabels() + '</div>' +
            renderTimeGridBackground();
        html += '<div class="time-grid-content">';
        var dayLeads = (dailyLeads || []).filter(function(l) { return l.requested_date === dateStr && l.status !== 'deleted'; });
        dayLeads.forEach(function(lead) {
            var startIdx = timeToIdx(lead.requested_time);
            var dur = parseInt(lead.duration_minutes) || 60;
            var rowDur = Math.ceil(dur / 30);
            var topPos = startIdx * 30;
            var cardHeight = rowDur * 30;
            html += '<div class="appt-card day-appt-card" data-action="edit-appt" data-id="' + lead.id + '" style="top:' + topPos + 'px;height:' + cardHeight + 'px;">' +
                '<div class="appt-time">' + (lead.requested_time ? formatTime12(lead.requested_time) : '') + '</div>' +
                '<div class="appt-details">' +
                    '<div class="appt-client">' + escapeHtml(lead.name || 'Unknown') + '</div>' +
                    '<div class="appt-service">' + escapeHtml(lead.service || '') + (lead.size ? ' - ' + escapeHtml(lead.size) : '') + '</div>' +
                    '<span class="status-badge status-' + escapeHtml(lead.status) + '">' + escapeHtml(lead.status) + '</span>' +
                '</div>' +
            '</div>';
        });
        html += '</div></div>';
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

    // --- Block Time Popover ---
    function openBlockPopover(dateStr) {
        var popover = document.getElementById('blockTimePopover');
        document.getElementById('blockType').value = 'range';
        document.getElementById('timeRangeInputs').style.display = 'block';
        document.getElementById('blockNote').value = '';
        populateTimeSelects('blockStart', 11, 19);
        populateTimeSelects('blockEnd', 11, 19);
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
        try {
            await db.from('blocked_slots').insert([payload]);
            document.getElementById('blockTimePopover').style.display = 'none';
            renderScheduler();
            showToast('Block saved!', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
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
        populateTimeSelects('editApptTime', 11, 19);
        document.getElementById('editApptPopover').style.display = 'flex';
    }

    // --- Save Appointment Handler ---
    document.getElementById('saveApptBtn').addEventListener('click', async function() {
        var id = document.getElementById('editApptId').value;
        var confirmedTime = document.getElementById('editApptTime').value;
        var duration = parseInt(document.getElementById('editApptDuration').value) || 60;
        var status = document.getElementById('editApptStatus').value;
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
        }
    });

    document.getElementById('closeApptPopover').addEventListener('click', function() {
        document.getElementById('editApptPopover').style.display = 'none';
    });

    // --- New Appointment Modal ---
    var newApptSelectedTime = null;

    document.getElementById('newApptBtn').addEventListener('click', async function() {
        await loadClients();
        document.getElementById('newApptModal').style.display = 'block';
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
            blockedDayOfWeek: [0, 1],
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

    function showNewApptTimePicker(dateStr) {
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

        var startTime = 11 * 60; // 11am in minutes
        var endTime = 19 * 60;   // 7pm in minutes
        var slotMinutes = 30;
        var allLeads = [];
        var allBlocked = [];

        var leadsRes = db.from('leads').select('*').eq('requested_date', dateStr);
        var blockedRes = db.from('blocked_slots').select('*').eq('date', dateStr);

        Promise.all([leadsRes, blockedRes]).then(function(responses) {
            allLeads = (responses[0].data || []).filter(function(l) { return l.status !== 'deleted'; });
            allBlocked = (responses[1].data || []).filter(function(b) { return !b.is_full_day; });

            var unavailable = buildUnavailableIntervals(allLeads, allBlocked, null);

            for (var t = startTime; t < endTime; t += slotMinutes) {
                var slotEnd = t + slotMinutes;
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
                var disabled = !overlaps ? '' : 'disabled';
                var label = formatTime12(t);
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
        });
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
                var result = await resp.json();
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

    // --- Site Management ---
    var galleryItems = [];
    var flashItems = [];
    var reviewsData = [];
    var feedbackData = [];

    function initSiteMgmt() {
        loadGalleryItems();
        loadFlashItems();
        loadReviews();
        loadFeedback();
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
            card.innerHTML =
                '<div class="mgmt-card-img"><img src="' + escapeHtml(item.image_url) + '" alt=""></div>' +
                '<div class="mgmt-card-body">' +
                    '<div class="mgmt-card-title">' + escapeHtml(item.title || '') + '</div>' +
                    '<div class="mgmt-card-desc">Order: ' + (item.display_order || 0) + ' | Active: ' + (item.is_active ? 'Yes' : 'No') + '</div>' +
                '</div>' +
                '<div class="card-actions-row">' +
                    '<button class="admin-btn-outline mgmt-edit-gallery" data-id="' + item.id + '">Edit</button>' +
                    '<button class="admin-btn delete mgmt-delete-gallery" data-id="' + item.id + '">Delete</button>' +
                '</div>';
            grid.appendChild(card);
        });
        attachGalleryMgmtEvents();
    }

    function attachGalleryMgmtEvents() {
        document.querySelectorAll('.mgmt-delete-gallery').forEach(function(btn) {
            btn.onclick = async function() {
                var ok = await showConfirm('Delete this gallery item?');
                if (!ok) return;
                await db.from('gallery_items').delete().eq('id', btn.dataset.id);
                loadGalleryItems();
                showToast('Gallery item deleted.', 'success');
            };
        });
    }

    document.getElementById('addGalleryItemBtn').addEventListener('click', async function() {
        var url = prompt('Enter image URL:');
        if (!url) return;
        var title = prompt('Enter title (optional):', '') || '';
        try {
            var maxOrder = galleryItems.reduce(function(max, item) { return Math.max(max, item.display_order || 0); }, 0);
            await db.from('gallery_items').insert([{
                image_url: url, title: title, display_order: maxOrder + 1, is_active: true
            }]);
            loadGalleryItems();
            showToast('Gallery item added.', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
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
            card.innerHTML =
                '<div class="mgmt-card-img"><img src="' + escapeHtml(item.image_url) + '" alt=""></div>' +
                '<div class="mgmt-card-body">' +
                    '<div class="mgmt-card-title">' + escapeHtml(item.title || 'Flash') + '</div>' +
                    '<div class="flash-card-desc" style="font-size:0.85rem;color:var(--text-muted);">' + escapeHtml(item.description || '') + '</div>' +
                    (item.price ? '<div class="flash-card-price" style="margin-top:4px;">' + escapeHtml(item.price) + '</div>' : '') +
                    '<div class="mgmt-card-desc">Order: ' + (item.display_order || 0) + '</div>' +
                '</div>' +
                '<div class="card-actions-row">' +
                    '<button class="admin-btn delete mgmt-delete-flash" data-id="' + item.id + '">Delete</button>' +
                '</div>';
            grid.appendChild(card);
        });
        attachFlashMgmtEvents();
    }

    function attachFlashMgmtEvents() {
        document.querySelectorAll('.mgmt-delete-flash').forEach(function(btn) {
            btn.onclick = async function() {
                var ok = await showConfirm('Delete this flash design?');
                if (!ok) return;
                await db.from('flash_gallery').delete().eq('id', btn.dataset.id);
                loadFlashItems();
                showToast('Flash design deleted.', 'success');
            };
        });
    }

    document.getElementById('addFlashBtn').addEventListener('click', async function() {
        var url = prompt('Enter image URL:');
        if (!url) return;
        var title = prompt('Enter design title:', '');
        var price = prompt('Enter price (optional):', '');
        var desc = prompt('Enter description (optional):', '');
        try {
            var maxOrder = flashItems.reduce(function(max, item) { return Math.max(max, item.display_order || 0); }, 0);
            await db.from('flash_gallery').insert([{
                image_url: url, title: title || 'Flash Design', price: price || null,
                description: desc || null, display_order: maxOrder + 1, is_active: true
            }]);
            loadFlashItems();
            showToast('Flash design added.', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
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
            var stars = '\u2605'.repeat(item.rating || 5) + '\u2606'.repeat(5 - (item.rating || 5));
            card.innerHTML =
                '<div class="mgmt-card-body">' +
                    '<div class="mgmt-card-title">' + escapeHtml(item.reviewer_name || 'Anonymous') + '</div>' +
                    '<p style="margin:8px 0;font-style:italic;">' + escapeHtml(item.review_text) + '</p>' +
                    '<div class="flash-card-desc">Stars: ' + stars + ' | Order: ' + (item.display_order || 0) + '</div>' +
                '</div>' +
                '<div class="card-actions-row">' +
                    '<button class="admin-btn-outline mgmt-toggle-review" data-id="' + item.id + '">' + (item.is_active ? 'Deactivate' : 'Activate') + '</button>' +
                    '<button class="admin-btn delete mgmt-delete-review" data-id="' + item.id + '">Delete</button>' +
                '</div>';
            grid.appendChild(card);
        });
        attachReviewsMgmtEvents();
    }

    function attachReviewsMgmtEvents() {
        document.querySelectorAll('.mgmt-delete-review').forEach(function(btn) {
            btn.onclick = async function() {
                var ok = await showConfirm('Delete this review?');
                if (!ok) return;
                await db.from('reviews').delete().eq('id', btn.dataset.id);
                loadReviews();
                showToast('Review deleted.', 'success');
            };
        });
        document.querySelectorAll('.mgmt-toggle-review').forEach(function(btn) {
            btn.onclick = async function() {
                var ok = await showConfirm('Toggle review active status?');
                if (!ok) return;
                var review = reviewsData.find(function(r) { return r.id === btn.dataset.id; });
                if (review) {
                    await db.from('reviews').update({ is_active: !review.is_active }).eq('id', btn.dataset.id);
                    loadReviews();
                    showToast('Review updated.', 'success');
                }
            };
        });
    }

    document.getElementById('addReviewBtn').addEventListener('click', async function() {
        var name = prompt('Reviewer name:');
        if (!name) return;
        var text = prompt('Review text:');
        if (!text) return;
        var rating = prompt('Rating (1-5):', '5');
        try {
            var maxOrder = reviewsData.reduce(function(max, r) { return Math.max(max, r.display_order || 0); }, 0);
            await db.from('reviews').insert([{
                reviewer_name: name, review_text: text, rating: parseInt(rating) || 5,
                display_order: maxOrder + 1, is_active: true
            }]);
            loadReviews();
            showToast('Review added.', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });

    // Feedback management
    async function loadFeedback() {
        var result = await db.from('site_feedback').select('*').order('created_at', { ascending: false });
        feedbackData = result.data || [];
        renderFeedback();
    }

    function renderFeedback() {
        var tbody = document.getElementById('feedbackTableBody');
        tbody.innerHTML = '';
        feedbackData.forEach(function(item) {
            var tr = document.createElement('tr');
            var date = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A';
            tr.innerHTML =
                '<td>' + escapeHtml(date) + '</td>' +
                '<td><span class="status-badge status-' + escapeHtml(item.priority) + '">' + escapeHtml(item.priority) + '</span></td>' +
                '<td>' + escapeHtml(item.comment || '') + '</td>' +
                '<td><button class="admin-btn delete mgmt-delete-feedback" data-id="' + item.id + '">Delete</button></td>';
            tbody.appendChild(tr);
        });
        attachFeedbackMgmtEvents();
    }

    function attachFeedbackMgmtEvents() {
        document.querySelectorAll('.mgmt-delete-feedback').forEach(function(btn) {
            btn.onclick = async function() {
                var ok = await showConfirm('Delete this feedback?');
                if (!ok) return;
                await db.from('site_feedback').delete().eq('id', btn.dataset.id);
                loadFeedback();
                showToast('Feedback deleted.', 'success');
            };
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
        try {
            await db.from('site_feedback').insert([{ comment: comment, priority: priority }]);
            document.getElementById('inlineFeedbackForm').style.display = 'none';
            loadFeedback();
            showToast('Feedback added.', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    });

    document.querySelector('[data-action="cancel-feedback"]').addEventListener('click', function() {
        document.getElementById('inlineFeedbackForm').style.display = 'none';
    });

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
