/* ==========================================================
   PhotoFrame · Certification Nation Day 2026
   Lógica: cámara, selección de marco, captura, descarga y subida
   ========================================================== */

// ==========================================================
// CONFIGURACIÓN
// ==========================================================
// ⚠️ Reemplaza esta URL con la de tu Google Apps Script (termina en /exec)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBNP7G6V0Dp2NbioXU56TNXrnTaSg56flX04chGsLXABTe0aZ0gqEWtQ-pORS4Zrxv/exec';

const CANVAS_SIZE = 1080;              // Tamaño final de la foto (cuadrada, en px)
const JPEG_QUALITY = 0.92;             // Calidad (0 a 1)
const MIRROR_FRONT_CAMERA = true;      // Espeja la cámara frontal (efecto selfie)

// ==========================================================
// ESTADO
// ==========================================================
let currentFrame = null;
let currentFrameName = '';
let stream = null;
let facingMode = 'user';               // 'user' = frontal, 'environment' = trasera
let capturedBlob = null;
let isCapturing = false;
let cameraReady = false;

// ==========================================================
// ELEMENTOS DEL DOM
// ==========================================================
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const frameOverlay = document.getElementById('frameOverlay');
const photoResult = document.getElementById('photoResult');
const uploadStatus = document.getElementById('uploadStatus');

const screenCamera = document.getElementById('screen-camera');
const screenPreview = document.getElementById('screen-preview');

const captureBtn = document.getElementById('captureBtn');
const flipBtn = document.getElementById('flipBtn');
const backBtn = document.getElementById('backBtn');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const retakeBtn = document.getElementById('retakeBtn');
const downloadBtn = document.getElementById('downloadBtn');

const framesStrip = document.getElementById('framesStrip');
const frameThumbs = document.querySelectorAll('.frame-thumb');

// ==========================================================
// NAVEGACIÓN ENTRE PANTALLAS
// ==========================================================
function showScreen(screen) {
    [screenCamera, screenPreview].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// ==========================================================
// SELECCIÓN DE MARCO
// ==========================================================
function seleccionarMarco(thumb) {
    currentFrame = thumb.dataset.frame;
    currentFrameName = thumb.dataset.name || 'Marco';

    // Actualizar estado visual
    frameThumbs.forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');

    // Actualizar el overlay en vivo si la cámara está abierta
    if (cameraReady && frameOverlay) {
        frameOverlay.src = currentFrame;
    }
}

// Asignar evento a cada miniatura
frameThumbs.forEach(thumb => {
    thumb.addEventListener('click', () => seleccionarMarco(thumb));
});

// ==========================================================
// CÁMARA
// ==========================================================
async function iniciarCamara() {
    try {
        detenerCamara();
        cameraReady = false;

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

        // Aplicar espejo a la cámara frontal
        aplicarEspejo();

        // Cargar el marco elegido
        if (currentFrame) {
            frameOverlay.src = currentFrame;
        }

        cameraReady = true;
        showScreen(screenCamera);

    } catch (err) {
        console.error('Error al acceder a la cámara:', err);

        let msg = 'No se pudo acceder a la cámara.';
        if (err.name === 'NotAllowedError') {
            msg = 'Debes permitir el acceso a la cámara para usar la app. Ve a los ajustes del navegador y actívalo.';
        } else if (err.name === 'NotFoundError') {
            msg = 'No se encontró ninguna cámara en este dispositivo.';
        } else if (err.name === 'NotReadableError') {
            msg = 'La cámara está siendo usada por otra aplicación.';
        }

        alert(msg + '\n\n(Recuerda abrir la app desde el navegador del celular y en HTTPS.)');
    }
}

function aplicarEspejo() {
    const debeEspejar = MIRROR_FRONT_CAMERA && facingMode === 'user';
    video.style.transform = debeEspejar ? 'scaleX(-1)' : 'none';
    // El marco nunca se espeja
    frameOverlay.style.transform = 'none';
}

function detenerCamara() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    video.srcObject = null;
    cameraReady = false;
}

