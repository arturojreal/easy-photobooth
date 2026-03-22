/** @module camera - Webcam initialization, capture, stream management, and camera filters. */

export let currentStream = null;

/**
 * Enumerate video devices and populate the camera selector in the debug panel.
 */
export async function initCamera(settings, statusCb) {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        populateCameraSelect(videoDevices);

        const constraints = {
            video: {
                width:     { ideal: 1920 },
                height:    { ideal: 1080 },
                frameRate: { ideal: 30 }
            }
        };

        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoEl = document.getElementById('videoElement');
        videoEl.srcObject = currentStream;

        statusCb?.('cameraStatus', 'Camera: Connected', 'success');
    } catch (err) {
        console.error('Camera initialization failed:', err);
        statusCb?.('cameraStatus', 'Camera: Error', 'error');
    }
}

/**
 * Switch to a specific camera device by deviceId.
 * @param {string} deviceId
 * @param {Function} applyFiltersFn - called after stream is live so filters are re-applied
 */
export async function switchCamera(deviceId, applyFiltersFn) {
    if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
    }
    try {
        const constraints = {
            video: {
                deviceId: { exact: deviceId },
                width:     { ideal: 1920 },
                height:    { ideal: 1080 },
                frameRate: { ideal: 30 }
            }
        };
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('videoElement').srcObject = currentStream;
        applyFiltersFn?.();
    } catch (err) {
        console.error('Camera switch failed:', err);
    }
}

/**
 * Populate the camera <select> element with detected video devices.
 * @param {MediaDeviceInfo[]} devices
 */
function populateCameraSelect(devices) {
    const select = document.getElementById('cameraSelect');
    select.innerHTML = '';
    devices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${index + 1}`;
        select.appendChild(option);
    });
}

/**
 * Apply CSS filter values (brightness, contrast, saturation, hue) to the video element.
 * @param {{ brightness: number, contrast: number, saturation: number, hue: number }} settings
 */
export function applyCameraFilters(settings) {
    const videoEl = document.getElementById('videoElement');
    if (!videoEl) return;
    const filters = [
        `brightness(${100 + settings.brightness}%)`,
        `contrast(${settings.contrast}%)`,
        `saturate(${settings.saturation}%)`,
        `hue-rotate(${settings.hue}deg)`
    ];
    videoEl.style.filter = filters.join(' ');
}

/**
 * Capture the current video frame to a JPEG data URL.
 * @param {number} quality - JPEG quality (0–1)
 * @returns {string} base64 data URL
 */
export function captureFrame(quality) {
    const videoEl = document.getElementById('videoElement');
    const canvas  = document.createElement('canvas');
    const ctx     = canvas.getContext('2d');

    canvas.width  = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    ctx.drawImage(videoEl, 0, 0);

    return canvas.toDataURL('image/jpeg', quality);
}
