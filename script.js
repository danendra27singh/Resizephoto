// Templates
const TEMPLATES = {
  "rrb-ntpc": { title:"RRB NTPC — Photo", width:413, height:531, kb:50, format:"image/jpeg",
    description:"RRB NTPC recommended size: 413×531 px." },

  "ssc-gd": { title:"SSC GD — Photo", width:300, height:400, kb:50, format:"image/jpeg",
    description:"SSC GD recommended size: 300×400 px." },

  "signature": { title:"Signature", width:140, height:60, kb:20, format:"image/png",
    description:"Signature ko white paper par likh kar upload karein." }
};

// UI elements
const fileInput = document.getElementById("fileInput");
const previewImg = document.getElementById("previewImg");
const templateSelect = document.getElementById("templateSelect");
const targetWidth = document.getElementById("targetWidth");
const targetHeight = document.getElementById("targetHeight");
const kbLimit = document.getElementById("kbLimit");
const targetFormat = document.getElementById("targetFormat");
const processBtn = document.getElementById("processBtn");
const downloadBtn = document.getElementById("downloadBtn");
const status = document.getElementById("status");
const fileInfo = document.getElementById("fileInfo");

// Modal elements
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalDetails = document.getElementById("modalDetails");

// Fill template dropdown
for (let key in TEMPLATES) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.innerText = TEMPLATES[key].title;
  templateSelect.appendChild(opt);
}

// Modal open
function openModal(id){
  const t = TEMPLATES[id];
  modalBackdrop.style.display = "flex";
  modalTitle.innerText = t.title;
  modalMeta.innerText = `${t.width}×${t.height}px · ${t.kb}KB`;
  modalDetails.innerText = t.description;
  modalBackdrop.setAttribute("active", id);
}

// Modal close
function closeModal(){
  modalBackdrop.style.display = "none";
}

// Use template
function useTemplate(){
  const id = modalBackdrop.getAttribute("active");
  const t = TEMPLATES[id];
  templateSelect.value = id;

  targetWidth.value = t.width;
  targetHeight.value = t.height;
  kbLimit.value = t.kb;
  targetFormat.value = t.format;

  closeModal();
}

// Apply template from dropdown
templateSelect.addEventListener("change", () => {
  const t = TEMPLATES[templateSelect.value];
  if (!t) return;
  targetWidth.value = t.width;
  targetHeight.value = t.height;
  kbLimit.value = t.kb;
  targetFormat.value = t.format;
});

// Image upload preview
let currentFile = null;
fileInput.addEventListener("change", () => {
  currentFile = fileInput.files[0];
  previewImg.src = URL.createObjectURL(currentFile);
  fileInfo.innerText = `Original: ${(currentFile.size/1024).toFixed(1)} KB`;
});

// Resize + compress
processBtn.addEventListener("click", async () => {
  if (!currentFile) {
    status.innerText = "Image upload karein.";
    return;
  }

  const w = +targetWidth.value;
  const h = +targetHeight.value;
  const kb = +kbLimit.value;
  const format = targetFormat.value;

  status.innerText = "Processing...";

  const output = await resizeImage(currentFile, w, h, kb, format);

  const url = URL.createObjectURL(output);
  previewImg.src = url;
  fileInfo.innerText = `Processed: ${(output.size/1024).toFixed(1)} KB`;

  downloadBtn.disabled = false;
  downloadBtn.onclick = () => download(output, "resized.jpg");

  status.innerText = "Done!";
});

// Resize function
async function resizeImage(file, width, height, kbLimit, format){
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,width,height);
  ctx.drawImage(img, 0, 0, width, height);

  let q = 0.95;
  let blob = await toBlob(canvas, format, q);

  while (blob.size > kbLimit * 1024 && q > 0.2){
    q -= 0.05;
    blob = await toBlob(canvas, format, q);
  }

  return blob;
}

function loadImage(file){
  return new Promise((res)=>{
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = ()=>res(img);
  });
}

function toBlob(canvas, type, q){
  return new Promise(res => canvas.toBlob(b => res(b), type, q));
}

function download(blob, name){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
