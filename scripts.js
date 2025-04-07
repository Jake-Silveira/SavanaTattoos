// Get the modal
var modal = document.getElementById("menuModal");
var modalContent = document.getElementById("modalContent");
var menuList = document.getElementById("menuList");
var socialsList = document.getElementById("socialsList");
var flashModal = document.getElementById("flashModal");
var savanaModal = document.getElementById("savanaModal");

// Get the button that opens the modal
var menuBtn = document.getElementById("menuBtn");
var socialsBtn = document.getElementById("socialsBtn");
var flashBtn = document.getElementById("flashBtn");
var savana = document.getElementById("savana");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on the button, open the modal
menuBtn.onclick = function() {
  modal.style.display = "block";
  modalContent.style.margin = "0 0";
  modalContent.style.width = "200px";
  modalContent.style.height = "100%";
  modalContent.style.borderRadius = "0px";
  modalContent.style.padding = "4px";
  socialsList.style.display = "none";
  flashModal.style.display = "none";
  savanaModal.style.display = "none";
  menuList.style.display = "flex";
}

socialsBtn.onclick = function() {
  wideModal();
  socialsList.style.display = "flex";
  flashModal.style.display = "none";
  savanaModal.style.display = "none";
};

flashBtn.onclick = function() {
  wideModal();
  flashModal.style.display = "block";
  socialsList.style.display = "none";
  savanaModal.style.display = "none";
  modalContent.style.width = "80%";
};

savana.onclick = function() {
  wideModal();
  savanaModal.style.display = "flex";
  flashModal.style.display = "none";
  socialsList.style.display = "none";
  modalContent.style.width = "70%";
}

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
  menuList.style.display = "none";
};