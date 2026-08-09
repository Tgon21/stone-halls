/* ─────────────────────────────────────────────────────────────
   Procedural stone.  Every surface in the hall is an SVG data URI
   generated here, tinted per era, so nothing has to be downloaded.
   ───────────────────────────────────────────────────────────── */

export const uri = svg =>
  `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s{2,}/g, ' '))}")`;

const rnd = seed => {                       // deterministic jitter
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/* ── wall: one bay of ashlar with a blind pointed arcade ────── */
export function wallBay(w, h, hue) {
  const r = rnd(97);
  const pil = 30;                            // pilaster width
  const spring = h * 0.40;                   // arch springing line
  const apex = h * 0.10;
  const ax0 = pil + 26, ax1 = w - pil - 26;
  const mid = w / 2;

  let courses = '';
  const ch = 46;
  for (let y = 0, i = 0; y < h; y += ch, i++) {
    courses += `<line x1="${pil}" y1="${y.toFixed(1)}" x2="${w - pil}" y2="${y.toFixed(1)}"/>`;
    const n = 3 + (i % 2);
    for (let k = 1; k < n; k++) {
      const x = pil + ((k + (i % 2) * .5) / n) * (w - pil * 2) + (r() - .5) * 14;
      courses += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + ch).toFixed(1)}"/>`;
    }
  }

  const arch = `M${ax0},${h} L${ax0},${spring}
                Q${ax0},${apex + (spring - apex) * .34} ${mid},${apex}
                Q${ax1},${apex + (spring - apex) * .34} ${ax1},${spring}
                L${ax1},${h} Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${hue} 12% 7%)"/>
        <stop offset=".46" stop-color="hsl(${hue} 14% 13%)"/>
        <stop offset=".82" stop-color="hsl(${hue} 13% 10%)"/>
        <stop offset="1" stop-color="hsl(${hue} 12% 6%)"/>
      </linearGradient>
      <linearGradient id="n" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${hue} 16% 4%)" stop-opacity=".92"/>
        <stop offset=".55" stop-color="hsl(${hue} 16% 9%)" stop-opacity=".6"/>
        <stop offset="1" stop-color="hsl(${hue} 14% 5%)" stop-opacity=".85"/>
      </linearGradient>
      <linearGradient id="p" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="hsl(${hue} 12% 4%)"/>
        <stop offset=".34" stop-color="hsl(${hue} 15% 17%)"/>
        <stop offset=".62" stop-color="hsl(${hue} 14% 12%)"/>
        <stop offset="1" stop-color="hsl(${hue} 12% 5%)"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(%23s)"/>
    <g stroke="hsl(${hue} 14% 3%)" stroke-width="1.1" opacity=".5" fill="none">${courses}</g>
    <path d="${arch}" fill="url(%23n)"/>
    <path d="${arch}" fill="none" stroke="hsl(${hue} 18% 20%)" stroke-width="3.5" opacity=".55"/>
    <rect x="0" y="0" width="${pil}" height="${h}" fill="url(%23p)"/>
    <rect x="${w - pil}" y="0" width="${pil}" height="${h}" fill="url(%23p)"/>
    <rect x="0" y="${(h * .30).toFixed(0)}" width="${w}" height="7" fill="hsl(${hue} 14% 16%)" opacity=".5"/>
    <rect x="0" y="${(h * .30 + 7).toFixed(0)}" width="${w}" height="3" fill="hsl(${hue} 14% 3%)" opacity=".6"/>
  </svg>`;
}

