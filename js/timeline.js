import { uri, rose } from './textures.js';

const $ = s => document.querySelector(s);

/* a pointed arch, used as the mask for every door */
const ARCH = (w = 300, h = 460) => uri(`<svg xmlns="http://www.w3.org/2000/svg"
  width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
  <path d="M0,${h} L0,${h * .42}
           Q0,${h * .10} ${w / 2},0
           Q${w},${h * .10} ${w},${h * .42}
           L${w},${h} Z" fill="%23fff"/></svg>`);

/* the axis is compressed: the first centuries get less room than the last */
const YEAR_A = 1000, YEAR_B = 2030;
const warp = y => {
  const t = (y - YEAR_A) / (YEAR_B - YEAR_A);
  return Math.pow(t, 0.78);
};

async function boot() {
  const tl = await fetch('data/timeline.json').then(r => r.json());
  $('#mastRose').style.backgroundImage = uri(rose(620, 210));

  const track = $('#track');
  const axis = $('#axis');

  track.innerHTML = tl.halls.map(h => `
    <a class="door" href="hall.html?hall=${h.id}" style="--hue:${h.hue}" data-id="${h.id}">
      <div class="door__arch">
        ${h.cover ? `<img src="${h.cover}" alt="${h.coverAlt || h.title}" loading="lazy" decoding="async">` : ''}
        <div class="door__wash"></div>
        <div class="door__no">${h.no}</div>
        <div class="door__meta">
          <div class="door__years">${h.years}</div>
          <h2 class="door__title">${h.title}</h2>
          <div class="door__era">${h.era}</div>
          <p class="door__blurb">${h.blurb}</p>
          <span class="door__enter">Enter the hall</span>
        </div>
      </div>
      <div class="door__edge"></div>
    </a>`).join('');
  const archURI = ARCH();
  track.querySelectorAll('.door__arch, .door__edge')
    .forEach(el => el.style.setProperty('--arch', archURI));

  // year ticks
  const ticks = [1000, 1200, 1400, 1600, 1800, 2000];
  axis.innerHTML =
    ticks.map(y => `<div class="axis__tick" style="left:${(warp(y) * 100).toFixed(2)}%"><i></i><span>${y}</span></div>`).join('') +
    tl.halls.map(h => {
      const a = warp(h.start) * 100, b = warp(h.end) * 100;
      return `<div class="axis__span" data-id="${h.id}" style="--hue:${h.hue};left:${a.toFixed(2)}%;width:${(b - a).toFixed(2)}%"></div>`;
    }).join('');

  const spans = [...axis.querySelectorAll('.axis__span')];
  const doors = [...track.querySelectorAll('.door')];
  const light = id => spans.forEach(s => s.classList.toggle('hot', s.dataset.id === id));

  doors.forEach(d => {
    d.addEventListener('pointerenter', () => light(d.dataset.id));
    d.addEventListener('focus', () => light(d.dataset.id));
    d.addEventListener('click', e => {
      e.preventDefault();
      document.body.style.transition = 'opacity .5s var(--ease)';
      document.body.style.opacity = '0';
      setTimeout(() => location.href = d.href, 460);
    });
  });
  track.addEventListener('pointerleave', () => light(null));

  // vertical wheel drives the horizontal rail
  track.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    track.scrollLeft += e.deltaY * 1.25;
  }, { passive: false });

  // drag to pan
  let down = false, sx = 0, sl = 0, moved = 0;
  track.addEventListener('pointerdown', e => { down = true; sx = e.clientX; sl = track.scrollLeft; moved = 0; });
  addEventListener('pointermove', e => {
    if (!down) return;
    moved += Math.abs(e.clientX - sx);
    track.scrollLeft = sl - (e.clientX - sx);
  });
  addEventListener('pointerup', () => { down = false; });

  // keyboard
  let i = 0;
  addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      i = Math.max(0, Math.min(doors.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
      doors[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      light(doors[i].dataset.id);
    }
    if (e.key === 'Enter' && document.activeElement === document.body) doors[i].click();
  });

  // light the era nearest the middle of the rail as you scroll
  const sync = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bd = 1e9;
    doors.forEach((d, k) => {
      const c = d.offsetLeft + d.offsetWidth / 2 - track.offsetLeft;
      if (Math.abs(c - mid) < bd) { bd = Math.abs(c - mid); best = k; }
    });
    i = best; light(doors[best].dataset.id);
  };
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  sync();
}

boot();
