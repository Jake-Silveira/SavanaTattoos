/**
 * utils.js — Shared constants and helpers for SavanaTattoos
 */

/**
 * DURATION_MAP — Tattoo session duration (minutes) by style and size.
 * 
 * Size categories:
 *   XS  = small (2-4 inches)
 *   Small = medium small (4-6 inches)
 *   Medium = medium (6-10 inches)
 *   Large = large (10-16 inches)
 *   XL = extra large (16-24 inches)
 *   XXL = XXL (24+ inches / half sleeve)
 *   XXXL = XXXL (full sleeve / back piece — custom sizing required)
 * 
 * Format: { ServiceName: { SizeCategory: minutes, ... }, ... }
 */
window.DURATION_MAP = {
    'Small Tattoo':    { XS: 30, Small: 45, Medium: 60, Large: 90, XL: 120, XXL: 180, XXXL: 180 },
    'Medium Tattoo':   { XS: 45, Small: 60, Medium: 90, Large: 120, XL: 150, XXL: 210, XXXL: 240 },
    'Large Tattoo':    { XS: 60, Small: 90, Medium: 120, Large: 180, XL: 240, XXL: 300, XXXL: 360 },
    'Custom Design':   { XS: 60, Small: 90, Medium: 150, Large: 180, XL: 240, XXL: 300, XXXL: 360 },
    'Cover-Up':        { XS: 60, Small: 90, Medium: 120, Large: 180, XL: 240, XXL: 300, XXXL: 360 },
    'Touch-Up':        { XS: 15, Small: 30, Medium: 45, Large: 60, XL: 90, XXL: 120, XXXL: 120 },
    'Flash Tattoo':    { XS: 15, Small: 20, Medium: 30, Large: 45, XL: 60, XXL: 60, XXXL: 60 },
    'Consultation':    { XS: 30, Small: 30, Medium: 45, Large: 45, XL: 60, XXL: 60, XXXL: 60 }
};

/**
 * Gets the suggested session duration (in minutes) for a given service and size.
 * Falls back to 60 minutes if no match is found.
 * 
 * Custom sizing: if size is 'XXXL' and weightLbs (custom size detail) is provided,
 * extra time is added (30 minutes per threshold over the base).
 */
window.getSuggestedDuration = function(service, sizeCategory, customDetail) {
    if (DURATION_MAP[service] && DURATION_MAP[service][sizeCategory]) {
        let duration = DURATION_MAP[service][sizeCategory];
        if (sizeCategory === 'XXXL' && customDetail) {
            duration += 30;
        }
        return duration;
    }
    return 60;
};

// Convert "HH:MM:SS" or "HH:MM" to minutes since midnight
window.timeToMinutes = function(time) {
    if (!time) return 0;
    const parts = time.split(':').map(Number);
    return parts[0] * 60 + parts[1];
};

// Time formatting for display
window.formatTime = function(hours, minutes) {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes === 0 ? '00' : '30';
    return `${displayHours}:${displayMinutes} ${period}`;
};

/**
 * Formats a "HH:MM:SS" or "HH:MM" string to "X:00 AM/PM"
 */
