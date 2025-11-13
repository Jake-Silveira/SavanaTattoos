function sanitizeInput(str) {
  return str.replace(/[<>&"'\/]/g, '');
}

function stripEmojis(str) {
  return str.replace(
    /([\u231A-\u231B]|\u23E9|\u23EA|\u23EB|\u23EC|\u23F0|\u23F3|\u25FD|\u25FE|\u2614|\u2615|\u2648-\u2653|\u267F|\u2693|\u26A1|\u26AA|\u26AB|\u26BD|\u26BE|\u26C4|\u26C5|\u26CE|\u26D4|\u26EA|\u26F2|\u26F3|\u26F5|\u26FA|\u26FD|\u2702|\u2705|\u2708-\u2709|\u270A-\u270B|\u2728|\u2733|\u2734|\u2744|\u2747|\u2753-\u2755|\u2757|\u2764|\u2795-\u2797|\u27B0|\u27BF|\u2B50|\u2B55|\u1F004|\u1F0CF|\u1F170-\u1F171|\u1F17E-\u1F17F|\u1F18E|\u1F191-\u1F19A|\u1F1E6-\u1F1FF|\u1F201-\u1F202|\u1F21A|\u1F22F|\u1F232-\u1F23A|\u1F250-\u1F251|\u1F300-\u1F320|\u1F330-\u1F335|\u1F337-\u1F37C|\u1F380-\u1F393|\u1F3A0-\u1F3C4|\u1F3C6-\u1F3CA|\u1F3E0-\u1F3F0|\u1F400-\u1F43E|\u1F440|\u1F442-\u1F4F7|\u1F4F9-\u1F4FC|\u1F500-\u1F53D|\u1F550-\u1F567|\u1F5FB-\u1F640|\u1F645-\u1F64F|\u1F680-\u1F6C5|\u1F6CC|\u1F6D0|\u1F6D1-\u1F6D2|\u1F6EB-\u1F6EC|\u1F6F0|\u1F6F3|\u1F910-\u1F93E|\u1F940-\u1F970|\u1F973-\u1F976|\u1F97A|\u1F97C-\u1F9A2|\u1F9B0-\u1F9B9|\u1F9C0-\u1F9C2|\u1F9D0-\u1F9FF|\u1FA70-\u1FA74|\u1FA78-\u1FA7A|\u1FA80-\u1FA82|\u1FA90-\u1FA95|\u1FAD0-\u1FAD9)/gu,
    ''
  );
}

function cleanInput(value) {
  return sanitizeInput(stripEmojis(value));
}

function showToast(message = 'Submission received!') {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  } else {
    console.error('Toast element not found');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Modal elements
  const modal = document.getElementById("menuModal");
  const modalContent = document.getElementById("modalContent");
  const menuList = document.getElementById("menuList");
  const socialsList = document.getElementById("socialsList");
  const flashModal = document.getElementById("flashModal");
  const savanaModal = document.getElementById("savanaModal");
  const inquiryModal = document.getElementById("inquiryModal");
  const galleryModal = document.getElementById("galleryModal");

  // Modal buttons
  const menuBtn = document.getElementById("menuBtn");
  const socialsBtn = document.getElementById("socialsBtn");
  const flashBtn = document.getElementById("flashBtn");
  const savana = document.getElementById("savana");
  const inquiryBtn = document.getElementById("inquiry");
  const galleryBtn = document.getElementById("gallery");
  const adminSignIn = document.getElementById("adminSignIn");

  // Close button
  const span = document.getElementsByClassName("close")[0];

  // Modal button handlers
  if (menuBtn) {
    menuBtn.onclick = function() {
      modal.style.display = "block";
      modalContent.style.margin = "0 0";
      modalContent.style.width = "75%";
      modalContent.style.height = "100%";
      modalContent.style.borderRadius = "0px";
      modalContent.style.padding = "4px";
      socialsList.style.display = "none";
      flashModal.style.display = "none";
      savanaModal.style.display = "none";
      inquiryModal.style.display = "none";
      galleryModal.style.display = "none";
      menuList.style.display = "flex";
    };
  }

  if (socialsBtn) {
    socialsBtn.onclick = function() {
      wideModal();
      socialsList.style.display = "flex";
      flashModal.style.display = "none";
      savanaModal.style.display = "none";
      inquiryModal.style.display = "none";
      galleryModal.style.display = "none";
      modalContent.style.width = "auto";
      modalContent.style.height = "90%";
    };
  }

  if (flashBtn) {
    flashBtn.onclick = function() {
      wideModal();
      flashModal.style.display = "block";
      socialsList.style.display = "none";
      savanaModal.style.display = "none";
      inquiryModal.style.display = "none";
      galleryModal.style.display = "none";
      modalContent.style.width = "80%";
      modalContent.style.height = "90%";
    };
  }

  if (savana) {
    savana.onclick = function() {
      wideModal();
      savanaModal.style.display = "flex";
      flashModal.style.display = "none";
      socialsList.style.display = "none";
      inquiryModal.style.display = "none";
      galleryModal.style.display = "none";
      modalContent.style.width = "80%";
      modalContent.style.height = "90%";
    };
  }

  if (galleryBtn) {
    galleryBtn.onclick = function() {
      wideModal();
      savanaModal.style.display = "none";
      flashModal.style.display = "none";
      socialsList.style.display = "none";
      inquiryModal.style.display = "none";
      galleryModal.style.display = "flex";
      modalContent.style.width = "80%";
      modalContent.style.height = "90%";
    };
  }

  if (inquiryBtn) {
    inquiryBtn.onclick = function() {
      wideModal();
      modalContent.style.width = '80%';
      modalContent.style.height = '90%';
      savanaModal.style.display = 'none';
      flashModal.style.display = 'none';
      socialsList.style.display = 'none';
      galleryModal.style.display = 'none';
      inquiryModal.style.display = 'flex';
    };
  }

  if (adminSignIn) {
    adminSignIn.onclick = function() {
      // Redirect to sign-in page directly
      window.location.href = '/signIn';
      modal.style.display = "none";
    };
  }

  // Close modal
  if (span) {
    span.onclick = function() {
      modal.style.display = "none";
    };
  }

  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };

  window.ontouchstart = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };

  function wideModal() {
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modalContent.style.width = "fit-content";
    modalContent.style.minWidth = "300px";
    modalContent.style.height = "fit-content";
    modalContent.style.minHeight = "300px";
    modalContent.style.borderRadius = "20px";
    modalContent.style.padding = "20px";
    modalContent.style.overflow = "auto";
    menuList.style.display = "none";
  }

  // Gallery Generation
  const galleryPhotos = document.querySelector(".galleryPhotos");
  const gallery = [];
  const galleryPopup = document.getElementById("galleryPopup");
  const leftBtn = document.getElementById("galleryLeft");
  const rightBtn = document.getElementById("galleryRight");
  let currentPopupIndex = 0;

  async function loadGalleryImages() {
    try {
      const response = await fetch("https://www.ravensnest.ink/api/images/gallery");
      if (!response.ok) throw new Error('Failed to fetch gallery images');
      const imageUrls = await response.json();
      gallery.length = 0;
      imageUrls.forEach(url => gallery.push(new Photo(url)));
      displayGallery();
      startGallery();
    } catch (err) {
      showToast('Failed to load gallery images: ' + err.message);
    }
  }

  class Photo {
    constructor(url) {
      this.url = url;
    }
  }

  function displayGallery() {
    galleryPhotos.innerHTML = '';
    for (let i = 0; i < gallery.length; i++) {
      let cell = document.createElement('div');
      cell.className = "grid-item";
      cell.id = `photo-${i}`;
      cell.style.padding = '1vw';

      let icon = document.createElement('img');
      icon.className = 'grid-item-icon';
      icon.id = 'grid-item-icon' + i;
      icon.src = gallery[i].url;
      cell.appendChild(icon);

      icon.addEventListener("click", () => {
        currentPopupIndex = i;
        updatePopupImage();
      });

      galleryPhotos.appendChild(cell);
    }
  }

  function startGallery() {
    if (gallery.length > 0) {
      currentPopupIndex = 0;
      updatePopupImage();
    }
  }

  function updatePopupImage() {
    const modal = document.getElementById("galleryPopup");
    modal.innerHTML = '';

    const popupIcon = document.createElement('img');
    popupIcon.className = 'popupImg';
    popupIcon.src = gallery[currentPopupIndex].url;

    popupIcon.addEventListener("click", (e) => {
      if (e.target === popupIcon) {
        if (modal.classList.contains("fullscreen")) {
          modal.classList.remove("fullscreen");
          popupIcon.classList.remove("zoomed");
        } else {
          modal.classList.add("fullscreen");
          popupIcon.classList.add("zoomed");
        }
      }
    });

    modal.appendChild(popupIcon);
  }

  if (leftBtn) {
    leftBtn.addEventListener("click", () => {
      if (gallery.length === 0) return;
      currentPopupIndex = (currentPopupIndex - 1 + gallery.length) % gallery.length;
      updatePopupImage();
    });
  }

  if (rightBtn) {
    rightBtn.addEventListener("click", () => {
      if (gallery.length === 0) return;
      currentPopupIndex = (currentPopupIndex + 1) % gallery.length;
      updatePopupImage();
    });
  }

  loadGalleryImages();

  // Flash Grid Generation
  const flashGridContainer = document.querySelector(".flashGridContainer");
  const flashGrid = [];

  async function loadFlashGridImages() {
    try {
      const response = await fetch("https://www.ravensnest.ink/api/images/flash");
      if (!response.ok) throw new Error('Failed to fetch flash images');
      const imageUrls = await response.json();
      flashGrid.length = 0;
      imageUrls.forEach(url => flashGrid.push(new Photo(url)));
      displayFlashGrid();
    } catch (err) {
      showToast('Failed to load flash images: ' + err.message);
    }
  }

  function displayFlashGrid() {
    flashGridContainer.innerHTML = '';
    for (let i = 0; i < flashGrid.length; i++) {
      let cell = document.createElement('div');
      cell.className = "flash-grid-item";
      cell.id = `flashPhoto-${i}`;
      cell.style.padding = '1vw';

      let icon = document.createElement('img');
      icon.className = 'flash-grid-item-icon';
      icon.id = 'flash-grid-item-icon' + i;
      icon.src = flashGrid[i].url;
      cell.appendChild(icon);

      icon.addEventListener("click", () => {
        const zoomedImages = document.querySelectorAll(".flash-grid-item-icon.zoomed");
        zoomedImages.forEach(img => {
          if (img !== icon) {
            img.classList.remove("zoomed");
          }
        });
        icon.classList.toggle("zoomed");
      });

      flashGridContainer.appendChild(cell);
    }
  }

  loadFlashGridImages();

  // Form handling
  const form = document.getElementById('inquiryForm');
  if (!form) {
    console.error('Inquiry form not found');
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

  // Image preview
  const inquiryExample = document.getElementById('inquiryExample');
  if (inquiryExample) {
    inquiryExample.addEventListener('change', function () {
      const file = this.files[0];
      const preview = document.getElementById('imagePreview');

      if (!file) {
        preview.style.display = 'none';
        return;
      }

      if (!allowedTypes.includes(file.type)) {
        showToast('Invalid file type. Only JPG or PNG allowed.');
        this.value = '';
        preview.style.display = 'none';
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }

  form.setAttribute('novalidate', true);

  const fields = [
    { id: 'inquiryLocation', errorId: 'locationError', name: 'placement' },
    { id: 'inquirySize', errorId: 'sizeError', name: 'size' },
    { id: 'inquiryDesc', errorId: 'descError', name: 'desc' },
    { id: 'inquiryFirstName', errorId: 'firstNameError', name: 'firstName' },
    { id: 'inquiryLastName', errorId: 'lastNameError', name: 'lastName' },
    { id: 'inquiryEmail', errorId: 'emailError', name: 'email' },
    { id: 'inquiryPhone', errorId: 'phoneError', name: 'phone' },
    { id: 'inquiryAvailabilityFrom', errorId: 'fromDateError', name: 'dateFrom' },
    { id: 'inquiryAvailabilityTo', errorId: 'toDateError', name: 'dateTo' },
  ];

  // Phone Mask
  const phoneInput = document.getElementById('inquiryPhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let x = e.target.value.replace(/\D/g, '').substring(0, 10);
      let formatted = '';
      if (x.length > 0) formatted += '(' + x.substring(0, 3);
      if (x.length >= 4) formatted += ') ' + x.substring(3, 6);
      if (x.length >= 7) formatted += '-' + x.substring(6, 10);
      e.target.value = formatted;
    });
  }

  // Size Mask
  const sizeInput = document.getElementById('inquirySize');
  if (sizeInput) {
    sizeInput.addEventListener('input', (e) => {
      const input = e.target;
      const cursorPos = input.selectionStart;
      const prevValue = input.value;
      let digits = prevValue.replace(/[^\d]/g, '').substring(0, 4);
      
      // Allow backspace/delete without immediate reformatting
      if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
        input.value = prevValue;
        input.setSelectionRange(cursorPos, cursorPos);
        return;
      }

      let formatted = '';
      if (digits.length <= 2) {
        formatted = digits;
      } else {
        formatted = digits.substring(0, 2) + `"x` + digits.substring(2) + '"';
      }

      // Adjust cursor position
      let newCursorPos = cursorPos;
      if (digits.length > 2 && cursorPos > 2) {
        newCursorPos += 3; // Account for '"x' added
      }
      if (prevValue.length > formatted.length) {
        newCursorPos = Math.max(0, cursorPos - 1);
      }

      input.value = formatted;
      input.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  // Error handling
  const showError = (input, errorId, message) => {
    input.classList.add('invalid');
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = message;
    }
  };

  const clearError = (input, errorId) => {
    input.classList.remove('invalid');
    const errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.textContent = '';
  };

  fields.forEach(({ id, errorId }) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', () => clearError(input, errorId));
    }
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let hasErrors = false;

    fields.forEach(({ id, errorId }) => {
      const input = document.getElementById(id);
      if (!input) return;

      const value = input.value.trim();

      if (input.required && value === '') {
        showError(input, errorId, 'This field is required.');
        hasErrors = true;
        return;
      } else {
        clearError(input, errorId);
      }

      if (id === 'inquiryEmail' && value && !/^\S+@\S+\.\S+$/.test(value)) {
        showError(input, errorId, 'Enter a valid email.');
        hasErrors = true;
      }

      if (id === 'inquiryPhone' && value && value.replace(/\D/g, '').length < 10) {
        showError(input, errorId, 'Enter a 10-digit phone number.');
        hasErrors = true;
      }
    });

    const fromInput = document.getElementById('inquiryAvailabilityFrom');
    const toInput = document.getElementById('inquiryAvailabilityTo');
    const toError = document.getElementById('toDateError');

    if (fromInput && toInput && fromInput.value && toInput.value) {
      const fromDate = new Date(fromInput.value);
      const toDate = new Date(toInput.value);
      if (toDate < fromDate) {
        showError(toInput, 'toDateError', 'End date must be after start date.');
        hasErrors = true;
      } else {
        clearError(toInput, 'toDateError');
      }
    }

    if (hasErrors) return;

    const formData = new FormData();
    fields.forEach(({ id, name }) => {
      const input = document.getElementById(id);
      formData.append(name, input.value.trim());
    });

    if (form.file?.files[0]) {
      formData.append('file', form.file.files[0]);
    }

    const recaptchaToken = grecaptcha.getResponse();
    if (!recaptchaToken) {
      showToast('Please complete the reCAPTCHA.');
      return;
    }
    formData.append('g-recaptcha-response', recaptchaToken);

    try {
      const response = await fetch('https://www.ravensnest.ink/submit-form', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Submission failed with status ${response.status}`);
      }

      showToast(result.message || 'Submission received!');
      form.reset();
      document.getElementById('imagePreview').style.display = 'none';
      grecaptcha.reset();
      document.getElementById('menuModal').style.display = 'none';
    } catch (err) {
      console.error('Form submission error:', err);
      showToast('Submission failed: ' + err.message);
    }
  });
});