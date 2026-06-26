/**
 * script.js - Public Form Logic
 * SavanaTattoos — Tattoo studio inquiry and booking system.
 * 
 * Public site: index.html
 * - Inquiry form with calendar + time picker
 * - Portfolio gallery carousel
 * - Flash tattoo grid
 * - Reviews carousel
 */

const db = initSupabase();

document.addEventListener('DOMContentLoaded', () => {
    const leadForm = document.getElementById('leadForm');
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('spinner');
    const statusMessage = document.getElementById('statusMessage');
    const phoneInput = document.getElementById('phone');

    if (phoneInput) {
        phoneInput.oninput = (e) => { e.target.value = formatPhoneNumber(e.target.value); };
    }

    let selectedDate = null;
    let selectedTime = null;
    let calendarPicker = null;
    let timePicker = null;

    // --- Date Picker + Time Slot Logic ---
    async function fetchBlockedDates() {
        const { data, error } = await db
            .from('blocked_slots')
            .select('date')
            .eq('is_full_day', true);
        if (error) console.error('Fetch blocked dates error:', error);
        else if (calendarPicker) calendarPicker.setBlockedDates(new Set(data.map(d => d.date)));
    }

    function initCalendar() {
        const now = new Date();
        calendarPicker = createCalendarPicker({
            gridId: 'calendarGrid',
            monthYearId: 'calendarMonthYear',
            prevBtnId: 'prevMonthBtn',
            nextBtnId: 'nextMonthBtn',
            pickerDate: now,
            blockedDates: new Set(),
            blockedDayOfWeek: [0, 1],
            selectedDate: null,
            onSelectDate: (dateStr) => {
                selectedDate = dateStr;
                document.getElementById('requestedDate').value = selectedDate;
                document.getElementById('dateSelectionError').style.display = 'none';
                selectedTime = null;
                document.getElementById('requestedTime').value = '';
                timePicker.showTimePicker();
            }
        });

        document.getElementById('prevMonthBtn').onclick = () => {
            calendarPicker.setPickerMonth(calendarPicker.getPickerMonth() - 1);
            calendarPicker.render();
        };
        document.getElementById('nextMonthBtn').onclick = () => {
            calendarPicker.setPickerMonth(calendarPicker.getPickerMonth() + 1);
            calendarPicker.render();
        };

        timePicker = createTimePicker({
            db,
            getDateStr: () => selectedDate,
            timeSectionId: 'timePickerSection',
            timeGridId: 'timeSlotGrid',
            unavailableMsgId: 'unavailableMessage',
            serviceSelectId: 'service',
            getWeight: () => {
                const category = document.getElementById('size_category')?.value || 'Small';
                return { size_category: category, custom_size: null };
            },
            onSelectTime: (timeStr) => { selectedTime = timeStr; },
            onUnavailableClick: (service, duration) => {
                alert(`This slot is unavailable because the ${service} (${duration} mins) would overlap with another booking or closing time.`);
            }
        });

        document.getElementById('service').addEventListener('change', () => {
            if (selectedDate) timePicker.showTimePicker();
        });
        document.getElementById('size_category').addEventListener('change', () => {
            if (selectedDate) timePicker.showTimePicker();
        });
    }

    // --- Modal Logic ---
    const bookingModal = document.getElementById('bookingModal');
    const openFormBtn = document.getElementById('openFormBtn');
    const heroBookBtn = document.getElementById('heroBookBtn');
    const closeBtns = document.querySelectorAll('.close-btn');

    const openModal = async () => {
        bookingModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        initCalendar();
        await fetchBlockedDates();
        calendarPicker.render();
        document.getElementById('timePickerSection').style.display = 'none';
        selectedDate = null;
        selectedTime = null;
    };

    const closeModal = () => {
        bookingModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        selectedDate = null;
        selectedTime = null;
        document.getElementById('requestedDate').value = '';
        document.getElementById('requestedTime').value = '';
        if (leadForm) leadForm.reset();
    };

    if (openFormBtn) openFormBtn.addEventListener('click', openModal);
    if (heroBookBtn) heroBookBtn.addEventListener('click', openModal);

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            closeModalFn(modal);
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === bookingModal) closeModal();
    });

    // --- Reviews Carousel ---
    const reviewsCarousel = document.getElementById('reviewsCarousel');
    const carouselDots = document.getElementById('carouselDots');
    const prevBtn = document.getElementById('prevReview');
    const nextBtn = document.getElementById('nextReview');

    let reviews = [];
    let currentReviewIndex = 0;
    let autoRotateInterval;

    const fallbackReviews = [
        { review_text: 'Incredible work! My sleeve turned out exactly how I envisioned. The attention to detail is unmatched.', rating: 5 },
        { review_text: 'Professional studio, clean setup, and the artist really listened to my ideas. Will definitely be coming back for my next piece.', rating: 5 },
        { review_text: 'Got a flash tattoo on a whim and absolutely loved it. Smooth process from start to finish!', rating: 5 }
    ];

    async function initReviews() {
        try {
            const { data, error } = await db
                .from('reviews')
                .select('review_text, reviewer_name, rating, display_order')
                .eq('is_active', true)
                .order('display_order', { ascending: true });
            if (error) throw error;
            reviews = (data && data.length > 0) ? data : fallbackReviews;
        } catch (err) {
            console.warn('Failed to fetch reviews, using fallbacks:', err.message);
            reviews = fallbackReviews;
        }
        renderReviews();
        startAutoRotate();
    }

    function renderReviews() {
        reviewsCarousel.innerHTML = '';
        carouselDots.innerHTML = '';

        reviews.forEach((review, index) => {
            const card = document.createElement('div');
            card.className = `review-card ${index === 0 ? 'active' : ''}`;
            const stars = '★'.repeat(review.rating || 5) + '☆'.repeat(5 - (review.rating || 5));
            card.innerHTML = `
                <span class="quote-mark">&ldquo;</span>
                <div class="review-text-container">
                    <p class="review-text">${review.review_text}</p>
                </div>
                <div class="review-stars">${stars}</div>
                <p class="text-muted" style="font-size: 0.85rem;">&mdash; ${review.reviewer_name || 'Anonymous'}</p>
                <button class="read-more-btn" style="margin-top: 8px;">Read More</button>
            `;
            reviewsCarousel.appendChild(card);

            const textEl = card.querySelector('.review-text');
            const readMoreBtn = card.querySelector('.read-more-btn');

            readMoreBtn.style.display = 'inline-block';
            readMoreBtn.onclick = (e) => {
                e.stopPropagation();
                const isExpanded = textEl.classList.toggle('expanded');
                readMoreBtn.textContent = isExpanded ? 'Read Less' : 'Read More';
                if (isExpanded) clearInterval(autoRotateInterval);
                else startAutoRotate();
            };

            const dot = document.createElement('div');
            dot.className = `dot ${index === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => goToReview(index));
            carouselDots.appendChild(dot);
        });
    }

    function goToReview(index) {
        clearInterval(autoRotateInterval);
        startAutoRotate();
        const cards = document.querySelectorAll('.review-card');
        const dots = carouselDots.querySelectorAll('.dot');
        if (cards[currentReviewIndex]) cards[currentReviewIndex].classList.remove('active');
        if (dots[currentReviewIndex]) dots[currentReviewIndex].classList.remove('active');
        currentReviewIndex = index;
        if (currentReviewIndex >= reviews.length) currentReviewIndex = 0;
        if (currentReviewIndex < 0) currentReviewIndex = reviews.length - 1;
        if (cards[currentReviewIndex]) cards[currentReviewIndex].classList.add('active');
        if (dots[currentReviewIndex]) dots[currentReviewIndex].classList.add('active');
    }

    function startAutoRotate() {
        autoRotateInterval = setInterval(() => { goToReview(currentReviewIndex + 1); }, 5000);
    }

    if (prevBtn) prevBtn.addEventListener('click', () => goToReview(currentReviewIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goToReview(currentReviewIndex + 1));
    initReviews();

    // --- Gallery Carousel ---
    const gallerySlider = document.getElementById('gallerySlider');
    const galleryDots = document.getElementById('galleryDots');
    const prevGalleryBtn = document.getElementById('prevGallery');
    const nextGalleryBtn = document.getElementById('nextGallery');
    const gallerySection = document.getElementById('gallery');

    let galleryItems = [];
    let currentGalleryIndex = 0;
    let autoRotateGalleryInterval;

    async function initGallery() {
        try {
            const { data, error } = await db
                .from('gallery_items')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });
            if (error) throw error;
            if (!data || data.length === 0) {
                gallerySection.style.display = 'none';
                return;
            }
            galleryItems = data;
            renderGallery();
            startAutoRotateGallery();
        } catch (err) {
            console.warn('Gallery fetch failed:', err.message);
            gallerySection.style.display = 'none';
        }
    }

    function renderGallery() {
        gallerySlider.innerHTML = '';
        galleryDots.innerHTML = '';

        galleryItems.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = `gallery-pair-card ${index === 0 ? 'active' : ''}`;
            card.innerHTML = `
                <div class="gallery-img-wrapper">
                    ${item.title ? `<span class="img-label">${item.title}</span>` : ''}
                    <img src="${item.image_url}" alt="${item.title || 'Gallery piece'}">
                </div>
                ${item.title ? `<p class="gallery-caption">${item.title}</p>` : ''}
            `;
            gallerySlider.appendChild(card);

            const dot = document.createElement('div');
            dot.className = `dot ${index === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => goToGallery(index));
            galleryDots.appendChild(dot);
        });
    }

    function goToGallery(index) {
        clearInterval(autoRotateGalleryInterval);
        startAutoRotateGallery();
        const cards = gallerySlider.querySelectorAll('.gallery-pair-card');
        const dots = galleryDots.querySelectorAll('.dot');
        if (cards[currentGalleryIndex]) cards[currentGalleryIndex].classList.remove('active');
        if (dots[currentGalleryIndex]) dots[currentGalleryIndex].classList.remove('active');
        currentGalleryIndex = index;
        if (currentGalleryIndex >= galleryItems.length) currentGalleryIndex = 0;
        if (currentGalleryIndex < 0) currentGalleryIndex = galleryItems.length - 1;
        if (cards[currentGalleryIndex]) cards[currentGalleryIndex].classList.add('active');
        if (dots[currentGalleryIndex]) dots[currentGalleryIndex].classList.add('active');
    }

    function startAutoRotateGallery() {
        autoRotateGalleryInterval = setInterval(() => { goToGallery(currentGalleryIndex + 1); }, 5000);
    }

    if (prevGalleryBtn) prevGalleryBtn.addEventListener('click', () => goToGallery(currentGalleryIndex - 1));
    if (nextGalleryBtn) nextGalleryBtn.addEventListener('click', () => goToGallery(currentGalleryIndex + 1));
    initGallery();

    // --- Flash Grid ---
    const flashGrid = document.getElementById('flashGrid');
    const flashEmpty = document.getElementById('flashEmpty');

    async function initFlash() {
        try {
            const { data, error } = await db
                .from('flash_gallery')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });
            if (error) throw error;
            if (!data || data.length === 0) {
                flashEmpty.style.display = 'block';
                return;
            }
            renderFlash(data);
        } catch (err) {
            console.warn('Flash fetch failed:', err.message);
            flashEmpty.style.display = 'block';
        }
    }

    function renderFlash(items) {
        flashGrid.innerHTML = '';
        flashEmpty.style.display = 'none';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'flash-card';
            card.innerHTML = `
                <div class="flash-card-img">
                    <img src="${item.image_url}" alt="${item.title || 'Flash design'}">
                </div>
                <div class="flash-card-body">
                    <div class="flash-card-title">${item.title || 'Flash Design'}</div>
                    ${item.description ? `<div class="flash-card-desc">${item.description}</div>` : ''}
                    ${item.price ? `<div class="flash-card-price">${item.price}</div>` : ''}
                </div>
            `;
            flashGrid.appendChild(card);
        });
    }

    initFlash();

    // --- Form Submission ---
    leadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading(true);
        statusMessage.textContent = '';
        statusMessage.className = 'status-message';

        let hasError = false;
        if (!selectedDate) {
            document.getElementById('dateSelectionError').style.display = 'block';
            hasError = true;
        }
        if (!selectedTime) {
            document.getElementById('timeSelectionError').style.display = 'block';
            hasError = true;
        }
        if (hasError) {
            setLoading(false);
            document.getElementById('bookingCalendar').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        const phone = document.getElementById('phone').value;
        if (!isValidPhoneNumber(phone)) {
            showStatus('Please enter a valid 10-digit phone number.', 'error');
            setLoading(false);
            document.getElementById('phone').focus();
            return;
        }

        const message = document.getElementById('message').value;
        if (message && message.length > 500) {
            showStatus('Additional notes are too long (max 500 characters).', 'error');
            setLoading(false);
            return;
        }

        const sizeCategory = document.getElementById('size_category').value;
        const service = document.getElementById('service').value;
        const payload = {
            client_name: document.getElementById('client_name').value,
            last_name: document.getElementById('category').value,
            phone: phone,
            email: document.getElementById('email').value || null,
            service: service,
            body_placement: document.getElementById('body_placement').value || null,
            size: sizeCategory,
            message: message,
            requested_date: selectedDate,
            requested_time: selectedTime,
            duration_minutes: getSuggestedDuration(service, sizeCategory, null),
            status: 'pending'
        };

        try {
            const { data, error } = await db
                .from('leads')
                .insert([payload])
                .select();
            if (error) throw error;

            const newLead = data[0];
            await triggerConfirmation({
                submissionId: newLead.id,
                name: newLead.client_name,
                email: newLead.email,
                service: newLead.service
            });

            showStatus('Success! We have received your inquiry. We will contact you soon!', 'success');
            leadForm.reset();

            setTimeout(() => {
                closeModal();
                statusMessage.textContent = '';
                statusMessage.className = 'status-message';
            }, 3000);
        } catch (error) {
            console.error('Submission Error:', error.message);
            showStatus('Error: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    });

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        spinner.style.display = isLoading ? 'inline-block' : 'none';
        submitBtn.querySelector('.btn-text').textContent = isLoading ? 'Submitting...' : 'Book Consultation';
    }

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
    }
});
