// script.js — PhotoFix (with numbered markers)
// ----------------- START-2001: TEMPLATES -----------------
const TEMPLATES = {
  "rrb-ntpc": { id:"rrb-ntpc", title:"RRB NTPC — Photo", width:413, height:531, kb:50, format:"image/jpeg", description:"RRB NTPC recommended: 413×531 px." },
  "ssc-gd":   { id:"ssc-gd",   title:"SSC GD — Photo",   width:300, height:400, kb:50, format:"image/jpeg", description:"SSC GD recommended: 300×400 px." },
  "signature":{ id:"signature",title:"Signature",        width:160, height:60,  kb:40, format:"image/jpeg", description:"Signature (RRB NTPC): 160×60 px — final size 31–49 KB." }
};
// ----------------- END-2001 -----------------

// ----------------- START-2002: DOM REFERENCES -----------------
const templateGrid   = document.getElementById('templateGrid');
const templateSelect = document.getElementById('templateSelect');
const modalBackdrop  = document.getElementById('modalBackdrop');
const modalTitle     = document.getElementById('modalTitle');
const modalMeta      = document.getElementById('modalMeta');
const modalDetails   = document.getElementById('modalDetails');

const fileInput  = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const fileInfo   = document.getElementById('fileInfo');
const origInfo   = document.getElementById('origInfo');
const resInfo    = document.getElementById('resInfo');

const targetWidth  = document.getElementById('targetWidth');
const targetHeight = document.getElementById('targetHeight');
const kbLimit      = document.getElementById('kbLimit');
const targetFormat = document.getElementById('targetFormat');
const processBtn   = document.getElementById('processBtn');
const downloadBtn  = document.getElementById('downloadBtn');
const status       = document.getElementById('status');
const loader       = document.getElementById('loader');
// ----------------- END-2002 -----------------

// ----------------- START-2003: INIT TEMPLATES -----------------
(function initTemplates(){
  Object.values(TEMPLATES).forEach(t => {
    // add card
    const c = document.createElement('div');
    c.className = 'tpl-card';
    c.onclick = ()=> openModal(t.id);
    c.innerHTML = `<h3>${t.title}</h3><p>${t.width} × ${t.height} px · ${t.kb} KB</p>`;
    templateGrid.appendChild(c);

    // add to dropdown
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.innerText = t.title;
    templateSelect.appendChild(opt);
  });
})();
// ----------------- END-2003 -----------------

// ----------------- START-2004: MODAL HANDLERS -----------------
function openModal(id){
  const t = TEMPLATES[id];
  modalBackdrop.style.display = 'flex';
  modalTitle.innerText = t.title;
  modalMeta.innerText = `${t.width} × ${t.height} px · ${t.kb} KB`;
  modalDetails.innerText = t.description;
  modalBackdrop.setAttribute('data-active', id);
}
function closeModal(){
  modalBackdrop.style.display = 'none';
  modalBackdrop.removeAttribute('data-active');
}
function useTemplate(){
  const id = modalBackdrop.getAttribute('data-active');
  if(!id) return;
  const t = TEMPLATES[id];
  templateSelect.value = t.id;
  targetWidth.value = t.width; targetHeight.value = t.height; kbLimit.value = t.kb; targetFormat.value = t.format;
  closeModal();
}
templateSelect.addEventListener('change', (e) => {
  const t = TEMPLATES[e.target.value];
  if(t){ targetWidth.value = t.width; targetHeight.value = t.height; kbLimit.value = t.kb; targetFormat.value = t.format; }
});
// ----------------- END-2004 -----------------

// ----------------- START-2005: FILE UPLOAD HANDLER -----------------
let currentFile = null;
let processedBlob = null;

fileInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) { currentFile = null; previewImg.src=''; fileInfo.innerText=''; return; }
  if (!f.type || !f.type.startsWith('image/')) { alert('Kripya image file hi upload karein (JPG/PNG).'); return; }
  currentFile = f; processedBlob = null;

  // mobile-safe preview
  const fr = new FileReader();
  fr.onload = () => { previewImg.src = fr.result; };
  fr.onerror = () => { previewImg.src = ''; };
  fr.readAsDataURL(f);

  fileInfo.innerText = `Original: ${(f.size/1024).toFixed(1)} KB · ${f.type}`;
  if(origInfo) origInfo.innerText = `${f.name} · ${(f.size/1024).toFixed(1)} KB`;
  if(resInfo) resInfo.innerText = '—';
  downloadBtn.disabled = true; status.innerText = '';
});
// ----------------- END-2005 -----------------

