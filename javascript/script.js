// Mobile + Browser ready script.js

document.addEventListener("DOMContentLoaded", function() {
  // --- DOM Elements ---
  var uploadArea = document.getElementById("uploadArea");
  var fileInput = document.getElementById("fileInput");
  var targetSizeInput = document.getElementById("targetSize");
  var preview = document.getElementById("preview");
  var downloadAllBtn = document.getElementById("downloadAll");

  var imagesData = [];

  // --- Capacitor plugin check ---
  let Filesystem, Directory, Encoding;
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
    ({ Filesystem, Directory, Encoding } = window.Capacitor.Plugins.Filesystem);
  }

  // --- Click upload area ---
  uploadArea.addEventListener("click", function() {
    fileInput.click();
  });

  // --- Drag & Drop ---
  uploadArea.addEventListener("dragover", function(e) {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });
  uploadArea.addEventListener("dragleave", function() {
    uploadArea.classList.remove("dragover");
  });
  uploadArea.addEventListener("drop", function(e) {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  });

  // --- File input change ---
  fileInput.addEventListener("change", function(e) {
    if (e.target.files) handleFiles(e.target.files);
  });

  // --- Handle files ---
  function handleFiles(files) {
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (file.type !== "image/png" && file.type !== "image/jpeg") {
        alert(file.name + " is not supported! Only PNG and JPG allowed.");
        continue;
      }

      (function(f) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var img = new Image();
          img.src = e.target.result;
          img.onload = function() {
            compressAndPreview(img, f.name);
          };
          img.onerror = function() {
            alert(f.name + " could not be loaded!");
          };
        };
        reader.onerror = function() {
          alert(f.name + " could not be read!");
        };
        reader.readAsDataURL(f);
      })(file);
    }
  }

  // --- Compress and preview ---
  function compressAndPreview(img, fileName) {
    var targetKB = parseInt(targetSizeInput.value);
    if (!targetKB || targetKB < 50) targetKB = 200;

    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");

    var MAX_DIM = 4000;
    var scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    try {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      var quality = 0.9;
      var dataUrl = canvas.toDataURL("image/jpeg", quality);
      var sizeKB = atob(dataUrl.split(',')[1]).length / 1024;

      while (sizeKB > targetKB && quality > 0.05) {
        quality -= 0.05;
        if (quality < 0.3) {
          scale -= 0.05;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL("image/jpeg", quality);
        sizeKB = atob(dataUrl.split(',')[1]).length / 1024;
      }

      var imageObj = { name: fileName, dataUrl: dataUrl };
      imagesData.push(imageObj);

      // --- Preview card ---
      var card = document.createElement("div");
      card.className = "preview-card";
      card.innerHTML =
        '<button class="remove-btn">&times;</button>' +
        '<p><strong>' + fileName + '</strong></p>' +
        '<p>Size: ' + sizeKB.toFixed(2) + ' KB</p>' +
        '<img src="' + dataUrl + '" alt="' + fileName + '">';

      preview.appendChild(card);

      // --- Remove button ---
      card.querySelector(".remove-btn").addEventListener("click", function() {
        preview.removeChild(card);
        imagesData = imagesData.filter(function(i) { return i.dataUrl !== imageObj.dataUrl; });
        if (imagesData.length === 0) downloadAllBtn.style.display = "none";
      });

      if (imagesData.length > 0) downloadAllBtn.style.display = "inline-block";

    } catch(err) {
      alert(fileName + " could not be processed!");
      console.error(err);
    }
  }

  // --- Save image on mobile ---
  async function saveImageMobile(name, dataUrl) {
    if (!Filesystem) {
      alert("Mobile download not supported in browser. Using fallback.");
      return;
    }
    try {
      const base64Data = dataUrl.split(',')[1];
      await Filesystem.writeFile({
        path: name,
        data: base64Data,
        directory: Directory.Documents,
        encoding: Encoding.BASE64
      });
      alert(`${name} saved to device`);
    } catch (e) {
      console.error('Error saving file', e);
      alert(`Failed to save ${name} on device`);
    }
  }

  // --- Download all ---
  downloadAllBtn.addEventListener("click", async function() {
    if (window.Capacitor && Filesystem) {
      // Mobile app
      for (let img of imagesData) {
        await saveImageMobile(img.name, img.dataUrl);
      }
    } else {
      // Browser fallback
      for (let img of imagesData) {
        const a = document.createElement("a");
        a.href = img.dataUrl;
        a.download = img.name;
        a.click();
      }
    }
  });
});



const pdfInput = document.getElementById("pdfFileInput");
const pdfSelectBtn = document.getElementById("pdfSelectBtn");
const pdfPreview = document.getElementById("pdfPreview");
const pdfCreateBtn = document.getElementById("pdfCreateBtn");
const targetSizeInput = document.getElementById("targetSizePdf"); // in KB

pdfSelectBtn.addEventListener("click", () => pdfInput.click());

pdfInput.addEventListener("change", () => {
  pdfPreview.innerHTML = "";
  const files = Array.from(pdfInput.files);

  if (files.length > 0) pdfCreateBtn.style.display = "inline-block";

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement("img");
      img.src = e.target.result;
      pdfPreview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
});

new Sortable(pdfPreview, {
  animation: 150,
  ghostClass: "drag-ghost",
});

pdfCreateBtn.addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const images = pdfPreview.querySelectorAll("img");
  const targetSizeKB = parseFloat(targetSizeInput.value) || 500; // default 500 KB
  const targetSizeBytes = targetSizeKB * 1024;

  let quality = 0.95;
  let pdfBlob;

  // Compress image function
  const compressImage = (img, quality) => {
    return new Promise(resolve => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
    });
  };

  do {
    const doc = new jsPDF();
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const blob = await compressImage(img, quality);
      const url = URL.createObjectURL(blob);

      const imgProps = doc.getImageProperties(url);
      const pdfWidth = 180;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (i > 0) doc.addPage();
      doc.addImage(url, "JPEG", 15, 20, pdfWidth, pdfHeight);
    }

    pdfBlob = doc.output("blob");
    quality -= 0.05; // reduce quality gradually
  } while (pdfBlob.size > targetSizeBytes && quality > 0.1);

  const finalDoc = new jsPDF();
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const blob = await compressImage(img, quality);
    const url = URL.createObjectURL(blob);

    const imgProps = finalDoc.getImageProperties(url);
    const pdfWidth = 180;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    if (i > 0) finalDoc.addPage();
    finalDoc.addImage(url, "JPEG", 15, 20, pdfWidth, pdfHeight);
  }

  finalDoc.save("my-images.pdf");
});