// ==========================================================
// CAPTURAR FOTO
// ==========================================================
captureBtn.addEventListener('click', () => {
    if (isCapturing) return;
    if (!cameraReady || !video.videoWidth || !currentFrame) return;

    isCapturing = true;
    captureBtn.disabled = true;

    // Flash blanco de feedback
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0.85;z-index:9999;pointer-events:none;transition:opacity 0.35s ease;';
    document.body.appendChild(flash);
    requestAnimationFrame(() => { flash.style.opacity = '0'; });
    setTimeout(() => flash.remove(), 400);

    // Configurar canvas cuadrado
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

    // Dibujar el marco encima (siempre sin espejar)
    const frameImg = new Image();
    frameImg.crossOrigin = 'anonymous';

    frameImg.onload = () => {
        ctx.drawImage(frameImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

        canvas.toBlob(blob => {
            if (!blob) {
                alert('Error al generar la imagen. Intenta de nuevo.');
                isCapturing = false;
                captureBtn.disabled = false;
                return;
            }

            capturedBlob = blob;
            photoResult.src = URL.createObjectURL(blob);

            // Resetear status
            uploadStatus.textContent = '';
            uploadStatus.className = 'status';

            // Detener cámara y mostrar vista previa
            detenerCamara();
            showScreen(screenPreview);

            // Subir a Drive en segundo plano
            subirADrive(blob);

            isCapturing = false;
            captureBtn.disabled = false;
        }, 'image/jpeg', JPEG_QUALITY);
    };

    frameImg.onerror = () => {
        alert('No se pudo cargar el marco para la captura.');
        isCapturing = false;
        captureBtn.disabled = false;
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
// CERRAR APP (botón X)
// ==========================================================
backBtn.addEventListener('click', () => {
    detenerCamara();
    // Intentar cerrar la pestaña (funciona si fue abierta por script).
    // Si no, dejamos la pantalla en negro sin más.
    window.close();
    // Fallback: mostrar la cámara de nuevo (algunos navegadores no permiten close)
    setTimeout(() => {
        if (currentFrame) iniciarCamara();
    }, 200);
});

// ==========================================================
// CERRAR VISTA PREVIA (volver a la cámara)
// ==========================================================
closePreviewBtn.addEventListener('click', () => {
    capturedBlob = null;
    photoResult.src = '';
    uploadStatus.textContent = '';
    uploadStatus.className = 'status';
    iniciarCamara();
});

// ==========================================================
// REPETIR FOTO
// ==========================================================
retakeBtn.addEventListener('click', () => {
    capturedBlob = null;
    photoResult.src = '';
    uploadStatus.textContent = '';
    uploadStatus.className = 'status';
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

    // Feedback visual en el botón
    const label = downloadBtn.querySelector('span');
    const original = label.textContent;
    label.textContent = '¡Guardado!';
    setTimeout(() => { label.textContent = original; }, 1800);
});

// ==========================================================
// SUBIR A GOOGLE DRIVE (vía Apps Script)
// ==========================================================
async function subirADrive(blob) {
    // Verificar configuración
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGA_AQUI')) {
        uploadStatus.textContent = '⚠️ Falta configurar la URL de Google Apps Script';
        uploadStatus.className = 'status error';
        return;
    }

    try {
        const base64 = await blobToBase64(blob);
        const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const nombreArchivo = `PhotoFrame_${currentFrameName}_${fecha}.jpg`;

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


    } catch (err) {
        console.error('Error al subir:', err);
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
// INICIALIZACIÓN
// ==========================================================
async function init() {
    // Verificar que haya al menos una miniatura
    if (frameThumbs.length === 0) {
        alert('No se encontraron marcos. Revisa la carpeta frames/.');
        return;
    }

    // Seleccionar el primer marco por defecto
    seleccionarMarco(frameThumbs[0]);

    // Iniciar cámara directamente
    await iniciarCamara();
}

// ==========================================================
// LIMPIEZA AL CERRAR / CAMBIAR DE APP
// ==========================================================
window.addEventListener('beforeunload', detenerCamara);
document.addEventListener('visibilitychange', () => {
    if (document.hidden && stream) {
        detenerCamara();
    }
});

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
