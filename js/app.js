/**
 * app.js — Gnoke Tailors
 * Bootstrap. Runs after all scripts are loaded.
 * Owns: DOMContentLoaded init, page routing, all event wiring.
 * Copyright © 2026 Edmund Sparrow — GNU GPL v3
 */

document.addEventListener('DOMContentLoaded', async () => {

  /* ── 1. Shared modules ──────────────────────────────────────── */
  Theme.init();
  UI.init();

  /* ── 2. Database ────────────────────────────────────────────── */
  UI.loading(true);
  try {
    await DB.init();
  } catch (err) {
    UI.toast('Database failed to load. Refresh the page.', 'err');
    console.error('[Stitches] DB init:', err);
    UI.loading(false);
    return;
  }
  UI.loading(false);

  /* ── 3. About tech table ────────────────────────────────────── */
  renderAboutTech([
    ['Database',    'SQLite (sql.js / WASM)'],
    ['Persistence', 'IndexedDB'],
    ['Network',     'None required'],
    ['Stack',       'HTML · CSS · Vanilla JS'],
    ['Version',     'v1.0'],
  ]);

  /* ── 4. Initial render ──────────────────────────────────────── */
  loadPage('jobs-page');


  /* ══════════════════════════════════════════════════════════════
     PAGE ROUTING
  ══════════════════════════════════════════════════════════════ */

  function loadPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
    State.set('activePage', pageId);
    document.getElementById('context-info').textContent = '';

    // Render on activate
    if (pageId === 'jobs-page')      { Render.calStrip(); Render.overdueBanner(); Render.jobList(); }
    if (pageId === 'money-page')     { Render.money(); }
    if (pageId === 'customers-page') { Render.customers(''); }
    if (pageId === 'add-page')       { resetAddForm(); }
  }

  window.loadPage = loadPage;


  /* ══════════════════════════════════════════════════════════════
     MOBILE DRAWER
  ══════════════════════════════════════════════════════════════ */

  const Drawer = (() => {
    const panel   = () => document.getElementById('drawer');
    const overlay = () => document.getElementById('drawer-overlay');

    function open()  { panel()?.classList.add('open');    overlay()?.classList.add('open'); }
    function close() { panel()?.classList.remove('open'); overlay()?.classList.remove('open'); }

    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.getElementById('hamburger')?.addEventListener('click', open);
    document.getElementById('drawer-close')?.addEventListener('click', close);
    document.getElementById('drawer-overlay')?.addEventListener('click', close);

    return { open, close };
  })();

  window.Drawer = Drawer;


  /* ══════════════════════════════════════════════════════════════
     TOPBAR NAV — desktop menu items and brand click
  ══════════════════════════════════════════════════════════════ */

  document.getElementById('brand')?.addEventListener('click', () => loadPage('jobs-page'));

  document.getElementById('nav-jobs')?.addEventListener('click',      () => loadPage('jobs-page'));
  document.getElementById('nav-add')?.addEventListener('click',       () => loadPage('add-page'));
  document.getElementById('nav-money')?.addEventListener('click',     () => loadPage('money-page'));
  document.getElementById('nav-customers')?.addEventListener('click', () => loadPage('customers-page'));
  document.getElementById('nav-settings')?.addEventListener('click',  () => loadPage('settings-page'));
  document.getElementById('nav-about')?.addEventListener('click',     () => loadPage('about-page'));


  /* ══════════════════════════════════════════════════════════════
     JOBS PAGE — calendar + card interactions
  ══════════════════════════════════════════════════════════════ */

  // Calendar date selection (event delegation)
  document.getElementById('cal-strip')?.addEventListener('click', e => {
    const cell = e.target.closest('.cal-cell');
    if (!cell) return;
    State.set('selectedDate', cell.dataset.date);
    Render.calStrip();
    Render.jobList();
  });

  // Card expand / actions (event delegation on job-list)
  document.getElementById('job-list')?.addEventListener('click', async e => {
    // Expand toggle
    const toggleTarget = e.target.closest('[data-toggle]');
    if (toggleTarget) {
      const card = toggleTarget.closest('.order-card');
      if (card) card.classList.toggle('expanded');
      return;
    }

    const id = e.target.dataset.id ? parseInt(e.target.dataset.id) : null;
    if (!id) return;

    // Mark ready / sewing
    if (e.target.classList.contains('btn-toggle')) {
      await Orders.toggle(id);
      Render.calStrip();
      Render.overdueBanner();
      Render.jobList();
      UI.status('saved');
      return;
    }

    // WhatsApp
    if (e.target.classList.contains('btn-wa')) {
      const o = DB.one(`SELECT * FROM orders WHERE id = ?`, [id]);
      if (!o) return;
      const bal = o.price - o.deposit;
      const status = o.ready ? 'ready for pickup' : 'almost ready';
      const msg = `Hello ${o.name}! 👋\n\nYour *${o.style}* is ${status} at GNOKE Stitches.\n\n💰 Balance: *₦${bal.toLocaleString('en-NG')}*\n\nPlease come in at your convenience.\n\n— Gnoke Tailors ✂️`;
      const waNum = (o.phone || '').replace(/\D/g, '');
      const waUrl = waNum
        ? `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
      return;
    }

    // Delete
    if (e.target.classList.contains('btn-del')) {
      if (!confirm('Delete this order? This cannot be undone.')) return;
      await Orders.remove(id);
      Render.calStrip();
      Render.overdueBanner();
      Render.jobList();
      UI.toast('Order deleted.', 'ok');
    }
  });


  /* ══════════════════════════════════════════════════════════════
     ADD ORDER PAGE
  ══════════════════════════════════════════════════════════════ */

  // Autocomplete
  document.getElementById('in-name')?.addEventListener('input', function() {
    Render.autocomplete(this.value.trim());
  });

  document.getElementById('autocomplete-box')?.addEventListener('click', e => {
    const item = e.target.closest('.ac-item');
    if (!item) return;
    const name = item.dataset.name;
    document.getElementById('in-name').value = name;
    document.getElementById('autocomplete-box').style.display = 'none';

    // Pre-fill last style + notes from most recent order
    const prev = Customers.history(name)[0];
    if (prev) {
      const styleEl = document.getElementById('in-style');
      const notesEl = document.getElementById('in-notes');
      if (styleEl && !styleEl.value) styleEl.value = prev.style;
      if (notesEl && !notesEl.value) notesEl.value = prev.notes;
    }
  });

  // Save
  document.getElementById('btn-save-order')?.addEventListener('click', async () => {
    const name = document.getElementById('in-name')?.value.trim();
    if (!name) { UI.toast('Enter a customer name.', 'err'); return; }

    await Orders.add({
      name,
      phone    : document.getElementById('in-phone')?.value.trim()   || '',
      style    : document.getElementById('in-style')?.value.trim()   || '',
      notes    : document.getElementById('in-notes')?.value.trim()   || '',
      price    : parseFloat(document.getElementById('in-price')?.value)   || 0,
      deposit  : parseFloat(document.getElementById('in-deposit')?.value) || 0,
      due_date : document.getElementById('in-date')?.value || State.get('today'),
      swatch   : document.getElementById('in-swatch')?.value.trim()  || '',
    });

    UI.toast('Order saved.', 'ok');
    UI.status('saved');
    State.set('selectedDate', document.getElementById('in-date')?.value || State.get('today'));
    setBnav('bnav-jobs');
    loadPage('jobs-page');
  });

  function resetAddForm() {
    ['in-name','in-phone','in-style','in-notes','in-price','in-deposit','in-date','in-swatch']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    const box = document.getElementById('autocomplete-box');
    if (box) box.style.display = 'none';
    // Reset fabric passport preview
    if (typeof clearFabricPhoto === 'function') {
      const passportInner = document.getElementById('fabric-passport-inner');
      if (passportInner) {
        document.getElementById('fabric-passport')?.classList.remove('has-image');
        passportInner.innerHTML = `
          <svg class="fabric-passport-placeholder" viewBox="0 0 40 40" fill="none">
            <rect x="4" y="4" width="32" height="32" rx="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
            <circle cx="20" cy="16" r="5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 34c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="fabric-passport-label">Tap to snap<br>fabric photo</span>
        `;
      }
    }
  }


  /* ══════════════════════════════════════════════════════════════
     CUSTOMERS PAGE
  ══════════════════════════════════════════════════════════════ */

  document.getElementById('cust-search')?.addEventListener('input', function() {
    Render.customers(this.value.trim());
  });

  // Expand customer card (delegation)
  document.getElementById('cust-list')?.addEventListener('click', e => {
    const card = e.target.closest('.cust-card');
    if (card) card.classList.toggle('expanded');
  });


  /* ══════════════════════════════════════════════════════════════
     SETTINGS PAGE — backup / restore / clear
  ══════════════════════════════════════════════════════════════ */

  document.getElementById('btn-export')?.addEventListener('click', () => {
    const rows = DB.query(`SELECT * FROM orders ORDER BY created_at ASC`);
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `gnoke-tailors-backup-${State.get('today')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('Backup exported.', 'ok');
  });

  document.getElementById('import-file')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const rows = JSON.parse(ev.target.result);
        if (!Array.isArray(rows)) throw new Error('Invalid format');
        if (!confirm(`Import ${rows.length} orders? This will add to existing data.`)) return;
        for (const o of rows) {
          await Orders.add({
            name     : o.name     || '',
            style    : o.style    || '',
            notes    : o.notes    || '',
            price    : o.price    || 0,
            deposit  : o.deposit  || 0,
            due_date : o.due_date || State.get('today'),
            swatch   : o.swatch   || '',
          });
        }
        UI.toast(`${rows.length} orders imported.`, 'ok');
        Render.calStrip();
        Render.jobList();
      } catch {
        UI.toast('Invalid backup file.', 'err');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    if (!confirm('Delete ALL data? Export a backup first!')) return;
    DB.run(`DELETE FROM orders`);
    DB.persist();
    UI.toast('All data cleared.', 'ok');
    loadPage('jobs-page');
  });

});


/* ── renderAboutTech ────────────────────────────────────────── */
function renderAboutTech(rows) {
  const tbody = document.getElementById('about-tech-table');
  if (!tbody) return;
  tbody.innerHTML = rows.map(([k, v]) => `
    <tr><td>${k}</td><td>${v}</td></tr>`).join('');
}
