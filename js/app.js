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

  async function loadPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
    State.set('activePage', pageId);
    document.getElementById('context-info').textContent = '';

    // Render on activate
    if (pageId === 'jobs-page')      { Render.calStrip(); Render.overdueBanner(); Render.jobList(); }
    if (pageId === 'money-page')     { Render.money(); }
    if (pageId === 'customers-page') { Render.customers(''); }
    if (pageId === 'add-page')       { await resetAddForm(); }
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

    // Edit
    if (e.target.classList.contains('btn-edit')) {
      const o = DB.one(`SELECT * FROM orders WHERE id = ?`, [id]);
      if (!o) return;
      document.getElementById('edit-id').value      = o.id;
      document.getElementById('edit-name').value    = o.name;
      document.getElementById('edit-phone').value   = o.phone   || '';
      document.getElementById('edit-style').value   = o.style   || '';
      document.getElementById('edit-notes').value   = o.notes   || '';
      document.getElementById('edit-price').value   = o.price   || '';
      document.getElementById('edit-deposit').value = o.deposit || '';
      document.getElementById('edit-date').value    = o.due_date;
      document.getElementById('edit-modal-overlay').classList.add('show');
      return;
    }

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
     FABRIC PHOTO SLOT
  ══════════════════════════════════════════════════════════════ */

  document.getElementById('photo-slot-fabric')?.addEventListener('click', async e => {
    // Clear button inside the slot
    if (e.target.classList.contains('photo-slot-clear')) {
      e.stopPropagation();
      await ImageManager.remove('draft_fabric');
      await ImageManager.renderSlot('fabric', null);
      document.getElementById('in-swatch').value = '';
      return;
    }
    // Capture new photo
    const key = await ImageManager.capture('fabric');
    if (key) {
      await ImageManager.renderSlot('fabric', key);
      document.getElementById('in-swatch').value = key; // marks that a draft exists
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
      swatch   : '',  // filled in after we get the new id
    });

    // Promote draft fabric photo → permanent key; store key in swatch column
    const newOrder = DB.one(`SELECT id FROM orders ORDER BY id DESC LIMIT 1`);
    if (newOrder) {
      const permKey = await ImageManager.promote('fabric', newOrder.id);
      if (permKey) {
        DB.run(`UPDATE orders SET swatch = ? WHERE id = ?`, [permKey, newOrder.id]);
        await DB.persist();
      }
    }

    UI.toast('Order saved.', 'ok');
    UI.status('saved');
    State.set('selectedDate', document.getElementById('in-date')?.value || State.get('today'));
    setBnav('bnav-jobs');
    loadPage('jobs-page');
  });

  async function resetAddForm() {
    ['in-name','in-phone','in-style','in-notes','in-price','in-deposit','in-date','in-swatch']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    const box = document.getElementById('autocomplete-box');
    if (box) box.style.display = 'none';
    // Reset fabric photo slot to placeholder and clear any lingering draft
    await ImageManager.remove('draft_fabric');
    await ImageManager.renderSlot('fabric', null);
  }


  /* ══════════════════════════════════════════════════════════════
     EDIT ORDER MODAL
  ══════════════════════════════════════════════════════════════ */

  function _closeEditModal() {
    document.getElementById('edit-modal-overlay').classList.remove('show');
  }

  document.getElementById('edit-modal-close')?.addEventListener('click', _closeEditModal);
  document.getElementById('edit-cancel')?.addEventListener('click',      _closeEditModal);
  document.getElementById('edit-modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('edit-modal-overlay')) _closeEditModal();
  });

  document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
    const id = parseInt(document.getElementById('edit-id').value);
    if (!id) return;

    const name = document.getElementById('edit-name').value.trim();
    if (!name) { UI.toast('Customer name is required.', 'err'); return; }

    // Preserve existing swatch — edit modal doesn't touch photos
    const existing = DB.one(`SELECT swatch FROM orders WHERE id = ?`, [id]);

    await Orders.update(id, {
      name,
      phone    : document.getElementById('edit-phone').value.trim()   || '',
      style    : document.getElementById('edit-style').value.trim()   || '',
      notes    : document.getElementById('edit-notes').value.trim()   || '',
      price    : parseFloat(document.getElementById('edit-price').value)   || 0,
      deposit  : parseFloat(document.getElementById('edit-deposit').value) || 0,
      due_date : document.getElementById('edit-date').value || State.get('today'),
      swatch   : existing?.swatch || '',
    });

    _closeEditModal();
    Render.calStrip();
    Render.overdueBanner();
    Render.jobList();
    UI.toast('Order updated.', 'ok');
    UI.status('saved');
  });


  /* ══════════════════════════════════════════════════════════════
     MONEY PAGE — earnings period tabs
  ══════════════════════════════════════════════════════════════ */

  document.querySelectorAll('.earn-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      State.set('earningsPeriod', btn.dataset.period);
      Render.earnings();
    });
  });


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