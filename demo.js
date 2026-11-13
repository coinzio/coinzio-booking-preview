/* Static preview shim: fakes the availability API and the submit, so the page can be
   reviewed without the booking server running. Nothing is stored or sent. */
(function () {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const midnight = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const horizonEnd = () => {
    const d = midnight();
    d.setDate(d.getDate() + 30);
    return d;
  };
  const clock = (d) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}${m ? ':' + pad(m) : ''} ${suffix}`;
  };
  const stamp = (d) =>
    `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00.000-07:00`;

  const realFetch = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (input, init) {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);

    if (url.pathname.endsWith('/api/availability')) {
      const month = url.searchParams.get('month') || '';
      const [year, mon] = month.split('-').map(Number);
      const days = {};
      const last = new Date(year, mon, 0);
      for (let day = 1; day <= last.getDate(); day++) {
        const date = new Date(year, mon - 1, day);
        const dow = date.getDay();
        if (date < midnight() || date > horizonEnd()) continue;
        if (dow === 0 || dow === 6) continue;
        days[iso(date)] = 5;
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            days,
            horizon: { first: iso(midnight()), last: iso(horizonEnd()) }
          })
      });
    }

    if (url.pathname.endsWith('/api/slots')) {
      const type = url.searchParams.get('type');
      const date = url.searchParams.get('date');
      const duration = type === 'shop' ? 60 : 120;
      const slots = [];
      for (let mins = 11 * 60; mins + duration <= 17 * 60; mins += 30) {
        const start = new Date(`${date}T00:00:00`);
        start.setMinutes(mins);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + duration);
        slots.push({
          start: stamp(start),
          end: stamp(end),
          label: clock(start),
          endLabel: clock(end)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ date, slots }) });
    }

    if (realFetch) return realFetch(input, init);
    return Promise.reject(new Error('offline preview'));
  };

  const escape = (value) =>
    String(value || '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  document.addEventListener(
    'submit',
    function (event) {
      const form = event.target;
      if (!form || form.id !== 'booking-form') return;
      event.preventDefault();

      const start = document.getElementById('start-input');
      if (!start || !start.value) return;

      const name = (form.querySelector('input[name="name"]') || {}).value || 'there';
      const email = (form.querySelector('input[name="email"]') || {}).value || '';
      const summary = (document.getElementById('summary') || {}).textContent || '';
      const main = document.querySelector('main');
      if (!main) return;

      main.innerHTML =
        '<div class="wrap narrow confirm">' +
        '<p class="eyebrow">Request received</p>' +
        '<h1>Thank you, ' + escape(name.split(' ')[0]) + '.</h1>' +
        '<p class="lede">Chris reviews every appointment personally and replies by email, usually the same day.</p>' +
        '<div class="card">' +
        '<p class="ref">Reference <strong>CZ-PREVIEW</strong></p>' +
        '<p class="when-detail">' + escape(summary) + '</p>' +
        '<p>A confirmation goes to ' + escape(email) + ' once the time is checked against the calendar.</p>' +
        '<p class="late-note"><strong>Running late?</strong> Call <a href="tel:+14352003312">(435) 200-3312</a>. If you arrive more than 20 minutes after your appointment time, the appointment will be cancelled and the slot released so the rest of the day stays on schedule.</p>' +
        '</div>' +
        '<p class="fineprint">This is a preview of the booking flow. Nothing was sent, no time was held, and no email will arrive.</p>' +
        '<p class="actions"><a class="btn ghost" href="./">Back to the booking page</a></p>' +
        '</div>';

      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    },
    true
  );

  const footerWrap = document.querySelector('footer.site-footer .wrap');
  if (footerWrap) {
    const note = document.createElement('p');
    note.className = 'preview-note';
    note.textContent = 'Preview build — bookings are not live and nothing is sent.';
    footerWrap.appendChild(note);
  }
})();
