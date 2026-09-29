/**
 * PHOTO CHHOTI KARNA — upload se pehle, phone me hi.
 *
 * Phone ka camera 4-8 MB ki photo deta hai, aur server 3 MB tak hi leta hai.
 * Pehle camera se khichi har photo pe "Image 3 MB se choti honi chahiye" aata
 * tha — yaani camera wala button kaam ka hi nahi tha. Product ki photo ke liye
 * 1600px kaafi se zyada hai; itne pe wo 200-500 KB ki reh jati hai aur net
 * pe bhi jaldi chadhti hai.
 *
 * Kuch gadbad ho (purana browser, ajeeb format) to asli file hi wapas — photo
 * chhoti na hui to bhi kaam rukna nahi chahiye.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.85;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export async function shrinkImage(file) {
  if (!file || !file.type?.startsWith('image/')) return file;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    // Pehle se chhoti aur halki ho to chhedne ki zarurat nahi
    if (scale === 1 && file.size <= 800 * 1024) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
