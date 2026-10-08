// ==========================================
// CONFIGURACIÓN
// ==========================================
// Aquí irá la URL de tu Google Apps Script.
// Por ahora lo dejamos así, luego la actualizamos.
const APPS_SCRIPT_URL = 'PEGA_AQUI_TU_URL_DE_APPS_SCRIPT';
const CANVAS_SIZE = 1080;       // Tamaño final de la foto (cuadrada)
const JPEG_QUALITY = 0.9;       // Calidad de la imagen (0 a 1)

// ==========================================
// ESTADO
// ==========================================
let currentFrame = null;
let currentFrameName = '';
let stream = null;
let facingMode = 'user'; // 'user' = frontal, 'environment' = trasera
let capturedBlob = null;

// ==========================================
// ELEMENTOS DEL DOM
// ==========================================
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const frameOverlay = document.getElementById('frameOverlay');
const photoResult = document.getElementById('photoResult');
const uploadStatus = document.getElementById('uploadStatus');

const frameStep = document.getElementById('frameStep');
const cameraStep = document.getElementById('cameraStep');
const previewStep = document.getElementById('previewStep');

const captureBtn = document.getElementById('captureBtn');
const flipBtn = document.getElementById('flipBtn');
const backBtn = document.getElementById('backBtn');
const retakeBtn = document.getElementById('retakeBtn');
const downloadBtn = document.getElementById('downloadBtn');

// ==========================================
// UTILIDADES
// ==========================================
function showStep(step) {
    [frameStep, cameraStep, previewStep].forEach(s => s.classList.remove('active'));
    step.classList.add('active');
}

function detenerCamara() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
}

// ==========================================
// SELECCIÓN DE MARCO
// ==========================================
document.querySelectorAll('.frame-option').forEach(btn => {
    btn.addEventListener('click', () => {
        currentFrame = btn.dataset.frame;
        currentFrameName = btn.dataset.name || 'Marco';
        startCamera();
    });
});

// ==========================================
// CÁMARA
// ==========================================
async function startCamera() {
    try {
        detenerCamara();

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 1280 }
            },
            audio: false
        });

        video.srcObject = stream;

        // Espejo si es cámara frontal
        video.style.transform = (facingMode === 'user') ? 'scaleX(-1)' : 'none';
        frameOverlay.style.transform = (facingMode === 'user') ? 'scaleX(-1)' : 'none';

        // Mostrar marco encima
        frameOverlay.src = currentFrame;
        frameOverlay.onload = () => showStep(cameraStep);
        frameOverlay.onerror = () => {
            alert('No se pudo cargar el marco. Verifica que exista en la carpeta frames/.');
        };
    } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        alert('No se pudo acceder a la cámara. Asegúrate de dar los permisos necesarios y usar HTTPS.');
    }
}

// ==========================================
// CAPTURAR FOTO
// ==========================================
captureBtn.addEventListener('click', () => {
    if (!video.videoWidth) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    // Recorte centrado cuadrado del video
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    ctx.save();
    if (facingMode === 'user') {
        // Espejo horizontal para que coincida con la vista previa
        ctx.translate(CANVAS_SIZE, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, size, size, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.restore();

    // Dibujar el marco encima
    const frameImg = new Image();
    frameImg.crossOrigin = 'anonymous';
    frameImg.onload = () => {
        ctx.drawImage(frameImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

        canvas.toBlob(blob => {
            capturedBlob = blob;
            photoResult.src = URL.createObjectURL(blob);
            detenerCamara();
            showStep(previewStep);
            uploadToDrive(blob);
        }, 'image/jpeg', JPEG_QUALITY);
    };
    frameImg.src = currentFrame;
});

// ==========================================
// VOLTEAR CÁMARA (frontal/trasera)
// ==========================================
flipBtn.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    startCamera();
});

// ==========================================
// VOLVER A MARCOS
// ==========================================
backBtn.addEventListener('click', () => {
    detenerCamara();
    showStep(frameStep);
});

// ==========================================
// REPETIR FOTO
// ==========================================
retakeBtn.addEventListener('click', () => {
    capturedBlob = null;
    photoResult.src = '';
    uploadStatus.textContent = '';
    uploadStatus.className = 'status';
    startCamera();
});

// ==========================================
// DESCARGAR FOTO
// ==========================================
downloadBtn.addEventListener('click', () => {
    if (!capturedBlob) return;
    const url = URL.createObjectURL(capturedBlob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `PhotoFrame_${currentFrameName}_${fecha}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ==========================================
// SUBIR A GOOGLE DRIVE (vía Apps Script)
// ==========================================
async function uploadToDrive(blob) {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGA_AQUI')) {
        uploadStatus.textContent = '⚠️ Falta configurar la URL de Google Apps Script';
        uploadStatus.className = 'status error';
        return;
    }

    uploadStatus.textContent = '⏳ Guardando en Drive...';
    uploadStatus.className = 'status loading';

    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const nombreArchivo = `PhotoFrame_${currentFrameName}_${fecha}.jpg`;

        try {
            const params = new URLSearchParams();
            params.append('image', base64);
            params.append('filename', nombreArchivo);

            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: params
            });

            uploadStatus.textContent = '✅ Foto guardada en Drive';
            uploadStatus.className = 'status success';
        } catch (err) {
            console.error('Error al subir:', err);
            uploadStatus.textContent = '❌ Error al guardar en Drive';
            uploadStatus.className = 'status error';
        }
    };
}
