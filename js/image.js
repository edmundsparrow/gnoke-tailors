/**
 * image.js — Gnoke Tailors
 * Photo storage: fabric swatch + customer passport photo.
 * Camera API → centre-crop → 512×512 JPEG → IndexedDB ('gnoke_photos_db').
 *
 * Key convention  (stored in orders.swatch / orders.portrait):
 *   draft_fabric        temporary key while new-order form is open
 *   draft_portrait      temporary key while new-order form is open
 *   order_{id}_fabric   permanent key after order is saved
 *   order_{id}_portrait permanent key after order is saved
 *
 * Public API:
 *   await ImageManager.capture(slotId)            → triggers camera; returns key or null
 *   await ImageManager.get(key)                   → dataUrl or null
 *   await ImageManager.promote(tmpKey, orderId)   → renames draft_* → order_{id}_*; returns new key
 *   await ImageManager.remove(key)                → deletes one photo
 *   await ImageManager.renderSlot(slotEl, key)    → fills a .photo-slot element with the image
 *   ImageManager.slotHTML(slotId, label)          → returns the HTML string for a photo slot
 *
 * Copyright © 2026 Edmund Sparrow — GNU GPL v3
 */

const ImageManager = (() => {

  const DB_NAME   = 'gnoke_photos_db';
  const STORE     = 'photos';
  const SIZE      = 512;
  const QUALITY   = 0.72;   // JPEG quality – good visual / reasonable file size

  /* ── IndexedDB promise ──────────────────────────────────────── */

  const _db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    req.onsuccess       = e => resolve(e.target.result);
    req.onerror         = ()  => reject(req.error);
  });

  /* ── Internal helpers ───────────────────────────────────────── */

  /** Centre-crop a loaded HTMLImageElement to SIZE × SIZE, return dataUrl. */
  function _resize(img) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const min = Math.min(img.naturalWidth, img.naturalHeight);
    const sx  = (img.naturalWidth  - min) / 2;
    const sy  = (img.naturalHeight - min) / 2;
    ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
    return canvas.toDataURL('image/jpeg', QUALITY);
  }

  /** Load a File/Blob → resized dataUrl. */
  function _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload  = () => { URL.revokeObjectURL(url); resolve(_resize(img)); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  }

  /** Raw IDB put. */
  async function _put(key, dataUrl) {
    const db = await _db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(dataUrl, key);
      tx.oncomplete = () => resolve(key);
      tx.onerror    = () => reject(tx.error);
    });
  }

  /** Raw IDB get. */
  async function _get(key) {
    if (!key) return null;
    const db = await _db;
    return new Promise(resolve => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
  }

  /** Raw IDB delete. */
  async function _del(key) {
    if (!key) return;
    const db = await _db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  /* ── SVG placeholder (reused in slotHTML + renderSlot reset) ── */

  function _placeholderSVG(slotId) {
    const icons = {
      fabric   : `<path d="M6 20L10 8l4 6 4-8 4 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  <circle cx="20" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
      fabric2  : `<path d="M6 20L10 8l4 6 4-8 4 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  <circle cx="20" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
                  <text x="28" y="36" font-size="9" fill="currentColor" font-family="monospace">2</text>`,
    };
    const inner = icons[slotId] || icons.fabric;
    return `<svg class="photo-slot-icon" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="34" height="34" rx="5"
        stroke="currentColor" stroke-width="1.4" stroke-dasharray="4 3" fill="none"/>
      ${inner}
    </svg>`;
  }

  /* ── Public: slotHTML ───────────────────────────────────────── */

  /**
   * Returns the full HTML for a photo slot widget.
   * slotId : 'fabric' | 'portrait'
   * label  : text shown below the icon
   */
  function slotHTML(slotId, label = 'Tap to snap') {
    return `
      <div class="photo-slot" id="photo-slot-${slotId}"
           data-slot="${slotId}" role="button" tabindex="0"
           aria-label="${label}">
        <div class="photo-slot-inner" id="photo-slot-inner-${slotId}">
          ${_placeholderSVG(slotId)}
          <span class="photo-slot-label">${label}</span>
        </div>
      </div>`;
  }

  /* ── Public: capture ────────────────────────────────────────── */

  /**
   * Opens the device camera (or file picker on desktop).
   * Resizes to 512×512, saves under key `draft_{slotId}`, returns the key.
   * Returns null if user cancels.
   */
  async function capture(slotId) {
    return new Promise(resolve => {
      const input      = document.createElement('input');
      input.type       = 'file';
      input.accept     = 'image/*';
      input.capture    = 'environment';  // rear camera preferred

      input.onchange = async e => {
        const file = e.target.files?.[0];
        if (!file) { resolve(null); return; }
        try {
          const dataUrl = await _fileToDataUrl(file);
          const key     = `draft_${slotId}`;
          await _put(key, dataUrl);
          resolve(key);
        } catch (err) {
          console.error('[ImageManager] capture error:', err);
          resolve(null);
        }
      };

      // Handle cancel (no change event fires on some browsers)
      input.addEventListener('cancel', () => resolve(null));

      input.click();
    });
  }

  /* ── Public: get ────────────────────────────────────────────── */

  /** Returns dataUrl for key, or null. */
  async function get(key) {
    return _get(key);
  }

  /* ── Public: promote ────────────────────────────────────────── */

  /**
   * Moves draft_{slotId} → order_{orderId}_{slotId}.
   * Call this after Orders.add() returns the new order id.
   * Returns the permanent key (or null if no draft existed).
   */
  async function promote(slotId, orderId) {
    const tmpKey  = `draft_${slotId}`;
    const permKey = `order_${orderId}_${slotId}`;
    const data    = await _get(tmpKey);
    if (!data) return null;
    await _put(permKey, data);
    await _del(tmpKey);
    return permKey;
  }

  /* ── Public: remove ─────────────────────────────────────────── */

  /** Deletes a photo by key. Safe to call with null. */
  async function remove(key) {
    return _del(key);
  }

  /* ── Public: renderSlot ─────────────────────────────────────── */

  /**
   * Fills a .photo-slot element (found by slotId) with the stored image.
   * If key is null/empty, resets to placeholder.
   * Call after capture() or on page load to hydrate existing orders.
   */
  async function renderSlot(slotId, key) {
    const inner = document.getElementById(`photo-slot-inner-${slotId}`);
    if (!inner) return;

    if (!key) {
      inner.innerHTML = _placeholderSVG(slotId) +
        `<span class="photo-slot-label">${slotId === 'fabric2' ? 'Fabric 2' : 'Fabric photo'}</span>`;
      inner.closest('.photo-slot')?.classList.remove('has-image');
      return;
    }

    const dataUrl = await _get(key);
    if (!dataUrl) { return renderSlot(slotId, null); }

    inner.innerHTML = `<img src="${dataUrl}" alt="${slotId} photo"
      class="photo-slot-img" draggable="false" />
      <button class="photo-slot-clear" data-slot="${slotId}" title="Remove photo">✕</button>`;
    inner.closest('.photo-slot')?.classList.add('has-image');
  }

  /* ── Inject base CSS ────────────────────────────────────────── */

  (function _injectCSS() {
    if (document.getElementById('image-manager-css')) return;
    const s = document.createElement('style');
    s.id = 'image-manager-css';
    s.textContent = `
      /* Photo slot widget */
      .photo-slot {
        position: relative;
        width: 80px; height: 80px;
        border: 1.5px dashed var(--border2);
        border-radius: var(--radius);
        background: var(--surface2);
        cursor: pointer;
        overflow: hidden;
        flex-shrink: 0;
        transition: border-color var(--transition), background var(--transition);
      }
      .photo-slot:hover,
      .photo-slot:focus-visible {
        border-color: var(--accent);
        background: var(--accent-lt);
        outline: none;
      }
      .photo-slot.has-image {
        border-style: solid;
        border-color: var(--border);
      }
      .photo-slot-inner {
        width: 100%; height: 100%;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 5px;
      }
      .photo-slot-icon {
        width: 36px; height: 36px;
        color: var(--muted);
      }
      .photo-slot-label {
        font-family: var(--font-mono);
        font-size: .52rem; letter-spacing: .04em;
        text-transform: uppercase; color: var(--muted);
        text-align: center; line-height: 1.4;
      }
      .photo-slot-img {
        width: 100%; height: 100%;
        object-fit: cover; display: block;
      }
      .photo-slot-clear {
        position: absolute; top: 3px; right: 3px;
        width: 18px; height: 18px;
        border-radius: 50%; border: none;
        background: rgba(0,0,0,.55); color: #fff;
        font-size: .6rem; line-height: 1;
        cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        opacity: 0; transition: opacity var(--transition);
      }
      .photo-slot:hover .photo-slot-clear,
      .photo-slot.has-image .photo-slot-clear { opacity: 1; }

      /* Two-slot row used in the Add Order form */
      .photo-slot-row {
        display: flex; gap: 12px; align-items: flex-start;
      }
      .photo-slot-wrap {
        display: flex; flex-direction: column; gap: 5px;
      }
      .photo-slot-wrap label {
        font-family: var(--font-mono);
        font-size: .6rem; letter-spacing: .08em;
        text-transform: uppercase; color: var(--muted);
      }
    `;
    document.head.appendChild(s);
  })();

  return { capture, get, promote, remove, renderSlot, slotHTML };

})();
