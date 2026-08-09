#!/usr/bin/env python3
"""Turn the survey + the written copy into the exhibit.

  tools/survey.json   pool of graded Commons images   (from harvest.py)
  tools/copy/*.json   the prose, written by hand
        ↓
  assets/img/<work>/  downloaded, resized, re-encoded pictures
  data/halls/*.json   what the site actually loads
  CREDITS.md          every photographer, every licence
"""
import hashlib, io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IMGDIR = os.path.join(ROOT, 'assets', 'img')
UA = {'User-Agent': 'CathedralExhibitBuilder/1.0 (educational exhibit; tyler@flooractionllc.com)'}

FULL_W, THUMB_W = 1600, 760
FULL_Q, THUMB_Q = 80, 76

# how many of each kind to hang, per building
QUOTA = {'exterior': 3, 'interior': 3, 'detail': 3}

SHORTS = [
    (r'aerial|drone|from the air|bird', 'From the air'),
    (r'night|nuit|nacht|dusk|sunset|blue hour', 'By night'),
    (r'rose window|rosace|rosett|rose\b', 'The rose window'),
    (r'tympan', 'The tympanum'),
    (r'portal|portail|portada|doorway|west door', 'The portal'),
    (r'west front|westfront|westfassade|fa_?ade|fassade|fachada|facciata|front', 'The west front'),
    (r'chevet|apse|apsis|abside|east end', 'The east end'),
    (r'flying|buttress|arc.bout|strebe', 'The buttresses'),
    (r'vault|voute|vo_?te|gewolbe|gew_?lbe|b_?veda|boveda|ceiling|volta', 'The vaults'),
    (r'nave|nef|langhaus|mittelschiff|navata|nau', 'The nave'),
    (r'choir|chor\b|coro|choeur|ch_ur|chancel|sanctuary', 'The choir'),
    (r'transept|querhaus|crossing|vierung', 'The crossing'),
    (r'ambulatory|d_?ambulatoire|girola', 'The ambulatory'),
    (r'crypt|krypta|cripta', 'The crypt'),
    (r'cloister|clo_?tre|kreuzgang|claustro|chiostro', 'The cloister'),
    (r'stained|vitrail|vitraux|glasmalerei|vidriera|glass', 'The glass'),
    (r'capital|chapiteau|kapitell', 'The capitals'),
    (r'sculpt|statue|relief|carving|figure', 'The carving'),
    (r'organ|orgel|orgue', 'The organ'),
    (r'altar|retablo|retable|reredos', 'The altar'),
    (r'tomb|effigy|shrine|reliquar', 'The tomb'),
    (r'dome|coupole|kuppel|cupola|c_?pula', 'The dome'),
    (r'tower|turm|tour\b|spire|campanile|belfry|steeple', 'The tower'),
    (r'courtyard|cour\b|patio|hof\b|bailey|ward\b', 'The courtyard'),
    (r'wall|rampart|remparts|curtain|moat|gatehouse|barbican|keep|donjon', 'The walls'),
    (r'roof|dach|toit', 'The roof'),
    (r'hall\b|refector|saal|chamber|room', 'Inside'),
    (r'winter|snow|neige|schnee', 'In winter'),
    (r'plan|model', 'Detail'),
]
FALLBACK = {'exterior': 'Exterior', 'interior': 'Interior', 'detail': 'Detail'}


def short_for(name, desc, kind):
    hay = (name + ' ' + desc).replace('_', ' ')
    for rx, label in SHORTS:
        if re.search(rx.replace('_', '.'), hay, re.I):
            return label
    return FALLBACK[kind]


