/* ==========================================================
   PhotoFrame · Certification Nation Day 2026
   Lógica principal: cámara, captura, descarga y subida a Drive
   ========================================================== */

// ==========================================================
// CONFIGURACIÓN
// ==========================================================
// ⚠️ Reemplaza esta URL con la de tu Google Apps Script (termina en /exec)
const APPS_SCRIPT_URL = 'PEGA_AQUI_TU_URL_DE_APPS_SCRIPT';

const CANVAS_SIZE = 1080;        // Tamaño final de la foto (cuadrada, en px)
const JPEG_QUALITY = 0.92;       // Calidad (0 a 1)
const MIRROR_FRONT_CAMERA = true; // Espeja la cámara frontal (efecto selfie)

// ==========================================================
// ESTADO
// ==========================================================
let currentFrame = null;
let currentFrameName = '';
let stream = null;
let facingMode = 'user'; // 'user' = frontal, 'environment' = trasera
let capturedBlob = null;
let isCapturing = false;

// ==========================================================
// ELEMENTOS DEL DOM
// ==========================================================
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const frameOverlay = document.getElementById('frameOverlay');
const photoResult = document.getElementById('photoResult');
const uploadStatus = document.getElementById('uploadStatus');
const successBadge = document.getElementById('successBadge');
const currentFrameNameEl = document.getElementById('currentFrameName');

const screenHome = document.getElementById('screen-home');
const screenCamera = document.getElementById('screen-camera');
const screenPreview = document.getElementById('screen-preview');

const captureBtn = document.getElementById('captureBtn');
const flipBtn = document.getElementById('flipBtn');
const backBtn = document.getElementById('backBtn');
const retakeBtn = document.getElementById('retakeBtn');
const downloadBtn = document.getElementById('downloadBtn');

// ==========================================================
// NAVEGACIÓN ENTRE PANTALLAS
// ==========================================================
function showScreen(screen) {
    [screenHome, screenCamera, screenPreview].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// ==========================================================
// CAMBIAR NOMBRE DEL MARCO ACTIVO EN LA CÁMARA
// ==========================================================
function setFrameName(name) {
    currentFrameNameEl.textContent = name || 'Marco';
}

// ==========================================================
// SELECCIÓN DE MARCO
// ==========================================================
document.querySelectorAll('.frame-card').forEach(card => {
    card.addEventListener('click', () => {
        currentFrame = card.dataset.frame;
        currentFrameName = card.dataset.name || 'Marco';
        setFrameName(currentFrameName);
        iniciarCamara();
    });
});

// ==========================================================
// CÁMARA
// ==========================================================
async function iniciarCamara() {
    try {
        detenerCamara();

        // Verificar soporte
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Tu navegador no soporta acceso a la cámara. Prueba con Chrome o Safari actualizados.');
            return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: facingMode },
                width:  { ideal: 1280 },
                height: { ideal: 1280 }
            },
            audio: false
        });

        video.srcObject = stream;

        // Esperar a que el video tenga dimensiones listas
        await new Promise((resolve) => {
            if (video.readyState >= 2 && video.videoWidth > 0) {
                resolve();
            } else {
                video.onloadedmetadata = () => resolve();
            }
        });

        // Aplicar espejo si es cámara frontal
        aplicarEspejo();

        // Cargar el marco superpuesto
        frameOverlay.src = currentFrame;
        frameOverlay.onload = () => showScreen(screenCamera);
        frameOverlay.onerror = () => {
            alert('No se pudo cargar el marco. Verifica que exista en la carpeta frames/.');
            showScreen(screenHome);
        };

    } catch (err) {
        console.error('Error al acceder a la cámara:', err);

        let msg = 'No se pudo acceder a la cámara.';
        if (err.name === 'NotAllowedError') {
            msg = 'Debes permitir el acceso a la cámara. Ve a los ajustes del navegador y actívalo.';
        } else if (err.name === 'NotFoundError') {
            msg = 'No se encontró ninguna cámara en este dispositivo.';
        } else if (err.name === 'NotReadableError') {
            msg = 'La cámara está siendo usada por otra aplicación.';
        }

        alert(msg + '\n\n(Recuerda que debe estar abierto en HTTPS y desde el navegador del celular, no dentro de otra app.)');
        showScreen(screenHome);
    }
}

function aplicarEspejo() {
    const debeEspejar = MIRROR_FRONT_CAMERA && facingMode === 'user';
    video.style.transform = debeEspejar ? 'scaleX(-1)' : 'none';
    // El marco NO se espeja, siempre se muestra correctamente orientado
    frameOverlay.style.transform = 'none';
}

