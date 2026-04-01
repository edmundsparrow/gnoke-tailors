/**
 * ui.js — Gnoke Stitches
 * Pure UI utilities: toast, status chip, loading overlay, modals.
 * No business logic. No DB calls. No state writes.
 * Copyright © 2026 Edmund Sparrow — GNU GPL v3
 */

const UI = (() => {

  let _toastTimer  = null;
  let _statusTimer = null;

  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.textContent = msg;
    el.className   = `show${type === 'err' ? ' err' : type === 'ok' ? ' ok' : ''}`;
    _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function status(msg, type = 'ok') {
    const el = document.getElementById('status-chip');
    if (!el) return;
    clearTimeout(_statusTimer);
    el.textContent = msg;
    el.className   = `show${type === 'err' ? ' err' : ''}`;
    _statusTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function loading(show) {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  }

  function empty(tbody, cols, msg = 'Nothing here yet.') {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-cell">${msg}</td></tr>`;
  }

  function fmt(amount) {
    return '₦' + Number(amount || 0).toLocaleString('en-NG');
  }

  function init() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    });
  }

  return { toast, status, loading, openModal, closeModal, empty, fmt, init };

})();