def caption_for(desc, name):
    d = re.sub(r'\s+', ' ', (desc or '')).strip(' .;,')
    d = re.sub(r'^(File:|Image:)', '', d)
    d = re.sub(r'\{\{[^}]*\}\}', '', d).strip()
    if not (14 <= len(d) <= 190):
        return ''
    if sum(c.isascii() for c in d) / max(len(d), 1) < 0.9:
        return ''
    if re.search(r'https?://|\bcamera\b|\blens\b|\bexif\b|©|\ball rights\b', d, re.I):
        return ''
    return d[0].upper() + d[1:]


def fetch(title, width):
    fname = title.replace('File:', '').replace(' ', '_')
    url = ('https://commons.wikimedia.org/wiki/Special:FilePath/'
           + urllib.parse.quote(fname) + f'?width={width}')
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:
            if attempt == 3:
                print(f'    ! download failed: {title} — {e}')
                return None
            time.sleep(2 * (attempt + 1))


def looks_like_photo(raw):
    """Reject engravings, plans and book scans: they are near-monochrome
    or dominated by paper-white."""
    try:
        im = Image.open(io.BytesIO(raw)).convert('RGB')
    except Exception:
        return False
    im.thumbnail((220, 220))
    hsv = im.convert('HSV')
    px = list(hsv.getdata())
    n = len(px)
    sat = sum(p[1] for p in px) / n
    white = sum(1 for p in px if p[2] > 235 and p[1] < 30) / n
    return sat >= 26 and white <= 0.30


def save(raw, path, width, quality):
    im = Image.open(io.BytesIO(raw))
    im = ImageOps.exif_transpose(im)
    if im.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', im.size, (10, 10, 12))
        im = im.convert('RGBA')
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(path, 'JPEG', quality=quality, optimize=True, progressive=True)
    return im.size


def dedupe(pool):
    """Drop near-identical shots: same photographer + very similar filename."""
    out, seen = [], []
    for p in pool:
        key = re.sub(r'[\W_]+', ' ', p['title'].replace('File:', '')).lower()
        key = re.sub(r'\d+', '', key).strip()
        if any(key == s or (key and s and (key in s or s in key)) for s in seen):
            continue
        seen.append(key)
        out.append(p)
    return out


ARCHIVAL = re.compile(r'recueil|btv1b|gallica|neurdein|photochrom|photoglob|'
                      r'zentralbibliothek|rijksmuseum|brooklyn museum|library of congress|'
                      r'albumen|stereo|daguerr|\b18\d\d\b|\b19[0-4]\d\b', re.I)

def candidates(entry, kind):
    """Ordered surplus of picks for one kind — callers stop at quota."""
    return dedupe([i for i in entry['images'] if i['kind'] == kind
                   and not ARCHIVAL.search(i['title'] + ' ' + i.get('desc', ''))])


HERO = re.compile(r'general view|overview|gesamtansicht|vue g|panoram|aerial|luftbild|'
                  r'from the (south|north|east|west|air|river|sea|hill)|west front|'
                  r'westfassade|fa[cç]ade|frontal|skyline|at (dusk|dawn|sunset|night)|'
                  r'seen from|view from|von (s|n|o|w)', re.I)
CLOSE = re.compile(r'detail|statue|door|window|roof|close|cropped|part of|fragment|'
                   r'tower(?!s)|turret|corner|wall\b|gate\b|bridge|entrance', re.I)

def hero_rank(p):
    hay = p['title'] + ' ' + p.get('desc', '')
    r = p['score']
    if HERO.search(hay): r += 40
    if CLOSE.search(hay): r -= 30
    if p['h'] > p['w']: r -= 12          # full exteriors read best in landscape
    return -r

def arrange(by_kind):
    """Lead with the strongest exterior, then alternate so the set reads well."""
    ext, inte, det = (list(by_kind[k]) for k in ('exterior', 'interior', 'detail'))
    ext.sort(key=hero_rank)
    order = []
    if ext: order.append(ext.pop(0))
    while ext or inte or det:
        for bucket in (inte, ext, det):
            if bucket: order.append(bucket.pop(0))
    return order