function detenerCamara() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    video.srcObject = null;
}

// ==========================================================
// CAPTURAR FOTO
// ==========================================================
captureBtn.addEventListener('click', () => {
    if (isCapturing) return;
    if (!video.videoWidth) return;

    isCapturing = true;

    // Animación visual de captura
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0.8;z-index:9999;pointer-events:none;transition:opacity 0.35s;';
    document.body.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '0'; });
    setTimeout(() => flash.remove(), 400);

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    // Recorte cuadrado centrado del video
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    const debeEspejar = MIRROR_FRONT_CAMERA && facingMode === 'user';

    // Dibujar el video (espejado si es frontal)
    ctx.save();
    if (debeEspejar) {
        ctx.translate(CANVAS_SIZE, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, size, size, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.restore();

    // Dibujar el marco encima (SIEMPRE sin espejar, con texto correcto)
    const frameImg = new Image();
    frameImg.crossOrigin = 'anonymous';

    frameImg.onload = () => {
        ctx.drawImage(frameImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

        canvas.toBlob(blob => {
            if (!blob) {
                alert('Error al generar la imagen. Intenta de nuevo.');
                isCapturing = false;
                return;
            }

            capturedBlob = blob;
            photoResult.src = URL.createObjectURL(blob);

            // Mostrar badge y resetear status
            successBadge.style.display = 'flex';
            uploadStatus.textContent = '';
            uploadStatus.className = 'status';

            detenerCamara();
            showScreen(screenPreview);

            // Subir a Drive (en paralelo)
            subirADrive(blob);

            isCapturing = false;
        }, 'image/jpeg', JPEG_QUALITY);
    };

    frameImg.onerror = () => {
        alert('No se pudo cargar el marco para la captura.');
        isCapturing = false;
    };

    frameImg.src = currentFrame;
});

// ==========================================================
// VOLTEAR CÁMARA (frontal / trasera)
// ==========================================================
flipBtn.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    iniciarCamara();
});

// ==========================================================
// VOLVER AL HOME
// ==========================================================
backBtn.addEventListener('click', () => {
    detenerCamara();
    showScreen(screenHome);
});

// ==========================================================
// REPETIR FOTO
// ==========================================================
retakeBtn.addEventListener('click', () => {
    capturedBlob = null;
    photoResult.src = '';
    uploadStatus.textContent = '';
    uploadStatus.className = 'status';
    successBadge.style.display = 'none';
    iniciarCamara();
});

// ==========================================================
// DESCARGAR FOTO AL CELULAR
// ==========================================================
downloadBtn.addEventListener('click', () => {
    if (!capturedBlob) return;

    const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const nombreArchivo = `PhotoFrame_${currentFrameName}_${fecha}.jpg`;

    const url = URL.createObjectURL(capturedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 2000);

    // Feedback visual
    const originalText = downloadBtn.querySelector('span').textContent;
    downloadBtn.querySelector('span').textContent = '¡Guardado!';
    setTimeout(() => {
        downloadBtn.querySelector('span').textContent = originalText;
    }, 2000);
});

// ==========================================================
// SUBIR A GOOGLE DRIVE (vía Apps Script)
// ==========================================================
async function subirADrive(blob) {
    // Verificar que la URL esté configurada
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGA_AQUI')) {
        uploadStatus.textContent = '⚠️ Falta configurar la URL de Google Apps Script';
        uploadStatus.className = 'status error';
        return;
    }

    uploadStatus.textContent = '⏳ Guardando en Drive...';
    uploadStatus.className = 'status loading';

    try {
        // Convertir blob a base64
        const base64 = await blobToBase64(blob);
        const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const nombreArchivo = `PhotoFrame_${currentFrameName}_${fecha}.jpg`;

        // Enviar como POST (application/x-www-form-urlencoded)
        const params = new URLSearchParams();
        params.append('image', base64);
        params.append('filename', nombreArchivo);

        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        // Con no-cors no podemos leer la respuesta, así que asumimos éxito
        uploadStatus.textContent = '✅ Foto guardada en Drive';
        uploadStatus.className = 'status success';

    } catch (err) {
        console.error('Error al subir:', err);
        uploadStatus.textContent = '❌ Error al guardar en Drive';
        uploadStatus.className = 'status error';
    }
}

// ==========================================================
// UTILIDAD: Blob → Base64 (sin el prefijo data:image/...)
// ==========================================================
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ==========================================================
// LIMPIEZA AL CERRAR
// ==========================================================
window.addEventListener('beforeunload', detenerCamara);
document.addEventListener('visibilitychange', () => {
    if (document.hidden && stream) {
        detenerCamara();
    }
});
