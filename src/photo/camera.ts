/** Opens the rear camera into a video element. Throws when there is no camera or permission was refused. */
export async function openCamera(video: HTMLVideoElement): Promise<{ shoot(): Promise<ImageBitmap>; stop(): void }> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('No camera here');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 2048 }, height: { ideal: 1536 } },
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play().catch(() => {});
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
  return {
    shoot: () => createImageBitmap(video),
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

/** The fallback when the camera cannot open: a picked or captured file. */
export function bitmapFromFile(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}