def fetch_meta(title):
    """Imageinfo for a single Commons file not present in the survey pool."""
    url = ('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query', 'titles': title, 'prop': 'imageinfo',
        'iiprop': 'url|size|extmetadata', 'format': 'json', 'formatversion': '2'}))
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        d = json.load(r)
    p = d['query']['pages'][0]
    if 'missing' in p or not p.get('imageinfo'):
        return None
    ii = p['imageinfo'][0]
    em = ii.get('extmetadata', {})
    strip = lambda s: re.sub(r'<[^>]+>|\s+', ' ', s or '').strip()
    return {'title': p['title'], 'kind': 'exterior', 'score': 999,
            'url': ii['url'], 'w': ii['width'], 'h': ii['height'],
            'desc': strip(em.get('ImageDescription', {}).get('value', ''))[:400],
            'artist': strip(em.get('Artist', {}).get('value', ''))[:140],
            'license': em.get('LicenseShortName', {}).get('value', ''),
            'licurl': em.get('LicenseUrl', {}).get('value', ''),
            'page': f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(p['title'].replace(' ', '_'))}"}


def build():
    survey = json.load(open(os.path.join(HERE, 'survey.json')))
    selection = json.load(open(os.path.join(HERE, 'selection.json')))
    leads = json.load(open(os.path.join(HERE, 'leads.json'))) \
        if os.path.exists(os.path.join(HERE, 'leads.json')) else {}
    timeline = json.load(open(os.path.join(ROOT, 'data', 'timeline.json')))
    credits, covers = [], {}

    for hall in timeline['halls']:
        hid = hall['id']
        copy_path = os.path.join(HERE, 'copy', f'{hid}.json')
        if not os.path.exists(copy_path):
            print(f'-- no copy for {hid}, skipping'); continue
        prose = json.load(open(copy_path))
        ids = [w for w in selection[hid]]
        works = []

        for wid in ids:
            entry = survey.get(wid)
            text = prose.get(wid)
            if not entry or not text:
                print(f'  !! {wid}: missing {"survey" if not entry else "copy"}'); continue
            outdir = os.path.join(IMGDIR, wid)
            os.makedirs(outdir, exist_ok=True)
            print(f'  {wid}')
            accepted = {'exterior': [], 'interior': [], 'detail': []}
            for kind, want in QUOTA.items():
                pool = candidates(entry, kind)
                if kind == 'exterior':
                    pool.sort(key=hero_rank)
                for pic in pool:
                    if len(accepted[kind]) >= want:
                        break
                    sig = hashlib.sha1(pic['title'].encode()).hexdigest()[:8]
                    base = f'{wid}-{sig}'
                    fp = os.path.join(outdir, base + '.jpg')
                    tp = os.path.join(outdir, base + '-t.jpg')
                    if os.path.exists(fp) and os.path.exists(tp):
                        if not looks_like_photo(open(fp, 'rb').read()):
                            print(f'    - cached but not a photo: {pic["title"][:70]}')
                            os.remove(fp); os.remove(tp)
                            continue
                    else:
                        raw = fetch(pic['title'], FULL_W)
                        if not raw:
                            continue
                        if not looks_like_photo(raw):
                            print(f'    - not a photo: {pic["title"][:70]}')
                            continue
                        try:
                            save(raw, fp, FULL_W, FULL_Q)
                            save(raw, tp, THUMB_W, THUMB_Q)
                        except Exception as e:
                            print(f'    ! encode failed {pic["title"]}: {e}')
                            for p in (fp, tp):
                                if os.path.exists(p): os.remove(p)
                            continue
                    pic['_base'] = base
                    accepted[kind].append(pic)
            # hand-picked lead, chosen by eye from contact sheets
            lead_title = leads.get(wid)
            ordered = arrange(accepted)
            if lead_title:
                ordered = [p for p in ordered if p['title'] != lead_title]
                lead = next((i for i in entry['images'] if i['title'] == lead_title), None) \
                    or fetch_meta(lead_title)
                if lead:
                    sig = hashlib.sha1(lead['title'].encode()).hexdigest()[:8]
                    base = f'{wid}-{sig}'
                    fp, tp = (os.path.join(outdir, base + s) for s in ('.jpg', '-t.jpg'))
                    ok = os.path.exists(fp) and os.path.exists(tp)
                    if not ok:
                        raw = fetch(lead['title'], FULL_W)
                        if raw:
                            try:
                                save(raw, fp, FULL_W, FULL_Q)
                                save(raw, tp, THUMB_W, THUMB_Q)
                                ok = True
                            except Exception as e:
                                print(f'    ! lead encode failed: {e}')
                    if ok:
                        lead['_base'], lead['kind'] = base, 'exterior'
                        ordered.insert(0, lead)
                    else:
                        print(f'    ! lead unavailable for {wid}')
            images = []
            for pic in ordered:
                base = pic['_base']
                name = pic['title'].replace('File:', '')
                images.append({
                    'full':  f'assets/img/{wid}/{base}.jpg',
                    'thumb': f'assets/img/{wid}/{base}-t.jpg',
                    'kind':  pic['kind'],
                    'short': short_for(name, pic.get('desc', ''), pic['kind']),
                    'caption': caption_for(pic.get('desc', ''), name),
                    'alt': f"{text['name']} — {short_for(name, pic.get('desc',''), pic['kind']).lower()}",
                    'artist': pic.get('artist') or 'Unknown',
                    'license': pic.get('license') or '',
                    'page': pic['page'],
                })
                credits.append((text['name'], name, pic.get('artist') or 'Unknown',
                                pic.get('license') or '', pic['page']))
            if len(images) < 4:
                print(f'  !! {wid}: only {len(images)} pictures — dropped')
                continue
            works.append({**text, 'id': wid, 'images': images})
            covers.setdefault(hid, images[0]['thumb'])

        json.dump({'hall': hid, 'works': works},
                  open(os.path.join(ROOT, 'data', 'halls', f'{hid}.json'), 'w'),
                  indent=1, ensure_ascii=False)
        print(f'== {hid}: {len(works)} works, '
              f'{sum(len(w["images"]) for w in works)} pictures')

    for h in timeline['halls']:
        if h['id'] in covers:
            h['cover'] = covers[h['id']]
    json.dump(timeline, open(os.path.join(ROOT, 'data', 'timeline.json'), 'w'),
              indent=1, ensure_ascii=False)

    # sweep image files no longer referenced by any hall
    used = set()
    for hf in os.listdir(os.path.join(ROOT, 'data', 'halls')):
        d = json.load(open(os.path.join(ROOT, 'data', 'halls', hf)))
        for w in d['works']:
            for im in w['images']:
                used.add(os.path.basename(im['full'])); used.add(os.path.basename(im['thumb']))
    removed = 0
    for sub in os.listdir(IMGDIR):
        p = os.path.join(IMGDIR, sub)
        if not os.path.isdir(p): continue
        for fn in os.listdir(p):
            if fn not in used:
                os.remove(os.path.join(p, fn)); removed += 1
    if removed: print(f'swept {removed} orphaned files')

    with open(os.path.join(ROOT, 'CREDITS.md'), 'w') as f:
        f.write('# Picture credits\n\nEvery photograph in this exhibit comes from '
                'Wikimedia Commons and is public domain or Creative Commons licensed. '
                'Listed by building, in the order the pictures appear.\n\n')
        last = None
        for work, fn, artist, lic, page in credits:
            if work != last:
                f.write(f'\n### {work}\n\n'); last = work
            f.write(f'- [{fn}]({page}) — {artist} — {lic}\n')
    print(f'\nwrote CREDITS.md ({len(credits)} pictures)')


if __name__ == '__main__':
    build()
