/* ─────────────────────────────────────────────────────────────
   The catalogue.  Click a painting and this slides up over the
   hall: the whole picture set, the history, the architecture.
   ───────────────────────────────────────────────────────────── */

let open = false, current = null, allWorks = [], onJump = null, hallRef = null;
let root, gal, lightbox, lbIndex = 0, imgs = [];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const plaqueIsOpen = () => open;

function ensure() {
  if (root) return;
  root = document.createElement('div');
  root.className = 'plaque';
  root.innerHTML = `
    <div class="plaque__scrim" data-close></div>
    <article class="plaque__sheet" role="dialog" aria-modal="true" aria-label="Catalogue entry">
      <button class="plaque__x" data-close aria-label="Return to the hall">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>
      </button>
      <div class="plaque__scroll">
        <header class="plaque__head"></header>
        <div class="plaque__gallery"></div>
        <div class="plaque__body"></div>
      </div>
      <nav class="plaque__nav"></nav>
    </article>
    <div class="lightbox" hidden>
      <button class="lightbox__x" aria-label="Close">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>
      </button>
      <button class="lightbox__arrow lightbox__arrow--l" aria-label="Previous">‹</button>
      <button class="lightbox__arrow lightbox__arrow--r" aria-label="Next">›</button>
      <figure><img alt=""><figcaption></figcaption></figure>
    </div>`;
  document.body.appendChild(root);
  gal = root.querySelector('.plaque__gallery');
  lightbox = root.querySelector('.lightbox');

  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) close();
  });
  lightbox.querySelector('.lightbox__x').addEventListener('click', () => hideLB());
  lightbox.querySelector('.lightbox__arrow--l').addEventListener('click', () => stepLB(-1));
  lightbox.querySelector('.lightbox__arrow--r').addEventListener('click', () => stepLB(1));
  addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape') { lightbox.hidden ? close() : hideLB(); }
    if (!lightbox.hidden && e.key === 'ArrowLeft') stepLB(-1);
    if (!lightbox.hidden && e.key === 'ArrowRight') stepLB(1);
  });
}

const KIND = { exterior: 'Exterior', interior: 'Interior', detail: 'Detail' };

