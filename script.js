
// script.js — Full updated file
// Includes: templates, improved resizeImage, signature special rules (31-49 KB), trimming, preview, download.

// ---------------- TEMPLATES ----------------
const TEMPLATES = {
  "rrb-ntpc": { title: "RRB NTPC — Photo", width: 413, height: 531, kb: 50, format: "image/jpeg",
    description: "RRB NTPC recommended size: 413×531 px." },

  "ssc-gd": { title: "SSC GD — Photo", width: 300, height: 400, kb: 50, format: "image/jpeg",
    description: "SSC GD recommended size: 300×400 px." },

  "signature": {
    id: "signature",
    title: "Signature",
    width: 160,
    height: 60,
    kb: 40,              // base shown value; actual enforced range handled in code
    format: "image/jpeg",
    description: "Signature for RRB NTPC — 160×60 px — final output forced between 31–49 KB"
  }
};

// ---------------- DOM elements ----------------
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

// modal elements (if present)
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalDetails = document.getElementById("modalDetails");

// preview info elements (optional)
const origInfo = document.getElementById("origInfo");
const resInfo = document.getElementById("resInfo");
const loader = document.getElementById("loader");

// ---------------- populate templates dropdown ----------------
for (let key in TEMPLATES) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.innerText = TEMPLATES[key].title;
  templateSelect.appendChild(opt);
}

// ---------------- modal helpers ----------------
function openModal(id){
  if(!modalBackdrop) return;
  const t = TEMPLATES[id];
  modalBackdrop.style.display = "flex";
  modalTitle.innerText = t.title;
  modalMeta.innerText = `${t.width}×${t.height}px · ${t.kb} KB`;
  modalDetails.innerText = t.description;
  modalBackdrop.setAttribute("active", id);
}
function closeModal(){
  if(!modalBackdrop) return;
  modalBackdrop.style.display = "none";
  modalBackdrop.removeAttribute("active");
}
function useTemplate(){
  if(!modalBackdrop) return;
  const id = modalBackdrop.getAttribute("active");
  if(!id) return;
  const t = TEMPLATES[id];
  templateSelect.value = id;
  targetWidth.value = t.width;
  targetHeight.value = t.height;
  kbLimit.value = t.kb;
  targetFormat.value = t.format;
  closeModal();
}

// when template selected from dropdown
templateSelect.addEventListener("change", (e) => {
  const t = TEMPLATES[e.target.value];
  if (!t) return;
  targetWidth.value = t.width;
  targetHeight.value = t.height;
  kbLimit.value = t.kb;
  targetFormat.value = t.format;
});

// ---------------- file upload preview ----------------
let currentFile = null;
let processedBlob = null;

fileInput.addEventListener("change", () => {
  const f = fileInput.files && fileInput.files[0];
  if (!f) return;
  currentFile = f;
  processedBlob = null;
  previewImg.src = URL.createObjectURL(f);
  fileInfo.innerText = `Original: ${(f.size/1024).toFixed(1)} KB · ${f.type}`;
  if(origInfo) origInfo.innerText = `${f.name} · ${(f.size/1024).toFixed(1)} KB`;
  if(resInfo) resInfo.innerText = '—';
  downloadBtn.disabled = true;
  status.innerText = '';
});

// ---------------- helpers ----------------
function loadImage(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error('Image load error')); };
    img.src = url;
  });
}
function canvasToBlob(canvas, type='image/jpeg', quality=0.9){
  return new Promise(res => canvas.toBlob(b => res(b), type, quality));
}
function downloadBlob(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

// trim canvas whitespace with padding
function trimCanvasWithPadding(canvas, pad=8, threshold=245){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0,0,w,h).data;
  let top=h, left=w, right=0, bottom=0;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const idx = (y*w + x)*4;
      const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
      if (a>10 && !(r>threshold && g>threshold && b>threshold)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) return canvas;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(w-1, right + pad);
  bottom = Math.min(h-1, bottom + pad);
  const nw = right - left + 1;
  const nh = bottom - top + 1;
  const out = document.createElement('canvas');
  out.width = nw; out.height = nh;
  out.getContext('2d').drawImage(canvas, left, top, nw, nh, 0, 0, nw, nh);
  return out;
}

// scale-up helper: grow canvas gradually to reach minBytes
async function enforceMinSizeByScaling(baseCanvas, minBytes, mime='image/jpeg', quality=0.95){
  // try scales 110% .. 160%
  for(let s=1.1; s<=1.6; s+=0.1){
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(1, Math.round(baseCanvas.width * s));
    tmp.height = Math.max(1, Math.round(baseCanvas.height * s));
    const tctx = tmp.getContext('2d');
    if(mime !== 'image/png'){ tctx.fillStyle = '#fff'; tctx.fillRect(0,0,tmp.width,tmp.height); }
    tctx.drawImage(baseCanvas, 0, 0, tmp.width, tmp.height);
    const blob = await canvasToBlob(tmp, mime, quality);
    if (blob.size >= minBytes) return blob;
  }
  // fallback: largest attempt
  const fallback = document.createElement('canvas');
  fallback.width = Math.max(1, Math.round(baseCanvas.width * 1.6));
  fallback.height = Math.max(1, Math.round(baseCanvas.height * 1.6));
  fallback.getContext('2d').drawImage(baseCanvas, 0, 0, fallback.width, fallback.height);
  return await canvasToBlob(fallback, mime, quality);
}