// ----------------- START-2006: loadImage (robust) -----------------
function loadImage(file){
  return new Promise((resolve, reject) => {
    if(!file) return reject(new Error('No file provided'));
    if(!file.type || !file.type.startsWith('image/')) return reject(new Error('Not an image file'));
    const reader = new FileReader();
    reader.onerror = () => { reader.abort(); reject(new Error('File read error')); };
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image load error'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
// ----------------- END-2006 -----------------

// ----------------- START-2007: IMAGE UTILITIES (trim/scale/enforce) -----------------
function canvasToBlob(canvas, type='image/jpeg', q=0.9){ return new Promise(res=>canvas.toBlob(b=>res(b), type, q)); }

function trimCanvasWithPadding(canvas, pad=8, threshold=245){
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0,0,w,h).data;
  let top=h,left=w,right=0,bottom=0;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i = (y*w + x)*4;
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if(a>10 && !(r>threshold && g>threshold && b>threshold)){
        if(x<left) left=x; if(x>right) right=x; if(y<top) top=y; if(y>bottom) bottom=y;
      }
    }
  }
  if(right<left||bottom<top) return canvas;
  left=Math.max(0,left-pad); top=Math.max(0,top-pad); right=Math.min(w-1,right+pad); bottom=Math.min(h-1,bottom+pad);
  const nw = right-left+1, nh = bottom-top+1;
  const out = document.createElement('canvas'); out.width=nw; out.height=nh;
  out.getContext('2d').drawImage(canvas,left,top,nw,nh,0,0,nw,nh);
  return out;
}

async function enforceMinSizeByScaling(baseCanvas, minBytes, mime='image/jpeg', quality=0.95, isSignature=false){
  for(let s=1.1; s<=1.6; s+=0.1){
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(1, Math.round(baseCanvas.width * s));
    tmp.height = Math.max(1, Math.round(baseCanvas.height * s));
    const tctx = tmp.getContext('2d');
    if(mime!=='image/png'){ tctx.fillStyle='#fff'; tctx.fillRect(0,0,tmp.width,tmp.height); }
    tctx.drawImage(baseCanvas,0,0,tmp.width,tmp.height);
    if(isSignature){ tctx.strokeStyle='rgba(0,0,0,0.04)'; tctx.lineWidth=Math.max(1,Math.round(tmp.height*0.01)); tctx.strokeRect(1,1,tmp.width-2,tmp.height-2); }
    const blob = await new Promise(res=>tmp.toBlob(b=>res(b),mime,quality));
    if(blob.size>=minBytes) return blob;
  }

  if(isSignature){
    const tmp2 = document.createElement('canvas');
    tmp2.width = Math.max(1, Math.round(baseCanvas.width * 1.6));
    tmp2.height = Math.max(1, Math.round(baseCanvas.height * 1.6));
    const nctx = tmp2.getContext('2d');
    nctx.fillStyle = '#fff'; nctx.fillRect(0,0,tmp2.width,tmp2.height);
    nctx.drawImage(baseCanvas,0,0,tmp2.width,tmp2.height);
    try{
      const id = nctx.getImageData(0,0,tmp2.width,tmp2.height); const pdata = id.data;
      const totalPixels = tmp2.width * tmp2.height; const noiseCount = Math.max(20, Math.round(totalPixels * 0.004));
      for(let i=0;i<noiseCount;i++){ const px=Math.floor(Math.random()*tmp2.width); const py=Math.floor(Math.random()*tmp2.height); const idx=(py*tmp2.width+px)*4; pdata[idx]=Math.max(0,pdata[idx]-Math.floor(Math.random()*30)); pdata[idx+1]=Math.max(0,pdata[idx+1]-Math.floor(Math.random()*30)); pdata[idx+2]=Math.max(0,pdata[idx+2]-Math.floor(Math.random()*30)); pdata[idx+3]=255; }
      nctx.putImageData(id,0,0);
    }catch(e){ console.warn('Noise add failed',e); }
    const blob2 = await new Promise(res=>tmp2.toBlob(b=>res(b),mime,quality)); return blob2;
  }

  const finalCanvas = document.createElement('canvas'); finalCanvas.width = Math.max(1, Math.round(baseCanvas.width * 1.6)); finalCanvas.height = Math.max(1, Math.round(baseCanvas.height * 1.6)); finalCanvas.getContext('2d').drawImage(baseCanvas,0,0,finalCanvas.width,finalCanvas.height);
  return await new Promise(res=>finalCanvas.toBlob(b=>res(b),mime,quality));
}
// ----------------- END-2007 -----------------