window.formatTime12 = function(time) {
    if (!time) return '';
    const parts = time.split(':').map(Number);
    const h = parts[0];
    const m = parts[1] || 0;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

/**
 * Converts minutes-since-midnight to 12-hour format like "8am" or "2:30pm"
 */
window.minutesToTime12 = function(m) {
    const hh = Math.floor(m / 60) % 24;
    const mm = m % 60;
    const ampm = hh >= 12 ? 'pm' : 'am';
    const hour12 = hh % 12 || 12;
    return mm > 0 ? `${hour12}:${String(mm).padStart(2,'0')}${ampm}` : `${hour12}${ampm}`;
};

/**
 * Builds an array of unavailable time intervals from leads and blocked_slots data.
 */
window.buildUnavailableIntervals = function(leads, blockedSlots, excludeLeadId) {
    const intervals = [];

    (leads || []).forEach(l => {
        if (excludeLeadId && l.id === excludeLeadId) return;
        if (l.status === 'cancelled') return;
        const t = l.confirmed_time || l.requested_time;
        if (t) intervals.push({ start: timeToMinutes(t), end: timeToMinutes(t) + (l.duration_minutes || 30) });
    });

    (blockedSlots || []).forEach(b => {
        if (b.is_full_day) return;
        intervals.push({ start: timeToMinutes(b.start_time), end: timeToMinutes(b.end_time) });
    });

    return intervals;
};

/**
 * Formats a raw string into (XXX) XXX-XXXX
 */
window.formatPhoneNumber = function(value) {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

/**
 * Validates US phone number (10 digits)
 */
window.isValidPhoneNumber = function(value) {
    const phoneNumber = value.replace(/[^\d]/g, '');
    return phoneNumber.length === 10;
};

/**
 * Checks if a proposed appointment (start + duration) overlaps with any existing intervals.
 */
window.isOverlapping = function(start, duration, unavailableIntervals) {
    const end = start + duration;
    return unavailableIntervals.some(interval => {
        return start < interval.end && end > interval.start;
    });
};

/**
 * Filters profile data by searching name, phone, and profile names.
 */
window.searchProfilesData = function(data, searchTerm) {
    if (!searchTerm) return data;
    return data.filter(entry => {
        const nameMatch = (entry.name || entry.owner_name || '').toLowerCase().includes(searchTerm);
        const phoneMatch = (entry.phone || '').toLowerCase().includes(searchTerm);
        const matchingProfiles = (entry.profiles || []).filter(profile =>
            (profile.name || profile.profile_name || '').toLowerCase().includes(searchTerm)
        );
        return nameMatch || phoneMatch || matchingProfiles.length > 0;
    }).map(entry => ({
        ...entry,
        profiles: searchTerm ? (entry.profiles || []).filter(profile =>
            (profile.name || profile.profile_name || '').toLowerCase().includes(searchTerm)
        ) : (entry.profiles || [])
    }));
};

// Cache for initSupabase
let _supabaseClientCache = null;

// Initialize Supabase client from window.__ENV__
window.initSupabase = function() {
    if (_supabaseClientCache) return _supabaseClientCache;
    if (!window.__ENV__ || !window.__ENV__.SUPABASE_URL || !window.__ENV__.SUPABASE_ANON_KEY || window.__ENV__.SUPABASE_URL.startsWith('__')) {
        console.error('Missing Supabase configuration. Please run build.js');
        return null;
    }
    _supabaseClientCache = window.supabase.createClient(
        window.__ENV__.SUPABASE_URL || '',
        window.__ENV__.SUPABASE_ANON_KEY || ''
    );
    return _supabaseClientCache;
};

// Hide all modals
window.hideAllModals = function() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
};

// Close a modal and reset body overflow
window.closeModalFn = function(modal) {
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

// Initialize close-btn handlers + backdrop click for all modals
window.initModalClose = function() {
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            closeModalFn(modal);
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModalFn(modal);
            }
        });
    });
};

// --- Admin-specific helpers ---

// Build auth headers for Supabase API calls
window.getAuthHeaders = async function(db, isJson = true) {
    const client = db || window.db;
    if (!client) {
        console.error('[getAuthHeaders] Supabase client not available');
        return {};
    }
    const { data: { session } } = await client.auth.getSession();
    const headers = {};
    if (session) headers['Authorization'] = `Bearer ${session.access_token}`;
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
};

// Send confirmation for a new inquiry
window.triggerConfirmation = async function(params) {
    if (!params) return;
    try {
        const resp = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'inquiry-confirmation',
                submissionId: params.submissionId
            })
        });
        const result = await resp.json();
        if (!resp.ok) {
            throw new Error(result.error || 'Email send failed');
        }
        return result;
    } catch (err) {
        console.warn('Inquiry confirmation email trigger failed (non-critical):', err.message);
    }
};

// --- Shared Calendar Picker ---