/* ── ceiling: a quadripartite rib vault seen from below ─────── */
export function ceilBay(w, h, hue) {
  const cx = w / 2, cy = h / 2;
  const rib = c => `stroke="hsl(${hue} 16% ${c}%)"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <radialGradient id="v" cx="50%" cy="50%" r="62%">
        <stop offset="0" stop-color="hsl(${hue} 14% 12%)"/>
        <stop offset=".62" stop-color="hsl(${hue} 15% 7%)"/>
        <stop offset="1" stop-color="hsl(${hue} 16% 3%)"/>
      </radialGradient>
      <radialGradient id="b" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="hsl(42 55% 44%)" stop-opacity=".55"/>
        <stop offset="1" stop-color="hsl(42 55% 40%)" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(%23v)"/>
    <g fill="none" stroke-width="9" stroke-linecap="round" opacity=".62" ${rib(19)}>
      <path d="M0,0 Q${cx},${cy * .82} ${w},${h}"/>
      <path d="M${w},0 Q${cx},${cy * .82} 0,${h}"/>
    </g>
    <g fill="none" stroke-width="12" opacity=".5" ${rib(15)}>
      <path d="M0,0 L0,${h}"/><path d="M${w},0 L${w},${h}"/>
      <path d="M0,0 Q${cx},${cy * .5} ${w},0"/>
      <path d="M0,${h} Q${cx},${h - cy * .5} ${w},${h}"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="${Math.min(w, h) * .28}" fill="url(%23b)"/>
    <circle cx="${cx}" cy="${cy}" r="16" fill="hsl(42 48% 34%)" opacity=".7"/>
  </svg>`;
}

/* ── floor: worn flagstones with a runner of light down the axis ── */
export function floorBay(w, h, hue) {
  const r = rnd(311);
  let flags = '';
  const cols = 5, rows = 4;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = (i * w) / cols, y = (j * h) / rows;
    const l = 6 + r() * 5;
    flags += `<rect x="${x + 2}" y="${y + 2}" width="${w / cols - 4}" height="${h / rows - 4}"
              fill="hsl(${hue} 10% ${l.toFixed(1)}%)" rx="2"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="r" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="hsl(30 40% 30%)" stop-opacity="0"/>
        <stop offset=".5" stop-color="hsl(32 45% 34%)" stop-opacity=".16"/>
        <stop offset="1" stop-color="hsl(30 40% 30%)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="hsl(${hue} 10% 4%)"/>
    ${flags}
    <rect x="${w * .3}" y="0" width="${w * .4}" height="${h}" fill="url(%23r)"/>
  </svg>`;
}

/* ── the rose window that closes the hall ──────────────────── */
export function rose(size, hue) {
  const c = size / 2, R = size * 0.46;
  const glass = ['#3f6bb8', '#b23c34', '#2f7d5e', '#c9a227', '#6a4a9c', '#c96a2c'];
  let petals = '';
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const r0 = R * .34, r1 = R * .92;
    const p = (a, r) => `${(c + Math.cos(a) * r).toFixed(1)},${(c + Math.sin(a) * r).toFixed(1)}`;
    petals += `<path d="M${p(a0, r0)} L${p(a0, r1)} A${r1},${r1} 0 0,1 ${p(a1, r1)} L${p(a1, r0)}
                A${r0},${r0} 0 0,0 ${p(a0, r0)} Z"
                fill="${glass[i % glass.length]}" opacity=".82"/>`;
    const am = (a0 + a1) / 2;
    petals += `<circle cx="${(c + Math.cos(am) * R * .63).toFixed(1)}"
                cy="${(c + Math.sin(am) * R * .63).toFixed(1)}" r="${(R * .13).toFixed(1)}"
                fill="${glass[(i + 3) % glass.length]}" opacity=".95"/>`;
  }
  let spokes = '';
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    spokes += `<line x1="${(c + Math.cos(a) * R * .3).toFixed(1)}" y1="${(c + Math.sin(a) * R * .3).toFixed(1)}"
                x2="${(c + Math.cos(a) * R).toFixed(1)}" y2="${(c + Math.sin(a) * R).toFixed(1)}"
                stroke="hsl(${hue} 12% 6%)" stroke-width="${size * .022}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><filter id="g"><feGaussianBlur stdDeviation="${size * .012}"/></filter></defs>
    <circle cx="${c}" cy="${c}" r="${R * 1.1}" fill="hsl(${hue} 12% 5%)"/>
    <g filter="url(%23g)" opacity=".95">${petals}</g>
    ${spokes}
    <circle cx="${c}" cy="${c}" r="${R * .3}" fill="none" stroke="hsl(${hue} 12% 6%)" stroke-width="${size * .026}"/>
    <circle cx="${c}" cy="${c}" r="${R * .17}" fill="#e8d9a6" opacity=".9"/>
    <circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="hsl(${hue} 12% 7%)" stroke-width="${size * .05}"/>
  </svg>`;
}
