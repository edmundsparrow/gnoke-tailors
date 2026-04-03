/**
 * render.js — Gnoke Tailors
 * All DOM building lives here. No DB calls. No state writes.
 * Reads from db-orders.js and State. Writes only to the DOM.
 *
 * Public API:
 *   Render.calStrip()
 *   Render.jobList()
 *   Render.overdueBanner()
 *   Render.money()
 *   Render.customers(query)
 *
 * Copyright © 2026 Edmund Sparrow — GNU GPL v3
 */

const Render = (() => {

  const today   = () => State.get('today');
  const selDate = () => State.get('selectedDate');

  /* ── Helpers ────────────────────────────────────────────────── */

  function _fmt(n) { return UI.fmt(n); }

  function _dayNames() { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; }

  function _statusChip(o) {
    if (o.ready)                   return `<span class="s-chip chip-ready">✓ Ready</span>`;
    if (o.due_date < today())      return `<span class="s-chip chip-overdue">⚠ Overdue</span>`;
    return                                `<span class="s-chip chip-sewing">● Sewing</span>`;
  }

  function _swatchEl(o) {
    // Real photo (data URL)
    if (o.swatch && o.swatch.startsWith('data:image')) {
      return `<div class="fabric-swatch fabric-swatch-photo" style="background:var(--surface2)">
        <img src="${o.swatch}" alt="Fabric" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);display:block;">
      </div>`;
    }
    // Hex colour
    if (o.swatch && o.swatch.startsWith('#')) {
      return `<div class="fabric-swatch" style="background:${o.swatch}"></div>`;
    }
    // Emoji or short text
    if (o.swatch && o.swatch.length <= 2) {
      return `<div class="fabric-swatch" style="background:var(--surface2)">${o.swatch}</div>`;
    }
    // Nothing — show pin icon
    return `<div class="fabric-swatch" style="background:var(--surface2)">🧷</div>`;
  }

  /* ── Calendar grid ──────────────────────────────────────────── */

  function calStrip() {
    const wrap = document.getElementById('cal-strip');
    if (!wrap) return;

    const datesWithJobs = Orders.datesWithJobs();
    const todayStr      = today();
    const selectedStr   = selDate();

    // Determine which month/year to show (driven by State.calMonth)
    let viewDate = State.get('calMonth');
    if (!viewDate) {
      viewDate = todayStr.substring(0, 7); // 'YYYY-MM'
      State.set('calMonth', viewDate);
    }
    const [viewYear, viewMonth] = viewDate.split('-').map(Number);

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const dayLabels  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // First day of month weekday offset
    const firstDay  = new Date(viewYear, viewMonth - 1, 1).getDay();
    const daysInMon = new Date(viewYear, viewMonth, 0).getDate();
    const prevMonDays = new Date(viewYear, viewMonth - 1, 0).getDate();

    // Header
    let html = `<div class="cal-header">
      <button class="cal-nav" id="cal-prev" data-dir="-1">&#8249;</button>
      <span class="cal-month-label">${monthNames[viewMonth - 1]} ${viewYear}</span>
      <button class="cal-nav" id="cal-next" data-dir="1">&#8250;</button>
    </div>
    <div class="cal-grid">`;

    // Day-of-week labels
    dayLabels.forEach(d => {
      html += `<div class="cal-daylabel">${d}</div>`;
    });

    // Leading grey cells from prev month
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonDays - i;
      html += `<div class="cal-cell cal-ghost">${day}</div>`;
    }

    // Current month cells
    for (let d = 1; d <= daysInMon; d++) {
      const mm   = String(viewMonth).padStart(2, '0');
      const dd   = String(d).padStart(2, '0');
      const ds   = `${viewYear}-${mm}-${dd}`;
      const has  = datesWithJobs.has(ds);
      const isToday    = ds === todayStr;
      const isActive   = ds === selectedStr;
      const isOverdue  = has && ds < todayStr;

      let cls = 'cal-cell';
      if (isActive)  cls += ' active';
      if (isToday && !isActive) cls += ' today';
      if (isOverdue) cls += ' overdue-day';

      html += `<div class="${cls}" data-date="${ds}">
        <span class="cal-num">${d}</span>
        <span class="cal-dot${has ? (isOverdue ? ' dot-overdue' : ' dot-has') : ''}"></span>
      </div>`;
    }

    // Trailing grey cells to complete the grid row
    const total = firstDay + daysInMon;
    const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let d = 1; d <= trailing; d++) {
      html += `<div class="cal-cell cal-ghost">${d}</div>`;
    }

    html += `</div>`; // close cal-grid

    wrap.innerHTML = html;

    // Wire month nav buttons
    wrap.querySelector('#cal-prev')?.addEventListener('click', () => _shiftMonth(-1));
    wrap.querySelector('#cal-next')?.addEventListener('click', () => _shiftMonth(1));
  }

  function _shiftMonth(dir) {
    const cur = State.get('calMonth') || State.get('today').substring(0, 7);
    const [y, m] = cur.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    State.set('calMonth', next);
    calStrip();
  }

  /* ── Overdue banner ─────────────────────────────────────────── */

  function overdueBanner() {
    const banner = document.getElementById('overdue-banner');
    if (!banner) return;
    const od  = Orders.overdue();
    if (!od.length) { banner.style.display = 'none'; return; }
    const amt = od.reduce((s, o) => s + (o.price - o.deposit), 0);
    document.getElementById('overdue-text').textContent =
      `${od.length} overdue · ${_fmt(amt)} at risk`;
    banner.style.display = 'flex';
  }

  /* ── Job list ───────────────────────────────────────────────── */

  function jobList() {
    const container = document.getElementById('job-list');
    const label     = document.getElementById('date-label');
    const pill      = document.getElementById('count-pill');
    if (!container) return;

    const ds      = selDate();
    const todayS  = today();
    const orders  = Orders.forDate(ds);

    if (label) {
      if (ds === todayS)    label.textContent = 'Due today';
      else if (ds < todayS) label.textContent = `Overdue — ${ds}`;
      else                  label.textContent = `Due on ${ds}`;
    }
    if (pill) pill.textContent = orders.length;

    if (!orders.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧵</div>
          <p>Your workshop is empty today.</p>
        </div>`;
      return;
    }

    container.innerHTML = orders.map(o => {
      const bal  = o.price - o.deposit;
      const isOv = !o.ready && o.due_date < todayS;
      const cls  = o.ready ? 'ready' : isOv ? 'overdue' : 'pending';
      return `
        <div class="order-card ${cls}" data-id="${o.id}">
          <div class="card-top" data-toggle="${o.id}">
            ${_swatchEl(o)}
            <div class="card-info">
              <div class="cust-name">${o.name}</div>
              <div class="style-tag">${o.style || 'No style'}</div>
              <div class="status-row">${_statusChip(o)}</div>
            </div>
            <div class="card-bal">${_fmt(bal)}</div>
          </div>
          <div class="card-detail">
            <div class="detail-label">Measurements &amp; Notes</div>
            <div class="memo-text">${o.notes || 'No notes added.'}</div>
            <div class="action-row">
              <button class="act-btn btn-toggle" data-id="${o.id}">
                ${o.ready ? 'Mark as sewing' : 'Mark as finished'}
              </button>
              <button class="act-btn btn-edit" data-id="${o.id}" title="Edit order">✏️</button>
              <button class="act-btn btn-wa" data-id="${o.id}">📲</button>
              <button class="act-btn btn-del" data-id="${o.id}">🗑</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ── Money page ─────────────────────────────────────────────── */

  function money() {
    const s        = Orders.stats();
    const ready    = Orders.allReady();
    const debtors  = Orders.debtors();
    const todayS   = today();
    const totalOwed = ready.reduce((sum, o) => sum + (o.price - o.deposit), 0);

    const setEl = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    setEl('money-owed',    _fmt(totalOwed));
    setEl('stat-total',    s.total);
    setEl('stat-done',     s.done);
    setEl('stat-overdue',  s.overdue);
    setEl('stat-deposits', _fmt(s.deposits));

    // Debtors list
    const dl = document.getElementById('debtor-list');
    if (dl) {
      if (!debtors.length) {
        dl.innerHTML = `<div class="empty-state" style="padding:20px"><p>No outstanding balances 🎉</p></div>`;
      } else {
        dl.innerHTML = debtors.map(o => {
          const bal  = o.price - o.deposit;
          const flag = o.due_date < todayS ? ' <span class="chip-overdue s-chip">Overdue</span>' : '';
          return `<div class="debtor-row">
            <div>
              <div class="debtor-name">${o.name}${flag}</div>
              <div class="debtor-meta">${o.style} · Due ${o.due_date}</div>
            </div>
            <div class="debtor-amt">${_fmt(bal)}</div>
          </div>`;
        }).join('');
      }
    }

    // Earnings section — driven by active period tab
    _renderEarnings();
  }

  function _renderEarnings() {
    const period = State.get('earningsPeriod') || 'month';

    // Sync tab active state
    document.querySelectorAll('.earn-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });

    const e    = Orders.earnings(period);
    const wrap = document.getElementById('earnings-body');
    if (!wrap) return;

    const periodLabel = { week: 'This week', month: 'This month', year: 'This year' }[period];

    wrap.innerHTML = `
      <div class="earn-stats">
        <div class="earn-stat">
          <div class="earn-stat-label">Jobs finished</div>
          <div class="earn-stat-value green">${e.jobsFinished}</div>
        </div>
        <div class="earn-stat">
          <div class="earn-stat-label">Jobs taken on</div>
          <div class="earn-stat-value">${e.jobsCreated}</div>
        </div>
        <div class="earn-stat">
          <div class="earn-stat-label">Value completed</div>
          <div class="earn-stat-value accent">${_fmt(e.totalValue)}</div>
        </div>
        <div class="earn-stat">
          <div class="earn-stat-label">Deposits received</div>
          <div class="earn-stat-value amber">${_fmt(e.depositsIn)}</div>
        </div>
      </div>

      ${e.completed.length ? `
        <div class="section-label" style="margin-top:16px">Completed — ${periodLabel}</div>
        ${e.completed.map(o => `
          <div class="debtor-row">
            <div>
              <div class="debtor-name">${o.name}</div>
              <div class="debtor-meta">${o.style} · Due ${o.due_date}</div>
            </div>
            <div class="debtor-amt" style="color:var(--green)">${_fmt(o.price)}</div>
          </div>`).join('')}
      ` : `<div class="empty-state" style="padding:28px 0"><p>No completed orders ${periodLabel.toLowerCase()}.</p></div>`}
    `;
  }

  /* ── Customers page ─────────────────────────────────────────── */

  function customers(q) {
    const list = document.getElementById('cust-list');
    if (!list) return;

    let groups = Customers.allGrouped();
    if (q) {
      const lq = q.toLowerCase();
      groups = groups.filter(g => g.name.toLowerCase().includes(lq));
    }

    if (!groups.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>No customers yet.</p></div>`;
      return;
    }

    list.innerHTML = groups.map(g => {
      const initials = g.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      const phone = g.orders[0]?.phone ? `<a class="cust-phone" href="tel:${g.orders[0].phone}">${g.orders[0].phone}</a>` : '';
      const hist = g.orders.slice(0, 4).map(o => `
        <div class="hist-item">
          <span><strong>${o.style}</strong> · ${o.due_date}</span>
          <span>${_fmt(o.price - o.deposit)}</span>
        </div>`).join('');
      const lastNotes = g.orders[0]?.notes || 'No measurements on file.';
      return `
        <div class="cust-card" data-cust="${g.name}">
          <div class="cust-top">
            <div class="cust-avatar">${initials}</div>
            <div class="cust-meta">
              <div class="cust-meta-name">${g.name}</div>
              <div class="cust-meta-sub">${g.count} order${g.count > 1 ? 's' : ''} · Last: ${g.lastStyle}</div>
              ${phone ? `<div class="cust-meta-phone">${phone}</div>` : ''}
            </div>
            <div class="cust-count">${g.count}×</div>
          </div>
          <div class="cust-history">
            <div class="detail-label" style="margin-bottom:8px">Order history</div>
            ${hist}
            <div class="memo-text" style="margin-top:10px">${lastNotes}</div>
          </div>
        </div>`;
    }).join('');
  }

  /* ── Autocomplete (new order form) ─────────────────────────── */

  function autocomplete(q) {
    const box = document.getElementById('autocomplete-box');
    if (!box) return;
    if (!q) { box.style.display = 'none'; return; }
    const matches = Customers.names(q);
    if (!matches.length) { box.style.display = 'none'; return; }
    box.innerHTML = matches.map(r =>
      `<div class="ac-item" data-name="${r.name}">${r.name}</div>`
    ).join('');
    box.style.display = 'block';
  }

  return { calStrip, overdueBanner, jobList, money, customers, autocomplete, earnings: _renderEarnings };

})();