window.createCalendarPicker = function(config) {
    let pickerDate = config.pickerDate;
    let blockedDates = new Set(config.blockedDates);
    let blockedDayOfWeek = config.blockedDayOfWeek || [];
    let selectedDate = config.selectedDate;

    function render() {
        const grid = document.getElementById(config.gridId);
        const monthYearLabel = document.getElementById(config.monthYearId);
        if (!grid || !monthYearLabel) return;

        const month = pickerDate.getMonth();
        const year = pickerDate.getFullYear();

        monthYearLabel.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(pickerDate);

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date().toISOString().split('T')[0];

        let html = '';
        ['S','M','T','W','T','F','S'].forEach(l => html += `<div class="calendar-day-label">${l}</div>`);

        for (let i = 0; i < firstDay; i++) {
            html += '<div class="calendar-day empty-day"></div>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isBlocked = blockedDates.has(dateStr);
            const isPast = dateStr < today;
            const dayOfWeek = new Date(year, month, day).getDay();
            const isDayBlocked = blockedDayOfWeek.includes(dayOfWeek);
            const isSelected = selectedDate === dateStr;

            const classes = ['calendar-day'];
            if (isBlocked || isPast || isDayBlocked) classes.push('disabled');
            if (isSelected) classes.push('selected');
            if (dateStr === today) classes.push('today');

            html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${day}</div>`;
        }

        grid.innerHTML = html;
        initButtons();

        grid.querySelectorAll('.calendar-day[data-date]:not(.disabled)').forEach(day => {
            day.onclick = () => {
                selectedDate = day.dataset.date;
                config.onSelectDate(selectedDate);
                render();
            };
        });
    }

    function initButtons() {
        const prevBtn = document.getElementById(config.prevBtnId);
        const nextBtn = document.getElementById(config.nextBtnId);
        if (prevBtn) {
            prevBtn.onclick = () => {
                pickerDate.setMonth(pickerDate.getMonth() - 1);
                render();
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                pickerDate.setMonth(pickerDate.getMonth() + 1);
                render();
            };
        }
    }

    return {
        setPickerDate: (d) => { pickerDate = d; },
        setBlockedDates: (s) => { blockedDates = s; },
        setSelectedDate: (d) => { selectedDate = d; },
        getPickerDate: () => pickerDate,
        getBlockedDates: () => blockedDates,
        getSelectedDate: () => selectedDate,
        getPickerMonth: () => pickerDate.getMonth(),
        setPickerMonth: (m) => { pickerDate.setMonth(m); },
        render
    };
};

// --- Shared Time Slot Picker ---

window.createTimePicker = function(config) {
    const { db, getDateStr, serviceSelectId, getWeight, onSelectTime } = config;

    async function showTimePicker() {
        const timePickerSection = document.getElementById(config.timeSectionId);
        const timeSlotGrid = document.getElementById(config.timeGridId);
        const unavailableMsg = document.getElementById(config.unavailableMsgId);

        if (!timePickerSection || !timeSlotGrid) return;

        timePickerSection.style.display = 'block';
        timeSlotGrid.innerHTML = '<div style="padding: 20px; text-align: center; width: 100%;"><div class="spinner" style="display: inline-block; border-top-color: var(--primary);"></div> Checking availability...</div>';
        if (unavailableMsg) unavailableMsg.style.display = 'none';

        try {
            const [leadsRes, blockedRes] = await Promise.all([
                db.from('leads')
                    .select('confirmed_time, requested_time, duration_minutes, status')
                    .eq('requested_date', getDateStr())
                    .neq('status', 'cancelled'),
                db.from('blocked_slots')
                    .select('start_time, end_time, is_full_day')
                    .eq('date', getDateStr())
            ]);

            if (leadsRes.error) throw leadsRes.error;
            if (blockedRes.error) throw blockedRes.error;

            const leads = leadsRes.data || [];
            const blocked = blockedRes.data || [];

            if (blocked.some(b => b.is_full_day)) {
                timeSlotGrid.innerHTML = '';
                if (unavailableMsg) unavailableMsg.style.display = 'block';
                return;
            }

            const unavailableIntervals = [];
            leads.forEach(l => {
                const time = l.confirmed_time || l.requested_time;
                if (!time) return;
                const start = timeToMinutes(time);
                const end = start + (l.duration_minutes || 30);
                unavailableIntervals.push({ start, end });
            });

            blocked.forEach(b => {
                const start = timeToMinutes(b.start_time);
                const end = timeToMinutes(b.end_time);
                unavailableIntervals.push({ start, end });
            });

            const service = document.getElementById(serviceSelectId).value;
            const weightInfo = getWeight ? getWeight() : { size_category: 'Small', custom_size: null };
            const weightCategory = weightInfo.size_category || 'Small';
            const weightLbs = weightInfo.custom_size;
            const suggestedDuration = getSuggestedDuration(service, weightCategory, weightLbs);

            let html = '';
            let hasAvailable = false;

            // Tattoo shop hours: 11am - 7pm (adjust as needed)
            for (let h = 11; h <= 18; h++) {
                for (let m of [0, 30]) {
                    if (h === 18 && m > 0) continue;
                    if (h >= 19) break;
                    const timeMinutes = h * 60 + m;
                    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
                    const displayTime = formatTime(h, m);

                    const isOccupied = isOverlapping(timeMinutes, suggestedDuration, unavailableIntervals);

                    const classes = ['time-slot-btn'];
                    if (isOccupied) classes.push('unavailable');
                    else hasAvailable = true;

                    html += `<button type="button" class="${classes.join(' ')}" data-time="${timeStr}" ${isOccupied ? 'disabled' : ''}>${displayTime}</button>`;
                }
            }

            if (!hasAvailable) {
                timeSlotGrid.innerHTML = '';
                if (unavailableMsg) unavailableMsg.style.display = 'block';
            } else {
                timeSlotGrid.innerHTML = html;
                timeSlotGrid.querySelectorAll('.time-slot-btn:not(.unavailable)').forEach(btn => {
                    btn.onclick = () => {
                        onSelectTime(btn.dataset.time);
                        timeSlotGrid.querySelectorAll('.time-slot-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                    };
                });

                if (config.onUnavailableClick) {
                    timeSlotGrid.querySelectorAll('.time-slot-btn.unavailable').forEach(btn => {
                        btn.onclick = () => {
                            config.onUnavailableClick(service, suggestedDuration);
                        };
                        btn.style.pointerEvents = 'auto';
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching slots:', err);
            timeSlotGrid.innerHTML = '<p class="error-message">Failed to load availability. Please try again.</p>';
            if (config.onError) config.onError(err);
        }
    }

    return { showTimePicker };
};