// ----------------- START-2008: RESIZE FUNCTION -----------------
async function resizeImage(file, targetW, targetH, kbLimit, format, autoTrim=false){
  const img = await loadImage(file);

  // center-crop to match aspect ratio
  const targetAspect = targetW / targetH;
  let sx=0, sy=0, sw=img.width, sh=img.height;
  const srcAspect = img.width / img.height;
  if(srcAspect > targetAspect){
    sw = Math.round(img.height * targetAspect); sx = Math.round((img.width - sw)/2);
  } else {
    sh = Math.round(img.width / targetAspect); sy = Math.round((img.height - sh)/2);
  }

  const cropCanvas = document.createElement('canvas'); cropCanvas.width = sw; cropCanvas.height = sh;
  cropCanvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  if(autoTrim){
    const trimmed = trimCanvasWithPadding(cropCanvas, 10);
    cropCanvas.width = trimmed.width; cropCanvas.height = trimmed.height;
    cropCanvas.getContext('2d').clearRect(0,0,cropCanvas.width,cropCanvas.height);
    cropCanvas.getContext('2d').drawImage(trimmed, 0, 0);
  }

  const finalCanvas = document.createElement('canvas'); finalCanvas.width = targetW; finalCanvas.height = targetH;
  const fctx = finalCanvas.getContext('2d');
  fctx.fillStyle = '#ffffff'; fctx.fillRect(0,0,targetW,targetH);
  fctx.drawImage(cropCanvas, 0, 0, cropCanvas.width, cropCanvas.height, 0, 0, targetW, targetH);

  let maxBytes = Math.max(1024, Math.round(kbLimit * 1024));
  let minBytes = Math.max(512, Math.round(kbLimit * 1024 * 0.50));
  if(autoTrim){ minBytes = 31 * 1024; maxBytes = 49 * 1024; }

  const canvasToBlobP = (can, mime, q) => new Promise(res => can.toBlob(b => res(b), mime, q));

  if(format === 'image/png'){
    let blob = await canvasToBlobP(finalCanvas, 'image/png', 1.0);
    if(blob.size < minBytes) blob = await enforceMinSizeByScaling(finalCanvas, minBytes, 'image/png', 1.0, autoTrim);
    return blob;
  } else {
    let quality = 0.95; const minQuality = 0.30;
    let blob = await canvasToBlobP(finalCanvas, 'image/jpeg', quality);
    while(blob.size > maxBytes && quality > minQuality){ quality = Math.max(minQuality, quality - 0.06); blob = await canvasToBlobP(finalCanvas, 'image/jpeg', quality); }
    let shrink = 0;
    while(blob.size > maxBytes && shrink < 8){ shrink++; const scale = (100 - shrink) / 100; const tmp = document.createElement('canvas'); tmp.width = Math.max(1, Math.round(targetW * scale)); tmp.height = Math.max(1, Math.round(targetH * scale)); tmp.getContext('2d').drawImage(finalCanvas, 0, 0, tmp.width, tmp.height); blob = await canvasToBlobP(tmp,'image/jpeg',quality); }
    if(blob.size < minBytes){ const bigger = await enforceMinSizeByScaling(finalCanvas, minBytes, 'image/jpeg', 0.95, autoTrim); if(bigger && bigger.size >= minBytes) blob = bigger; }
    return blob;
  }
}
// ----------------- END-2008 -----------------

// ----------------- START-2009: PROCESS BUTTON HANDLER -----------------
processBtn.addEventListener('click', async () => {
  if(!currentFile){ alert('Kripya pehle image upload karein.'); status.innerText = 'Please upload an image.'; return; }
  const w = parseInt(targetWidth.value, 10) || 0;
  const h = parseInt(targetHeight.value, 10) || 0;
  const kb = parseInt(kbLimit.value, 10) || 50;
  const fmt = targetFormat.value || 'image/jpeg';
  const templateId = templateSelect.value;
  if(!w || !h){ alert('Width / Height sahi bharein.'); status.innerText = 'Width/Height required.'; return; }
  const isSignature = (templateId === 'signature');

  if(loader) loader.style.display = 'inline';
  processBtn.disabled = true;
  status.innerText = 'Processing...';

  try{
    const blob = await resizeImage(currentFile, w, h, kb, fmt, isSignature);
    if(!blob) throw new Error('Processing returned empty.');
    processedBlob = blob;
    const url = URL.createObjectURL(blob);
    previewImg.src = url;
    fileInfo.innerText = `Processed: ${(blob.size/1024).toFixed(1)} KB · ${blob.type}`;
    if(resInfo) resInfo.innerText = `${(blob.size/1024).toFixed(1)} KB`;
    status.innerText = 'Done — file ready.';
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => {
      const ext = (blob.type === 'image/png') ? 'png' : 'jpg';
      const base = (currentFile && currentFile.name) ? currentFile.name.split('.').slice(0,-1).join('.') : 'photo';
      downloadBlob(blob, `${base}_resized.${ext}`);
    };
  } catch(err){
    console.error(err);
    alert('Processing error: ' + (err.message || err));
    status.innerText = 'Error: ' + (err.message || err);
  } finally {
    if(loader) loader.style.display = 'none';
    processBtn.disabled = false;
  }
});
// ----------------- END-2009 -----------------