// ------------------ resizeImage (improved) ------------------
/*
 Parameters:
  - file: input File
  - targetW, targetH: desired pixels
  - kbLimit: user requested KB (number)
  - format: MIME type 'image/jpeg' or 'image/png'
  - autoTrim: boolean (for signature)
*/
async function resizeImage(file, targetW, targetH, kbLimit, format, autoTrim=false){
  const img = await loadImage(file);

  // center-crop to match aspect ratio (cover)
  const targetAspect = targetW / targetH;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  const srcAspect = img.width / img.height;
  if (srcAspect > targetAspect) {
    sw = Math.round(img.height * targetAspect);
    sx = Math.round((img.width - sw) / 2);
  } else {
    sh = Math.round(img.width / targetAspect);
    sy = Math.round((img.height - sh) / 2);
  }

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = sw; cropCanvas.height = sh;
  cropCanvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  // auto-trim for signature (tight crop)
  if (autoTrim) {
    const trimmed = trimCanvasWithPadding(cropCanvas, 10);
    cropCanvas.width = trimmed.width;
    cropCanvas.height = trimmed.height;
    cropCanvas.getContext('2d').clearRect(0,0,cropCanvas.width,cropCanvas.height);
    cropCanvas.getContext('2d').drawImage(trimmed, 0, 0);
  }

  // draw to final canvas exact pixels
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetW; finalCanvas.height = targetH;
  const fctx = finalCanvas.getContext('2d');
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0,0,targetW,targetH);
  fctx.drawImage(cropCanvas, 0, 0, cropCanvas.width, cropCanvas.height, 0, 0, targetW, targetH);

  // Determine min/max bytes
  let maxBytes = Math.max(1024, Math.round(kbLimit * 1024)); // default max
  let minBytes = Math.max(512, Math.round(kbLimit * 1024 * 0.50)); // default min ~50%

  // If this is signature (autoTrim true OR template is signature), override to 31-49 KB
  if (autoTrim) {
    minBytes = 31 * 1024;
    maxBytes = 49 * 1024;
  }

  // Helper
  const canvasToBlobP = (can, mime, q) => new Promise(res => can.toBlob(b => res(b), mime, q));

  if (format === 'image/png') {
    // Try PNG direct
    let blob = await canvasToBlobP(finalCanvas, 'image/png', 1.0);
    // If too small, scale up to reach minBytes
    if (blob.size < minBytes) {
      blob = await enforceMinSizeByScaling(finalCanvas, minBytes, 'image/png', 1.0);
    }
    // If still too large (>maxBytes) we could fallback to JPEG to compress more. But return as is.
    return blob;
  } else {
    // JPEG path: first reduce quality, then downsizing, then scale-up if too small
    let quality = 0.95;
    const minQuality = 0.30;
    let blob = await canvasToBlobP(finalCanvas, 'image/jpeg', quality);

    // reduce quality loop to meet maxBytes
    while (blob.size > maxBytes && quality > minQuality) {
      quality = Math.max(minQuality, quality - 0.06);
      blob = await canvasToBlobP(finalCanvas, 'image/jpeg', quality);
    }

    // if still too large, shrink dimensions slightly step-by-step
    let shrink = 0;
    while (blob.size > maxBytes && shrink < 8) {
      shrink++;
      const scale = (100 - shrink) / 100;
      const tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.round(targetW * scale));
      tmp.height = Math.max(1, Math.round(targetH * scale));
      tmp.getContext('2d').drawImage(finalCanvas, 0, 0, tmp.width, tmp.height);
      blob = await canvasToBlobP(tmp, 'image/jpeg', quality);
    }

    // If final is too small (<minBytes), scale-up to increase bytes/quality
    if (blob.size < minBytes) {
      const bigger = await enforceMinSizeByScaling(finalCanvas, minBytes, 'image/jpeg', 0.95);
      if (bigger && bigger.size >= minBytes) blob = bigger;
    }

    return blob;
  }
}

// ---------------- process button handler ----------------
processBtn.addEventListener('click', async () => {
  if (!currentFile) {
    alert('Kripya pehle image upload karein.');
    status.innerText = 'Please upload an image.';
    return;
  }

  const w = parseInt(targetWidth.value, 10) || 0;
  const h = parseInt(targetHeight.value, 10) || 0;
  const kb = parseInt(kbLimit.value, 10) || 50;
  const fmt = targetFormat.value || 'image/jpeg';
  const templateId = templateSelect.value;

  if (!w || !h) {
    alert('Width aur Height dono sahi bharein.');
    status.innerText = 'Width/Height required.';
    return;
  }

  // Determine if this is signature template
  const isSignature = (templateId === 'signature');

  // UI changes
  if (loader) loader.style.display = 'inline';
  processBtn.disabled = true;
  status.innerText = 'Processing... Please wait.';

  try {
    // autoTrim true only for signature
    const blob = await resizeImage(currentFile, w, h, kb, fmt, isSignature);

    if (!blob) throw new Error('Processing returned empty result.');

    processedBlob = blob;
    const objUrl = URL.createObjectURL(blob);
    previewImg.src = objUrl;
    fileInfo.innerText = `Processed: ${(blob.size/1024).toFixed(1)} KB · ${blob.type}`;
    if (resInfo) resInfo.innerText = `${(blob.size/1024).toFixed(1)} KB`;
    status.innerText = 'Done — file ready for download.';
    downloadBtn.disabled = false;

    downloadBtn.onclick = () => {
      const ext = (blob.type === 'image/png') ? 'png' : 'jpg';
      const base = (currentFile && currentFile.name) ? currentFile.name.split('.').slice(0,-1).join('.') : 'photo';
      downloadBlob(blob, `${base}_resized.${ext}`);
    };

  } catch (err) {
    console.error('Processing error:', err);
    alert('Processing error: ' + (err.message || err));
    status.innerText = 'Error: ' + (err.message || err);
  } finally {
    if (loader) loader.style.display = 'none';
    processBtn.disabled = false;
  }
});
