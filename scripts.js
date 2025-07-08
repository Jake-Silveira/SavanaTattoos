// Get the modal
var modal = document.getElementById("menuModal");
var modalContent = document.getElementById("modalContent");
var menuList = document.getElementById("menuList");
var socialsList = document.getElementById("socialsList");
var flashModal = document.getElementById("flashModal");
var savanaModal = document.getElementById("savanaModal");
var inquiryModal = document.getElementById("inquiryModal");
var galleryModal = document.getElementById("galleryModal");

// Get the button that opens the modal
var menuBtn = document.getElementById("menuBtn");
var socialsBtn = document.getElementById("socialsBtn");
var flashBtn = document.getElementById("flashBtn");
var savana = document.getElementById("savana");
var inquiryBtn = document.getElementById("inquiry");
var galleryBtn = document.getElementById("gallery");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on the button, open the modal
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
}

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

inquiryBtn.onclick = function() {
  wideModal();
  savanaModal.style.display = "none";
  flashModal.style.display = "none";
  socialsList.style.display = "none";
  galleryModal.style.display = "none";
  inquiryModal.style.display = "flex";
  modalContent.style.width = "80%";
  modalContent.style.height = "90%";
};
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

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
  modal.style.display = "none";
};

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

window.ontouchstart = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

const wideModal = function(){
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
};

//Gallery Generation//
const galleryPhotos = document.querySelector(".galleryPhotos");
const gallery = [];
const galleryPopup = document.getElementById("galleryPopup");
const leftBtn = document.getElementById("galleryLeft");
const rightBtn = document.getElementById("galleryRight");

let currentPopupIndex = 0;

async function loadGalleryImages() {
  const response = await fetch("images/galleryImages/galleryImages.json");
  const imageNames = await response.json();

  for (let i = 0; i < imageNames.length; i++) {
    const photo = new Photo(imageNames[i]);
    gallery.push(photo);
  }

  displayGallery();
  startGallery();
};

class Photo {
  constructor(filename) {
    this.name = filename;
  }
};

function displayGallery() {
  for (let i = 0; i < gallery.length; i++) {
    let cell = document.createElement('div');
    cell.className = "grid-item";
    cell.id = `photo-${i}`;
    cell.style.padding = '1vw';

    let icon = document.createElement('img');
    icon.className = 'grid-item-icon';
    icon.id = 'grid-item-icon' + i;
    icon.src = `images/galleryImages/${gallery[i].name}`;
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
  modal.innerHTML = ''; // Clear previous content

  const popupIcon = document.createElement('img');
  popupIcon.className = 'popupImg';
  popupIcon.src = `images/galleryImages/${gallery[currentPopupIndex].name}`;

popupIcon.addEventListener("click", (e) => {
  if (e.target === popupIcon) {
    if (modal.classList.contains("fullscreen")) {
      modal.classList.remove("fullscreen");
      popupIcon.classList.remove("zoomed");
    } else {
      modal.classList.add("fullscreen");
      popupIcon.classList.add("zoomed");
    };
  };
});

  modal.appendChild(popupIcon);
}

// Navigation buttons
leftBtn.addEventListener("click", () => {
  if (gallery.length === 0) return;
  currentPopupIndex = (currentPopupIndex - 1 + gallery.length) % gallery.length;
  updatePopupImage();
});

rightBtn.addEventListener("click", () => {
  if (gallery.length === 0) return;
  currentPopupIndex = (currentPopupIndex + 1) % gallery.length;
  updatePopupImage();
});

loadGalleryImages(); // start everything

//FlashGrid Generation//
const flashGridContainer = document.querySelector(".flashGridContainer");
const flashGrid = [];

async function loadFlashGridImages() {
  const response = await fetch("images/flashImages/flashImages.json");

  if (!response.ok) {
    console.error("Failed to fetch flashImages.json:", response.statusText);
    return;
  }

  const imageNames = await response.json();
  console.log("Fetched flash image names:", imageNames);

  for (let i = 0; i < imageNames.length; i++) {
    const photo = new Photo(imageNames[i]);
    flashGrid.push(photo);
  }

  console.log("flashGrid after load:", flashGrid);
  displayFlashGrid();
}


function displayFlashGrid() {
  for (let i = 0; i < flashGrid.length; i++) {
    let cell = document.createElement('div');
    cell.className = "flash-grid-item";
    cell.id = `flashPhoto-${i}`;
    cell.style.padding = '1vw';

    let icon = document.createElement('img');
    icon.className = 'flash-grid-item-icon';
    icon.id = 'flash-grid-item-icon' + i;
    icon.src = `images/flashImages/${flashGrid[i].name}`;
    cell.appendChild(icon);

    icon.addEventListener("click", () => {
      // Find any other zoomed images and reset them
      const zoomedImages = document.querySelectorAll(".flash-grid-item-icon.zoomed");
      zoomedImages.forEach(img => {
        if (img !== icon) {
          img.classList.remove("zoomed");
        }
      });

  // Toggle zoom on the clicked image
  icon.classList.toggle("zoomed");
});

    flashGridContainer.appendChild(cell);
  };
};

loadFlashGridImages();
console.log("flashGridContainer:", flashGridContainer);
console.log("flashGrid length:", flashGrid.length);