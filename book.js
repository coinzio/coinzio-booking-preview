(function () {
  'use strict';

  const form = document.getElementById('booking-form');
  if (!form) return;

  const typeInput = document.getElementById('type-input');
  const startInput = document.getElementById('start-input');
  const calendar = document.getElementById('calendar');
  const calLabel = document.getElementById('cal-label');
  const slotsEl = document.getElementById('slots');
  const slotsTitle = document.getElementById('slots-title');
  const details = document.getElementById('details');
  const summary = document.getElementById('summary');
  const prevBtn = document.getElementById('prev-month');
  const nextBtn = document.getElementById('next-month');
  const submitBtn = document.getElementById('submit-btn');
  const groupSelling = document.getElementById('group-selling');
  const groupBuying = document.getElementById('group-buying');
  const photosInput = document.getElementById('photos');
  const photoPreview = document.getElementById('photo-preview');

  const cards = Array.from(document.querySelectorAll('.type-card'));
  const typeInfo = {};
  cards.forEach((c) => {
    typeInfo[c.dataset.type] = { label: c.querySelector('.type-name').textContent.trim() };
  });

  const state = {
    type: typeInput.value || 'appraisal',
    month: form.dataset.month,
    today: form.dataset.today,
    horizon: null,
    days: {},
    date: null,
    slot: null
  };

  function setPressed() {
    cards.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.type === state.type)));
  }

  /** Show the fields that belong to the chosen appointment type. */
  function syncGroups() {
    const selling = state.type === 'appraisal';
    if (groupSelling) {
      groupSelling.hidden = !selling;
      groupSelling.querySelectorAll('input, select, textarea').forEach((el) => {
        el.disabled = !selling;
      });
    }
    if (groupBuying) {
      groupBuying.hidden = selling;
      groupBuying.querySelectorAll('input, select, textarea').forEach((el) => {
        el.disabled = selling;
      });
    }
  }

  function monthLabel(param) {
    const [y, m] = param.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function longDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function shiftMonth(param, delta) {
    const [y, m] = param.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function withinHorizonMonth(param) {
    if (!state.horizon) return true;
    return param >= state.horizon.first.slice(0, 7) && param <= state.horizon.last.slice(0, 7);
  }

  function renderCalendar() {
    calLabel.textContent = monthLabel(state.month);
    calendar.innerHTML = '';

    const [y, m] = state.month.split('-').map(Number);
    const firstDow = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();

    for (let i = 0; i < firstDow; i++) calendar.appendChild(document.createElement('span'));

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${state.month}-${String(day).padStart(2, '0')}`;
      const count = state.days[iso] || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day';
      btn.textContent = String(day);
      btn.dataset.date = iso;

      if (count > 0) {
        btn.classList.add('available');
        btn.setAttribute('aria-label', `${longDate(iso)}, ${count} times available`);
        btn.addEventListener('click', () => selectDate(iso));
      } else {
        btn.disabled = true;
        btn.setAttribute('aria-label', `${longDate(iso)}, no availability`);
      }

      if (iso === state.today) btn.classList.add('today');
      if (iso === state.date) btn.classList.add('selected');
      calendar.appendChild(btn);
    }

    prevBtn.disabled = !withinHorizonMonth(shiftMonth(state.month, -1));
    nextBtn.disabled = !withinHorizonMonth(shiftMonth(state.month, 1));
  }

  async function loadMonth(month, opts) {
    const options = opts || {};
    state.month = month;
    calLabel.textContent = 'Loading…';
    calendar.innerHTML = '';

    try {
      const res = await fetch(`/api/availability?type=${encodeURIComponent(state.type)}&month=${month}`);
      const data = await res.json();
      state.days = data.days || {};
      state.horizon = data.horizon || null;

      if (!state.date && !options.noJump) {
        const hasAny = Object.keys(state.days).length > 0;
        if (!hasAny && withinHorizonMonth(shiftMonth(month, 1))) {
          return loadMonth(shiftMonth(month, 1), { noJump: true });
        }
      }
      renderCalendar();
    } catch (err) {
      calLabel.textContent = 'Could not load times';
      console.error(err);
    }
  }

  async function selectDate(iso) {
    state.date = iso;
    state.slot = null;
    details.hidden = true;
    startInput.value = '';
    renderCalendar();

    slotsTitle.textContent = longDate(iso);
    slotsEl.innerHTML = '<p class="empty">Loading times…</p>';

    try {
      const res = await fetch(`/api/slots?type=${encodeURIComponent(state.type)}&date=${iso}`);
      const data = await res.json();
      const slots = data.slots || [];
      slotsEl.innerHTML = '';

      if (!slots.length) {
        slotsEl.innerHTML = '<p class="empty">That day just filled up. Please choose another.</p>';
        return;
      }

      slots.forEach((slot) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot';
        b.innerHTML = `${slot.label}<small>to ${slot.endLabel}</small>`;
        b.addEventListener('click', () => selectSlot(slot, b));
        slotsEl.appendChild(b);
      });
    } catch (err) {
      slotsEl.innerHTML = '<p class="empty">Could not load times. Please try again.</p>';
      console.error(err);
    }
  }

  function selectSlot(slot, button) {
    state.slot = slot;
    startInput.value = slot.start;

    slotsEl.querySelectorAll('.slot').forEach((el) => el.classList.remove('selected'));
    button.classList.add('selected');

    const label = typeInfo[state.type] ? typeInfo[state.type].label : 'Appointment';
    summary.textContent = `${label} · ${longDate(state.date)} · ${slot.label} – ${slot.endLabel}`;
    details.hidden = false;
    details.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderPhotoPreview() {
    if (!photoPreview || !photosInput) return;
    photoPreview.innerHTML = '';
    const files = Array.from(photosInput.files || []);
    if (!files.length) return;

    files.slice(0, 6).forEach((file) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.alt = file.name;
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      fig.appendChild(img);
      photoPreview.appendChild(fig);
    });

    if (files.length > 6) {
      const note = document.createElement('p');
      note.className = 'empty';
      note.textContent = 'Only the first six photos will be sent.';
      photoPreview.appendChild(note);
    }
  }

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      state.type = card.dataset.type;
      typeInput.value = state.type;
      setPressed();
      syncGroups();
      state.date = null;
      state.slot = null;
      startInput.value = '';
      details.hidden = true;
      slotsTitle.textContent = 'Choose a day';
      slotsEl.innerHTML = '';
      loadMonth(state.month);
    });
  });

  if (photosInput) photosInput.addEventListener('change', renderPhotoPreview);

  prevBtn.addEventListener('click', () => loadMonth(shiftMonth(state.month, -1)));
  nextBtn.addEventListener('click', () => loadMonth(shiftMonth(state.month, 1)));

  form.addEventListener('submit', (e) => {
    if (!startInput.value) {
      e.preventDefault();
      slotsEl.innerHTML = '<p class="empty">Please pick a day and a time first.</p>';
      slotsTitle.textContent = 'Choose a day';
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending request…';
  });

  setPressed();
  syncGroups();
  loadMonth(state.month);
})();
