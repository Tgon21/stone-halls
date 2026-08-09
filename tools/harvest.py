#!/usr/bin/env python3
"""Survey Wikimedia Commons for photographic coverage of each candidate building.

Writes tools/survey.json: for every candidate, the pool of usable images already
classified as exterior / interior / detail and scored. Buildings that cannot
field a rich set of images get dropped before any exhibit copy is written.
"""
import json, re, sys, time, urllib.request, urllib.parse, os

UA = {'User-Agent': 'CathedralExhibitBuilder/1.0 (educational exhibit; tyler@flooractionllc.com)'}
HERE = os.path.dirname(os.path.abspath(__file__))

def api(params, host="commons.wikimedia.org", tries=4):
    params = {**params, 'format': 'json', 'formatversion': '2'}
    url = f"https://{host}/w/api.php?" + urllib.parse.urlencode(params)
    for t in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if t == tries - 1:
                print(f"  ! api fail {e}", file=sys.stderr)
                return {}
            time.sleep(1.5 * (t + 1))

def commons_category(article):
    r = api({'action': 'query', 'prop': 'pageprops', 'titles': article}, host='en.wikipedia.org')
    pages = r.get('query', {}).get('pages', [])
    if not pages or 'missing' in pages[0]:
        return None
    qid = pages[0].get('pageprops', {}).get('wikibase_item')
    if not qid:
        return None
    try:
        with urllib.request.urlopen(urllib.request.Request(
                f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json", headers=UA), timeout=60) as r:
            d = json.load(r)
    except Exception:
        return None
    ent = d['entities'][qid]
    cl = ent.get('claims', {}).get('P373')
    if cl:
        return cl[0]['mainsnak']['datavalue']['value']
    sl = ent.get('sitelinks', {}).get('commonswiki', {}).get('title')
    return sl.replace('Category:', '') if sl else None

# ---------------------------------------------------------------- vocabulary
INTERIOR = r"""interior|interieur|int_rieur|inneres|innere|innen|interno|intern|nave|nef|nau|navata|
langhaus|mittelschiff|choir|chor|coro|choeur|ch_ur|sanctuary|crossing|vierung|transept|querhaus|querschiff|
vault|vaults|vaulting|voute|vo_te|gewolbe|gew_lbe|boveda|b_veda|volta|ceiling|plafond|decke|aisle|bas_cote|
seitenschiff|ambulatory|deambulatoire|d_ambulatoire|girola|crypt|krypta|cripta|crypte|chapel|chapelle|kapelle|
capilla|cappella|organ|orgel|orgue|organo|pulpit|kanzel|altar|autel|retablo|retable|stalls|stallen|triforium|
clerestory|narthex|rood|refectory|refectorium|refektorium|great hall|hall of|throne room|thronsaal|
sala|salon|chamber|room|inside|indoor"""

DETAIL = r"""tympan|portal|portail|portada|portale|west door|doorway|sculpt|statue|statues|capital|chapiteau|
kapitell|gargoyle|gargouille|wasserspeier|rose window|rosace|rosette|rosett|stained|glass|vitrail|vitraux|
glasmalerei|glasfenster|vidriera|vetrata|window|fenster|fenetre|frieze|relief|tracery|masswerk|ma_werk|
pinnacle|fleuron|finial|corbel|misericord|mosaic|mosaik|mosaique|boss|keystone|frescoe|fresco|fresque|
tomb|effigy|shrine|reliquar|screen|jube|jub_|font|gable|arcade|colonnade|column|columns|saule|s_ule|
detail|detalle|dettaglio|carving|ornament|inscription|lintel|archivolt|spandrel|niche|tabernacle"""

EXTERIOR = r"""exterior|exterieur|ext_rieur|aussen|au_en|outside|facade|fa_ade|fassade|fachada|facciata|
west front|westfront|westfassade|east end|chevet|apse|abside|apsis|tower|towers|tour|tours|turm|t_rme|
spire|spires|fleche|fl_che|campanile|belfry|beffroi|dome|coupole|kuppel|cupola|c_pula|buttress|
arc_boutant|strebe|aerial|drone|panorama|skyline|view|vue|ansicht|vista|veduta|widok|from the|seen from|
night|nuit|nacht|sunset|sunrise|dusk|dawn|winter|snow|roof|dach|toit|courtyard|cour|hof|patio|
walls|ramparts|remparts|moat|keep|donjon|bailey|gatehouse|barbican|castle from|overview|general view"""

BAD = r"""\bplan\b|\bplans\b|grundriss|\bplano\b|floorplan|\bmap\b|\bmaps\b|\bkarte\b|\bmapa\b|\bmappa\b|
\bdiagram\b|\bschema\b|\bscheme\b|coat of arms|wappen|escudo|blason|stemma|\bseal\b|siegel|
\bstamp\b|briefmarke|postage|\bcoin\b|\bmedal\b|\blogo\b|\bbanner\b|\bsign\b|signage|
\bgraph\b|\bchart\b|\bdrawing\b|\bdessin\b|zeichnung|\bdibujo\b|\bdisegno\b|
engraving|gravure|kupferstich|lithograph|\betching\b|woodcut|\bsketch\b|croquis|blueprint|
section through|cross.section|elevation drawing|axonometr|isometric|reconstruction drawing|
\bmodel of\b|maquette|\blego\b|minecraft|postcard|carte postale|ansichtskarte|
portrait of|bust of|grave of|tombstone|cemetery|\bbook\b|manuscript|\bfolio\b|title page|
\bdocument\b|documents of|\bletter\b|\bcharter\b|newspaper|screenshot|\bposter\b|\bflyer\b|
\bticket\b|\bmenu\b|leaflet|infobox|montage|collage|animation|\bgif\b|unidentified|
scaffolding|construction site|\bcrane\b|building site|renovation work|works in progress"""

def _rx(s):
    return re.compile(s.replace('\n', '').replace(' ', r'\s?').replace('_', '.'), re.I)

RX_INT, RX_DET, RX_EXT, RX_BAD = _rx(INTERIOR), _rx(DETAIL), _rx(EXTERIOR), _rx(BAD)
OK_EXT = ('.jpg', '.jpeg', '.png')

def strip_html(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    s = re.sub(r'&[a-z]+;', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def gather(category, depth=1, cap=420):
    """Walk a Commons category tree collecting file pages with imageinfo."""
    seen_cat, files, queue = set(), {}, [(category, 0)]
    while queue and len(files) < cap:
        cat, d = queue.pop(0)
        if cat in seen_cat:
            continue
        seen_cat.add(cat)
        cont = {}
        for _ in range(2):
            r = api({'action': 'query', 'generator': 'categorymembers',
                     'gcmtitle': f'Category:{cat}', 'gcmtype': 'file', 'gcmlimit': '200',
                     'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', **cont})
            for p in r.get('query', {}).get('pages', []):
                if p['title'] not in files and p.get('imageinfo'):
                    files[p['title']] = p['imageinfo'][0]
            cont = r.get('continue', {})
            if not cont or len(files) >= cap:
                break
        if d < depth:
            r = api({'action': 'query', 'generator': 'categorymembers',
                     'gcmtitle': f'Category:{cat}', 'gcmtype': 'subcat', 'gcmlimit': '60'})
            subs = []
            for p in r.get('query', {}).get('pages', []):
                sub = p['title'].replace('Category:', '')
                if re.search(r'video|audio|sound|book|map|plan|arms|stamp|philatel|'
                             r'author|photograph by|media (needing|requiring)|files by|'
                             r'unidentified|historical|old photo|engraving|drawing|'
                             r'19th.century|18th.century|postcard', sub, re.I):
                    continue
                # the subcategories worth walking are the ones that name a part
                rank = 0 if RX_INT.search(sub) or RX_DET.search(sub) else 1
                subs.append((rank, sub))
            subs.sort()
            for _, sub in subs[:14]:
                queue.append((sub, d + 1))
    return files

def classify(title, meta):
    name = title.replace('File:', '')
    desc = strip_html(meta.get('extmetadata', {}).get('ImageDescription', {}).get('value', ''))[:300]
    hay = f"{name} {desc}"
    if RX_BAD.search(hay):
        return None, 0, hay
    w, h = meta.get('width', 0), meta.get('height', 0)
    if min(w, h) < 900 or w * h < 1_500_000:
        return None, 0, hay
    em = meta.get('extmetadata', {})
    assess = (em.get('Assessments', {}).get('value', '') or '').lower()
    score = 0
    score += 45 if 'featured' in assess else 0
    score += 30 if 'quality' in assess else 0
    score += 15 if 'valued' in assess else 0
    mp = (w * h) / 1_000_000
    score += min(mp * 1.6, 22)
    if max(w, h) >= 3000:
        score += 6
    ext_hit, int_hit, det_hit = RX_EXT.search(hay), RX_INT.search(hay), RX_DET.search(hay)
    # interior and detail cues beat the generic exterior words they often contain
    if int_hit and not (det_hit and not RX_INT.search(name)):
        kind = 'interior'
    elif det_hit:
        kind = 'detail'
    elif ext_hit:
        kind = 'exterior'
    else:
        kind, score = 'exterior', score - 8   # unlabelled shots are usually plain exteriors
    if h > w * 1.25:
        score += 3 if kind != 'exterior' else 1     # portrait suits naves and towers
    lic = (em.get('LicenseShortName', {}).get('value', '') or '')
    if re.search(r'ND|NoDeriv|non.?commercial|\bNC\b|Fair use', lic, re.I):
        return None, 0, hay
    return kind, round(score, 1), hay

def survey(candidates, path):
    out = {}
    if os.path.exists(path):                      # resume a partial run
        out = json.load(open(path))
        print(f"resuming — {len(out)} already surveyed", flush=True)
    for key, article in candidates:
        if key in out:
            continue
        cat = commons_category(article)
        if not cat:
            print(f"{key:28s} NO CATEGORY ({article})", flush=True)
            out[key] = {'article': article, 'category': None, 'images': []}
            continue
        raw_path = os.path.join(HERE, 'raw', f'{key}.json')
        if os.path.exists(raw_path):
            files = json.load(open(raw_path))          # reclassify without re-crawling
        else:
            files = gather(cat)
            json.dump(files, open(raw_path, 'w'))
        pool = []
        for title, meta in files.items():
            if not title.lower().endswith(OK_EXT):
                continue
            kind, score, hay = classify(title, meta)
            if not kind:
                continue
            em = meta.get('extmetadata', {})
            pool.append({
                'title': title, 'kind': kind, 'score': score,
                'url': meta['url'], 'w': meta['width'], 'h': meta['height'],
                'desc': strip_html(em.get('ImageDescription', {}).get('value', ''))[:400],
                'artist': strip_html(em.get('Artist', {}).get('value', ''))[:140],
                'license': em.get('LicenseShortName', {}).get('value', ''),
                'licurl': em.get('LicenseUrl', {}).get('value', ''),
                'assess': em.get('Assessments', {}).get('value', ''),
                'page': f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
            })
        pool.sort(key=lambda x: -x['score'])
        c = {k: sum(1 for p in pool if p['kind'] == k) for k in ('exterior', 'interior', 'detail')}
        feat = sum(1 for p in pool if 'featured' in (p['assess'] or '').lower())
        qual = sum(1 for p in pool if 'quality' in (p['assess'] or '').lower())
        print(f"{key:28s} scanned {len(files):4d}  usable {len(pool):4d}  "
              f"ext {c['exterior']:3d} int {c['interior']:3d} det {c['detail']:3d}  "
              f"FP {feat:2d} QI {qual:3d}", flush=True)
        out[key] = {'article': article, 'category': cat, 'counts': c,
                    'featured': feat, 'quality': qual, 'images': pool[:90]}
        json.dump(out, open(path, 'w'), indent=1)      # checkpoint every building
    return out

if __name__ == '__main__':
    cands = json.load(open(os.path.join(HERE, 'candidates.json')))
    path = os.path.join(HERE, 'survey.json')
    survey([(c['id'], c['article']) for c in cands], path)
    print("\nwrote tools/survey.json", flush=True)