function render(w) {
  imgs = w.images || [];
  root.querySelector('.plaque__head').innerHTML = `
    <p class="plaque__era">${esc(hallRef.era)} · ${esc(hallRef.years)}</p>
    <h1>${esc(w.name)}</h1>
    <p class="plaque__where">${esc(w.place)}<span>·</span>${esc(w.dates)}</p>
    <p class="plaque__tag">${esc(w.tagline)}</p>
    <hr class="rule-gold">`;

  gal.innerHTML = imgs.map((im, i) => `
    <figure class="shot shot--${im.kind} ${i === 0 ? 'shot--lead' : ''}" data-i="${i}">
      <img src="${esc(im.thumb)}" alt="${esc(im.alt || w.name)}" loading="lazy" decoding="async">
      <figcaption>
        <span class="shot__kind">${KIND[im.kind] || ''}</span>
        ${im.caption ? `<span class="shot__cap">${esc(im.caption)}</span>` : ''}
      </figcaption>
    </figure>`).join('');
  gal.querySelectorAll('.shot').forEach(f =>
    f.addEventListener('click', () => showLB(+f.dataset.i)));

  const paras = a => (a || []).map(p => `<p>${esc(p)}</p>`).join('');
  root.querySelector('.plaque__body').innerHTML = `
    <section class="col">
      <h2><span>I</span>The Building</h2>
      ${paras(w.history)}
    </section>
    <section class="col">
      <h2><span>II</span>The Architecture</h2>
      ${paras(w.architecture)}
    </section>
    ${w.geo ? `
    <section class="col plaque__geo">
      <h2><span>III</span>Where It Stands</h2>
      <nav class="geo__tabs" role="tablist">
        <button class="geo__tab on" data-view="sat">Satellite</button>
        <button class="geo__tab" data-view="map">Map</button>
        <button class="geo__tab" data-view="sv">Street view</button>
        <a class="geo__open" target="_blank" rel="noopener"
           href="https://www.google.com/maps/search/?api=1&query=${w.geo.lat},${w.geo.lng}">
           Open in Google Maps ↗</a>
      </nav>
      <div class="geo__pane" data-lat="${w.geo.lat}" data-lng="${w.geo.lng}"></div>
      <p class="geo__hint">Drop into street view and walk around the outside — or drag the map;
         the pin marks ${esc(w.name)}.</p>
    </section>` : ''}
    <aside class="facts">
      <h3>In figures</h3>
      <dl>${(w.facts || []).map(f => `<dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd>`).join('')}</dl>
      ${w.look && w.look.length ? `<h3>Look for</h3><ul class="look">${w.look.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      ${w.wiki ? `<a class="btn plaque__more" href="${esc(w.wiki)}" target="_blank" rel="noopener">Read further ↗</a>` : ''}
      <details class="credits">
        <summary>Picture credits</summary>
        <ol>${imgs.map(im => `<li><a href="${esc(im.page)}" target="_blank" rel="noopener">${esc(im.short || KIND[im.kind])}</a> — ${esc(im.artist || 'Unknown')}, ${esc(im.license || '')}</li>`).join('')}</ol>
      </details>
    </aside>`;

  wireGeo();

  const i = allWorks.findIndex(x => x.id === w.id);
  const prev = allWorks[i - 1], next = allWorks[i + 1];
  root.querySelector('.plaque__nav').innerHTML = `
    ${prev ? `<button class="pnav pnav--prev" data-go="${esc(prev.id)}"><span class="label">Previous</span><b>${esc(prev.name)}</b></button>` : '<span></span>'}
    ${next ? `<button class="pnav pnav--next" data-go="${esc(next.id)}"><span class="label">Next</span><b>${esc(next.name)}</b></button>` : '<span></span>'}`;
  root.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () => {
      const t = allWorks.find(x => x.id === b.dataset.go);
      current = t; render(t);
      root.querySelector('.plaque__scroll').scrollTop = 0;
      onJump && onJump(t);
      history.replaceState(null, '', `?hall=${hallRef.id}&work=${t.id}`);
    }));
}

/* ── the map / street-view block ───────────────────────────────
   Keyless Google embeds. The iframe is created only when the pane
   scrolls into view, and swapped when a tab is picked. */
const GEO_SRC = {
  sat: (a, o) => `https://maps.google.com/maps?q=${a},${o}&z=17&t=k&output=embed`,
  map: (a, o) => `https://maps.google.com/maps?q=${a},${o}&z=16&output=embed`,
  sv:  (a, o) => `https://maps.google.com/maps?q=&layer=c&cbll=${a},${o}&cbp=11,0,0,0,0&output=svembed`,
};

function loadGeo(pane, view) {
  const { lat, lng } = pane.dataset;
  pane.innerHTML =
    `<iframe src="${GEO_SRC[view](lat, lng)}" loading="lazy" allowfullscreen
      referrerpolicy="no-referrer-when-downgrade"
      title="${view === 'sv' ? 'Street view' : 'Map'}"></iframe>`;
}

function wireGeo() {
  const sec = root.querySelector('.plaque__geo');
  if (!sec) return;
  const pane = sec.querySelector('.geo__pane');
  const tabs = [...sec.querySelectorAll('.geo__tab')];
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.toggle('on', x === t));
    loadGeo(pane, t.dataset.view);
  }));
  // don't touch the network until the reader reaches the section
  new IntersectionObserver((es, ob) => {
    if (es.some(e => e.isIntersecting)) { loadGeo(pane, 'sat'); ob.disconnect(); }
  }, { root: root.querySelector('.plaque__scroll'), rootMargin: '200px' }).observe(pane);
}

function showLB(i) {
  lbIndex = i;
  const im = imgs[i]; if (!im) return;
  const fig = lightbox.querySelector('img');
  fig.src = im.full || im.thumb;
  fig.alt = im.alt || '';
  lightbox.querySelector('figcaption').innerHTML =
    `<b>${esc(KIND[im.kind] || '')}</b> ${esc(im.caption || '')}
     <a href="${esc(im.page)}" target="_blank" rel="noopener">${esc(im.artist || 'Unknown')} · ${esc(im.license || '')} ↗</a>`;
  lightbox.hidden = false;
}
const stepLB = d => showLB((lbIndex + d + imgs.length) % imgs.length);
const hideLB = () => lightbox.hidden = true;

export function openPlaque(work, works, hall, jump) {
  ensure();
  allWorks = works; hallRef = hall; onJump = jump; current = work;
  render(work);
  root.querySelector('.plaque__scroll').scrollTop = 0;
  open = true;
  requestAnimationFrame(() => root.classList.add('show'));
  history.replaceState(null, '', `?hall=${hall.id}&work=${work.id}`);
}

export function closePlaque() { close(); }

function close() {
  if (!open) return;
  hideLB();
  root.classList.remove('show');
  open = false;
  history.replaceState(null, '', `?hall=${hallRef.id}`);
}
