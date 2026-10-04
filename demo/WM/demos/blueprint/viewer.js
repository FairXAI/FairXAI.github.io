// Demo 1 page logic (blueprint.html). Data comes from world.js and stats.js, written by blueprint-demo/tools/build_demo.py.
'use strict';
const W = window.MC_WORLD, S = window.MC_STATS;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pretty = (uid) => uid.replace(/^(\w)(\w*)_(\d+)$/, (_, a, b, n) => a.toUpperCase() + b + ' ' + n);

// ---- Spec and blueprint ----
$('game-name').textContent = `${W.game}: ${W.rooms.length} rooms in a line and ${W.mechanisms.length} mechanisms`;
// $('spec-file').textContent = W.game + '.yaml';
// $('spec').textContent = W.spec;
// $('plan-file').textContent = W.game;
// $('plan').textContent = W.ascii.split('\n').filter((l) => !l.startsWith('legend:')).join('\n').replace(/\s+$/, '');
$('bp-file').textContent = W.game;
$('bp').innerHTML = W.blueprint;

// ---- Shared tooltip for the charts ----
document.addEventListener('pointermove', (e) => {
	const t = e.target.closest && e.target.closest('[data-tip]');
	if (!t) return void ($('tip').hidden = true);
	$('tip').innerHTML = t.dataset.tip;
	$('tip').hidden = false;
	const r = $('tip').getBoundingClientRect();
	$('tip').style.left = Math.min(e.clientX + 14, innerWidth - r.width - 8) + 'px';
	$('tip').style.top = Math.max(8, e.clientY - r.height - 10) + 'px';
});

// ---- Statistics ----
(function stats() {
	const G = S.games, n = G.length, sum = (f) => G.reduce((a, g) => a + f(g), 0);
	const triggers = sum((g) => g.triggers), remote = sum((g) => g.remote_triggers);
	$('tiles').innerHTML = [
		[n, `games in ${S.shapes.length} layout shapes, ${S.room_counts[0]} to ${S.room_counts.at(-1)} rooms`],
		[sum((g) => g.mechs).toLocaleString(), `mechanisms: ${sum((g) => g.doors).toLocaleString()} doors and ${sum((g) => g.boxes)} boxes`],
		[Math.round((100 * remote) / triggers) + '%', 'of lever, button and tripwire doors are opened from a different room'],
		[sum((g) => g.decoy), 'games hand out a decoy key that opens nothing'],
		[`${S.baked.filter((b) => b.solvable).length}/${S.n_baked}`, 'baked worlds marked solvable by their stored answer'],
	].map(([v, t]) => `<div><strong>${v}</strong><span>${t}</span></div>`).join('');

	const TYPES = [
		['Doors', [['keydoor', 'Key in a keyhole'], ['tripwiredoor', 'Walk across a tripwire'], ['leverdoor', 'Pull a lever'], ['buttondoor', 'Press a button']]],
		['Boxes', [['craftbox', 'Craft an item and deposit it'], ['keybox', 'Deposit a key'], ['breakbox', 'Break a glass block to unlock']]],
	];
	const tmax = Math.max(...Object.values(S.type_totals));
	$('types').innerHTML = TYPES.map(([group, rows]) => `<div class="group">${group}</div>` + rows.map(([k, label]) => {
		const v = S.type_totals[k] || 0;
		return `<span>${label}</span><div class="track" data-tip="<b>${label}</b><br>${v} across ${n} games (<span class=mono>${k}</span>)"><div class="bar" style="width:${(85 * v) / tmax}%"></div><span class="val">${v}</span></div>`;
	}).join('')).join('');

	// Heatmap: mean longest chain by shape x rooms. Sequential blue, light = short, dark = long.
	const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
	const cells = {}, rooms = S.room_counts;
	G.forEach((g) => (cells[g.shape + g.rooms] ||= []).push(g.depth));
	const means = Object.values(cells).map((a) => a.reduce((x, y) => x + y) / a.length);
	const lo = Math.min(...means), hi = Math.max(...means);
	let html = '<span></span>' + rooms.map((r) => `<span class="h">${r}</span>`).join('');
	for (const shape of S.shapes) {
		html += `<span class="r">${shape}</span>`;
		for (const r of rooms) {
			const a = cells[shape + r];
			if (!a) { html += `<span class="c none" data-tip="No ${shape} layout with ${r} rooms"></span>`; continue; }
			const m = a.reduce((x, y) => x + y) / a.length, i = Math.round(((m - lo) / (hi - lo)) * (RAMP.length - 1));
			html += `<span class="c" style="background:${RAMP[i]};color:${i >= 3 ? '#fff' : 'var(--ink)'}" data-tip="<b>${shape}, ${r} rooms</b><br>mean chain ${m.toFixed(1)}, range ${Math.min(...a)}–${Math.max(...a)} (${a.length} games)">${m.toFixed(1)}</span>`;
		}
	}
	$('heat').innerHTML = html + '<span></span><span class="h" style="grid-column:2 / -1">rooms</span>';
	$('ramp').style.background = `linear-gradient(90deg, ${RAMP.join(',')})`;
	$('ramp-lo').textContent = lo.toFixed(1);
	$('ramp-hi').textContent = hi.toFixed(1) + ' mechanisms in a row';

	// Mechanisms-per-game and baked-worlds charts are commented out in the HTML for now.
	if ($('mechs')) {
	const hist = {};
	G.forEach((g) => (hist[g.mechs] = (hist[g.mechs] || 0) + 1));
	const ks = Object.keys(hist).map(Number).sort((a, b) => a - b), hmax = Math.max(...Object.values(hist));
	$('mechs').innerHTML = ks.map((k) => {
		const h = (88 * hist[k]) / hmax;
		return `<div data-tip="<b>${k} mechanisms</b><br>${hist[k]} games"><span class="val" style="bottom:${h}%">${hist[k]}</span><span class="bar" style="height:${h}%"></span></div>`;
	}).join('');
	$('mechs-axis').innerHTML = ks.map((k) => `<span>${k}</span>`).join('');
	}

	if ($('baked')) $('baked').innerHTML = '<thead><tr><th>Game</th><th>Rooms</th><th>Mech.</th><th>Steps</th><th>Commands</th><th>Solvable</th></tr></thead><tbody>' +
		[...S.baked].sort((a, b) => a.rooms - b.rooms || a.name.localeCompare(b.name)).map((b) =>
			`<tr class="${b.name === W.game ? 'current' : ''}"><td class="mono">${b.name}</td><td>${b.rooms}</td><td>${b.mechs}</td><td>${b.steps}</td><td>${b.commands}</td><td>${b.solvable ? 'Yes' : 'No'}</td></tr>`).join('') + '</tbody>';
})();

// ---- Minecraft viewer ----
(async function viewer() {
	const T = THREE, el = $('viewer');
	const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
	const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return c; };
	const texture = (c) => { const t = new T.CanvasTexture(c); t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.encoding = T.sRGBEncoding; return t; };

	// Block textures: 16x16, first frame of animated strips; the chest is cut from its entity texture.
	const TEX = {}, imgs = {};
	await Promise.all(Object.entries(W.textures).map(async ([k, src]) => (imgs[k] = await load(src))));
	for (const [k, img] of Object.entries(imgs)) if (k.startsWith('block/')) TEX[k.slice(6)] = texture(canvas(16, 16, (g) => g.drawImage(img, 0, 0, 16, 16, 0, 0, 16, 16)));
	const chest = imgs['entity/chest/normal'];
	TEX.chest_top = texture(canvas(14, 14, (g) => g.drawImage(chest, 14, 0, 14, 14, 0, 0, 14, 14)));
	TEX.chest_side = texture(canvas(14, 15, (g) => { g.drawImage(chest, 0, 14, 14, 5, 0, 0, 14, 5); g.drawImage(chest, 0, 33, 14, 10, 0, 5, 14, 10); }));
	TEX.chest_front = texture(canvas(14, 15, (g) => { g.drawImage(chest, 14, 14, 14, 5, 0, 0, 14, 5); g.drawImage(chest, 14, 33, 14, 10, 0, 5, 14, 10); g.drawImage(chest, 1, 1, 2, 4, 6, 3, 2, 4); }));

	// Faces: +x, -x, +y, -y, +z, -z, corners counter-clockwise from outside; Minecraft-style fixed shading per direction.
	const FACES = [
		{ d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.6 },
		{ d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.6 },
		{ d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
		{ d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5 },
		{ d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.8 },
		{ d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.8 },
	];
	const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
	const FACING = { east: 0, west: 1, up: 2, down: 3, south: 4, north: 5 };
	const parse = (name) => {
		const m = name.match(/^minecraft:([^[]+)(?:\[(.*)\])?$/);
		return { id: m[1], p: Object.fromEntries((m[2] || '').split(',').filter(Boolean).map((s) => s.split('='))) };
	};
	const CUTOUT = new Set(['glass', 'copper_grate']);
	const cubeTex = (id) => id === 'crafting_table' ? ['crafting_table_side', 'crafting_table_side', 'crafting_table_top', 'oak_planks', 'crafting_table_front', 'crafting_table_side']
		: TEX[id] && !/tripwire|lever|amethyst|iron_bars|button/.test(id) ? Array(6).fill(id) : null;

	const pal = W.palette.map(parse), at = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
	W.blocks.forEach(([x, y, z, i]) => at.set(key(x, y, z), pal[i]));
	const solid = (b) => b && cubeTex(b.id) && !CUTOUT.has(b.id) && b.id !== 'sea_lantern';

	// Full cubes, merged into one geometry per (texture, layer), hidden faces dropped.
	// Ceilings never hide a face, so they can be switched off without leaving holes.
	const buckets = {}, specials = [];
	const quad = (bk, corners, shade) => {
		const B = (buckets[bk] ||= { pos: [], uv: [], col: [], idx: [] }), base = B.pos.length / 3;
		corners.forEach((c, k) => { B.pos.push(...c); B.uv.push(...UV[k]); B.col.push(shade, shade, shade); });
		B.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
	};
	for (const [x, y, z, i] of W.blocks) {
		const b = pal[i], tex = cubeTex(b.id);
		if (!tex) { specials.push([x, y, z, b]); continue; }
		const layer = b.id === 'sea_lantern' ? 'ceiling' : CUTOUT.has(b.id) ? 'cutout' : 'solid';
		FACES.forEach((f, fi) => {
			const n = at.get(key(x + f.d[0], y + f.d[1], z + f.d[2]));
			if (solid(n) || (n && n.id === b.id && layer !== 'solid')) return;
			quad(tex[fi] + '|' + layer, f.c.map(([a, bb, c]) => [x + a, y + bb, z + c]), f.s);
		});
	}

	const scene = new T.Scene(), ceiling = new T.Group();
	scene.add(ceiling);
	ceiling.visible = false;
	for (const [bk, B] of Object.entries(buckets)) {
		const [t, layer] = bk.split('|'), g = new T.BufferGeometry();
		g.setAttribute('position', new T.Float32BufferAttribute(B.pos, 3));
		g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
		g.setAttribute('color', new T.Float32BufferAttribute(B.col, 3));
		g.setIndex(B.idx);
		const m = new T.MeshBasicMaterial({ map: TEX[t], vertexColors: true, alphaTest: layer === 'cutout' ? 0.1 : 0, transparent: t === 'glass', side: layer === 'cutout' ? T.DoubleSide : T.FrontSide });
		(layer === 'ceiling' ? ceiling : scene).add(new T.Mesh(g, m));
	}

	// Small non-cube blocks: boxes and crossed planes in block-local units (0..1).
	// texs holds one texture name (or a plain colour) per face; uv crops the texture.
	const box = (x0, y0, z0, x1, y1, z1, texs, uv = [0, 0, 1, 1]) => {
		const g = new T.BufferGeometry(), pos = [], uvs = [], col = [], idx = [], mats = [];
		FACES.forEach((f, fi) => {
			const base = pos.length / 3;
			f.c.forEach(([a, b, c], k) => {
				pos.push(a ? x1 : x0, b ? y1 : y0, c ? z1 : z0);
				uvs.push(uv[0] + UV[k][0] * (uv[2] - uv[0]), uv[1] + UV[k][1] * (uv[3] - uv[1]));
				col.push(f.s, f.s, f.s);
			});
			g.addGroup(idx.length, 6, fi);
			idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
			const t = TEX[texs[fi]];
			mats.push(new T.MeshBasicMaterial({ map: t || null, color: t ? 0xffffff : texs[fi], vertexColors: true, alphaTest: 0.1, side: T.DoubleSide }));
		});
		g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
		g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
		g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
		g.setIndex(idx);
		return new T.Mesh(g, mats);
	};
	const cross = (t) => {
		const g = new T.Group();
		for (const r of [Math.PI / 4, -Math.PI / 4]) {
			const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: TEX[t], alphaTest: 0.1, side: T.DoubleSide }));
			m.rotation.y = r; m.position.set(0.5, 0.5, 0.5); g.add(m);
		}
		return g;
	};
	const px = (v) => v / 16;
	for (const [x, y, z, b] of specials) {
		let o;
		if (b.id === 'chest') {
			const t = Array(6).fill('chest_side'); t[2] = t[3] = 'chest_top'; t[FACING[b.p.facing] ?? 4] = 'chest_front';
			o = box(px(1), 0, px(1), px(15), px(14), px(15), t);
		} else if (b.id === 'lever') {
			o = new T.Group();
			o.add(box(px(5), 0, px(4), px(11), px(3), px(12), Array(6).fill('cobblestone')));
			const h = box(-px(1), 0, -px(1), px(1), px(10), px(1), Array(6).fill('lever'), [7 / 16, 0, 9 / 16, 10 / 16]);
			h.position.set(0.5, px(2), 0.5);
			h.rotation[/north|south/.test(b.p.facing) ? 'x' : 'z'] = (b.p.powered === 'true' ? -1 : 1) * (Math.PI / 4) * (/north|west/.test(b.p.facing) ? -1 : 1);
			o.add(h);
		} else if (b.id === 'tripwire') {
			const ew = b.p.east === 'true' || b.p.west === 'true', white = Array(6).fill(0xdedede);
			o = ew ? box(0, px(1), px(7.5), 1, px(1.5), px(8.5), white) : box(px(7.5), px(1), 0, px(8.5), px(1.5), 1, white);
		} else if (b.id === 'tripwire_hook') {
			const back = { 0: [0, 0.5], 1: [1, 0.5], 4: [0.5, 0], 5: [0.5, 1] }[FACING[b.p.facing]] || [0.5, 0.5];
			o = new T.Group();
			const post = box(-px(1), 0, -px(1), px(1), px(8), px(1), Array(6).fill('oak_planks'));
			post.position.set(back[0] * 0.9 + 0.05, px(1), back[1] * 0.9 + 0.05);
			o.add(post, box(px(6), 0, px(6), px(10), px(3), px(10), Array(6).fill('tripwire_hook')));
		} else if (/amethyst/.test(b.id) && TEX[b.id]) {
			o = cross(b.id);
		} else if (b.id === 'stone_button') {
			o = box(px(5), 0, px(6), px(11), px(2), px(10), Array(6).fill('stone'));
		} else {
			o = box(px(2), px(2), px(2), px(14), px(14), px(14), Array(6).fill(0xcc44aa));
			console.warn('No model for', b.id);
		}
		o.position.x += x; o.position.y += y; o.position.z += z;
		scene.add(o);
	}

	// Camera: orthographic, looking down from the south-east like an isometric diorama.
	const lo = [0, 1, 2].map((i) => Math.min(...W.rooms.map((r) => r.imin[i])) - 1);
	const hi = [0, 1, 2].map((i) => Math.max(...W.rooms.map((r) => r.imax[i])) + 2);
	const center = new T.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
	const span = Math.max(hi[0] - lo[0], hi[2] - lo[2]);
	const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
	renderer.outputEncoding = T.sRGBEncoding;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	el.prepend(renderer.domElement);
	const camera = new T.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
	const controls = new T.OrbitControls(camera, renderer.domElement);
	controls.enableZoom = false; // keeps the page scrolling under the wheel; zoom is on the buttons
	controls.maxPolarAngle = Math.PI / 2.05;
	// The frustum is sized from the world's bounding box as seen from the current direction, so the whole world fits.
	let half = 10;
	const fit = () => {
		const w = el.clientWidth, h = el.clientHeight;
		camera.updateMatrixWorld();
		const inv = camera.matrixWorldInverse, c = center.clone().applyMatrix4(inv), v = new T.Vector3();
		let mx = 0, my = 0;
		for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
			v.set(x, y, z).applyMatrix4(inv);
			mx = Math.max(mx, Math.abs(v.x - c.x)); my = Math.max(my, Math.abs(v.y - c.y));
		}
		half = Math.max(my, (mx * h) / w) * 1.08;
		renderer.setSize(w, h, false);
		Object.assign(camera, { left: (-half * w) / h, right: (half * w) / h, top: half, bottom: -half });
		camera.updateProjectionMatrix();
		controls.update();
		render();
	};
	const home = () => {
		controls.target.copy(center);
		camera.position.copy(center).add(new T.Vector3(0.4, 1.6, 0.9).normalize().multiplyScalar(span * 2));
		camera.lookAt(center);
		camera.zoom = 1;
		fit();
	};

	// Labels: one pin per mechanism part, tied to the uid that a solution step names.
	const pins = [];
	const pin = (p, text, uid, cls = '') => {
		const d = document.createElement('div');
		d.className = 'pin ' + cls; d.textContent = text;
		$('pins').append(d);
		pins.push({ d, v: new T.Vector3(p[0] + 0.5, p[1] + (cls === 'room' ? 0.05 : 1.2), p[2] + 0.5), uid });
		return pins.at(-1);
	};
	W.rooms.forEach((r) => pin([(r.imin[0] + r.imax[0]) / 2 - 0.5, r.imin[1] - 1, (r.imin[2] + r.imax[2]) / 2 - 0.5], 'Room ' + r.idx, null, 'room'));
	pin(W.spawn.map((v, i) => (i === 1 ? v - 1 : v)), 'Start', 'spawn');
	const KIND = { leverdoor: 'Lever', buttondoor: 'Button', tripwiredoor: 'Tripwire' };
	for (const m of W.mechanisms) {
		const D = pretty(m.uid), K = m.key ? pretty(m.key) : '';
		if (KIND[m.type]) pin(m.trigger_pos, `${KIND[m.type]} → ${D}`, m.uid, 'mech');
		if (m.type === 'keydoor') pin(m.keyhole_pos, `${K} → ${D}`, m.uid, 'mech');
		if (m.type === 'craftbox') { pin(m.chest_pos, `${D} · craft`, m.uid, 'mech'); pin(m.supply_pos, `Supplies → ${D}`, m.uid, 'mech'); }
		if (m.type === 'breakbox') { pin(m.chest_pos, `${D} · locked`, m.uid, 'mech'); pin(m.glass_pos, `Glass → ${D}`, m.uid, 'mech'); }
		if (m.type === 'keybox') pin(m.chest_pos, `${D} · ${K}`, m.uid, 'mech');
	}
	for (const [k, p] of Object.entries(W.loot_positions)) pin(p, `${pretty(k)} chest`, k, 'mech');

	// Highlight boxes on the blocks the selected step touches.
	const marks = new T.Group();
	scene.add(marks);
	const markMat = new T.MeshBasicMaterial({ color: 0x2a6fb0, transparent: true, opacity: 0.35, depthTest: false });
	const edgeMat = new T.LineBasicMaterial({ color: 0x123a66, depthTest: false });
	const markGeo = new T.BoxGeometry(1.15, 1.15, 1.15), edgeGeo = new T.EdgesGeometry(markGeo);

	let active = null, anim = 0;
	function render() {
		renderer.render(scene, camera);
		const w = el.clientWidth, h = el.clientHeight, v = new T.Vector3(), placed = [];
		// Pins of the active step go first so they keep their spot; a pin that would overlap
		// one already placed moves up until it is clear.
		const order = [...pins].sort((a, b) => (active && b.uid === active.uid) - (active && a.uid === active.uid));
		for (const p of order) {
			v.copy(p.v).project(camera);
			const x = ((v.x + 1) / 2) * w, pw = p.d.offsetWidth, ph = p.d.offsetHeight, room = p.d.classList.contains('room');
			let y = ((1 - v.y) / 2) * h;
			if (!room && p.d.offsetParent) {
				for (let i = 0; i < 6; i++) {
					const hit = placed.find((r) => Math.abs(r.x - x) < (r.w + pw) / 2 + 2 && Math.abs(r.y - y) < ph + 1);
					if (!hit) break;
					y = hit.y - ph - 2;
				}
				placed.push({ x, y, w: pw });
			}
			p.d.style.left = x + 'px';
			p.d.style.top = y + 'px';
			p.d.classList.toggle('on', !!active && p.uid === active.uid);
			p.d.classList.toggle('dim', !!active && p.uid !== active.uid && !room);
		}
	}
	controls.addEventListener('change', render);
	new ResizeObserver(fit).observe(el);

	const panTo = (target) => {
		const from = controls.target.clone(), t0 = performance.now();
		cancelAnimationFrame(anim);
		const step = (now) => {
			const k = Math.min(1, (now - t0) / 450), e = k * (2 - k);
			const d = new T.Vector3().lerpVectors(from, target, e).sub(controls.target);
			controls.target.add(d); camera.position.add(d);
			controls.update(); render();
			if (k < 1) anim = requestAnimationFrame(step);
		};
		anim = requestAnimationFrame(step);
	};
	const select = (s, btn) => {
		active = active === s ? null : s;
		document.querySelectorAll('#steps button').forEach((b) => b.setAttribute('aria-pressed', String(!!active && b === btn)));
		marks.clear();
		if (!active) return panTo(center);
		const seen = new Set(), pts = active.points.filter((p) => !seen.has(p + '') && seen.add(p + ''));
		for (const p of pts) {
			const m = new T.Mesh(markGeo, markMat), e = new T.LineSegments(edgeGeo, edgeMat);
			m.position.set(p[0] + 0.5, p[1] + 0.5, p[2] + 0.5); e.position.copy(m.position);
			m.renderOrder = e.renderOrder = 10;
			marks.add(m, e);
		}
		const c = pts.reduce((a, p) => a.add(new T.Vector3(p[0] + 0.5, lo[1], p[2] + 0.5)), new T.Vector3()).divideScalar(pts.length || 1);
		panTo(pts.length ? c : center);
	};


	// ---- Solution route: the bot's walk from the start through every step, drawn on the floor ----
	// Walking happens on the floor layer; a door's grate cells become passable once the step that opens it is done.
	const FY = Math.min(...W.rooms.map((r) => r.imin[1]));
	const PASS = /^(lever|tripwire|tripwire_hook|stone_button|\w*amethyst\w*)$/;
	const doorOf = new Map();
	for (const [k, b] of at) {
		const [x, y, z] = k.split(',').map(Number);
		if (b.id !== 'copper_grate' || y !== FY) continue;
		let best = null, bd = Infinity;
		for (const m of W.mechanisms) if (m.door_pos) {
			const d = Math.abs(m.door_pos[0] - x) + Math.abs(m.door_pos[2] - z);
			if (d < bd) { bd = d; best = m.uid; }
		}
		doorOf.set(x + ',' + z, best);
	}
	const walkable = (x, z, open) => {
		const b = at.get(key(x, FY, z));
		if (b && b.id === 'copper_grate') return open.has(doorOf.get(x + ',' + z));
		return at.has(key(x, FY - 1, z)) && (!b || PASS.test(b.id));
	};
	// Shortest walk on the grid (4 directions, a small cost per turn so routes run straight), as a list of cells.
	const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
	const walk = (from, goals, open) => {
		const dist = new Map(), prev = new Map(), heap = [];
		const push = (e) => { heap.push(e); for (let i = heap.length - 1; i > 0;) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
		const pop = () => {
			const top = heap[0], last = heap.pop();
			if (heap.length) {
				heap[0] = last;
				for (let i = 0; ;) {
					let m = i; const l = 2 * i + 1, r = l + 1;
					if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
					if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
					if (m === i) break;
					[heap[i], heap[m]] = [heap[m], heap[i]]; i = m;
				}
			}
			return top;
		};
		for (let d = 0; d < 4; d++) { dist.set(`${from[0]},${from[1]},${d}`, 0); push([0, from[0], from[1], d]); }
		while (heap.length) {
			const [c, x, z, d] = pop(), sk = `${x},${z},${d}`;
			if (c > dist.get(sk)) continue;
			if (goals.has(x + ',' + z)) {
				const cells = [];
				for (let k = sk; k; k = prev.get(k)) { const [a, b] = k.split(',').map(Number); cells.unshift([a, b]); }
				return cells;
			}
			DIRS.forEach(([dx, dz], nd) => {
				const nx = x + dx, nz = z + dz, nk = `${nx},${nz},${nd}`, nc = c + 1 + (nd === d ? 0 : 0.6);
				if (walkable(nx, nz, open) && nc < (dist.get(nk) ?? Infinity)) { dist.set(nk, nc); prev.set(nk, sk); push([nc, nx, nz, nd]); }
			});
		}
		return null;
	};
	// Where the bot stands for a target block: on it if it can, else on a free cell next to it.
	const goalsFor = (p, open) => {
		if (walkable(p[0], p[2], open)) return new Set([p[0] + ',' + p[2]]);
		for (const r of [1, 2]) {
			const g = new Set();
			for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++)
				if (Math.abs(dx) + Math.abs(dz) === r && walkable(p[0] + dx, p[2] + dz, open)) g.add(p[0] + dx + ',' + (p[2] + dz));
			if (g.size) return g;
		}
		return new Set();
	};
	// Plan the whole route once: legs of corner points, and where each step ends.
	const legs = [], stops = [];
	{
		const open = new Set();
		let cur = [Math.floor(W.spawn[0]), Math.floor(W.spawn[2])];
		W.steps.forEach((s, i) => {
			let last = null;
			for (const p of s.points) {
				if (last && p + '' === last) continue;
				last = p + '';
				const cells = walk(cur, goalsFor(p, open), open);
				if (!cells) { console.warn('No walk to', p, 'for step', i + 1); continue; }
				const corners = cells.filter((c, j) => j === 0 || j === cells.length - 1 ||
					(c[0] - cells[j - 1][0]) !== (cells[j + 1][0] - c[0]) || (c[1] - cells[j - 1][1]) !== (cells[j + 1][1] - c[1]));
				for (let j = 1; j < corners.length; j++) legs.push({ a: corners[j - 1], b: corners[j], step: i });
				cur = cells.at(-1);
			}
			if (s.uid && s.uid.startsWith('door_')) open.add(s.uid);
			stops.push({ step: i, at: cur });
		});
	}

	// Drawing: a flat blue ribbon per leg (grown along its length), square caps at the corners, a marker for the bot.
	const routeGroup = new T.Group();
	routeGroup.visible = false;
	scene.add(routeGroup);
	const RW = 0.26, RH = 0.04, RY = FY + 0.06;
	const srgb = (hex) => new T.Color(hex).convertSRGBToLinear(); // the renderer outputs sRGB, so colours are given in linear
	const routeMat = new T.MeshBasicMaterial({ color: srgb(0x2a6fb0), depthTest: false });
	const legGeo = new T.BoxGeometry(1, RH, RW).translate(0.5, 0, 0), capGeo = new T.BoxGeometry(RW, RH, RW);
	const legMeshes = legs.map((l) => {
		const m = new T.Mesh(legGeo, routeMat), dx = l.b[0] - l.a[0], dz = l.b[1] - l.a[1];
		m.position.set(l.a[0] + 0.5, RY, l.a[1] + 0.5);
		m.rotation.y = -Math.atan2(dz, dx);
		m.scale.x = 0.0001; m.renderOrder = 20; m.visible = false;
		const cap = new T.Mesh(capGeo, routeMat);
		cap.position.set(l.b[0] + 0.5, RY, l.b[1] + 0.5); cap.renderOrder = 20; cap.visible = false;
		routeGroup.add(m, cap);
		return { m, cap, len: Math.hypot(dx, dz) };
	});
	const bot = new T.Mesh(new T.SphereGeometry(0.42, 20, 14), new T.MeshBasicMaterial({ color: srgb(0x123a66), depthTest: false }));
	bot.renderOrder = 21;
	routeGroup.add(bot);

	// Timeline: legs at a walking pace, a short pause at the end of every step.
	const SPEED = 16, PAUSE = 0.45;
	const timeline = [];
	{
		let t = 0, li = 0;
		stops.forEach((st) => {
			for (; li < legs.length && legs[li].step === st.step; li++) { timeline.push({ leg: li, t0: t, dur: legMeshes[li].len / SPEED }); t += legMeshes[li].len / SPEED; }
			timeline.push({ stop: st, t0: t, dur: PAUSE }); t += PAUSE;
		});
	}
	const stepButtons = () => [...document.querySelectorAll('#steps button')];
	let routeAnim = 0, stepPins = [];
	const clearRoute = () => {
		cancelAnimationFrame(routeAnim);
		routeGroup.visible = false;
		legMeshes.forEach((l) => { l.m.visible = l.cap.visible = false; l.m.scale.x = 0.0001; });
		for (const p of stepPins) { p.d.remove(); pins.splice(pins.indexOf(p), 1); }
		stepPins = [];
		stepButtons().forEach((b) => b.classList.remove('now', 'done'));
		$('pins').classList.remove('route');
	};
	const playRoute = () => {
		clearRoute();
		if (active) select(active);
		cancelAnimationFrame(anim);
		ceiling.visible = false; $('ceiling').setAttribute('aria-pressed', 'false');
		home();
		routeGroup.visible = true;
		$('pins').classList.add('route');
		const s0 = W.spawn;
		bot.position.set(Math.floor(s0[0]) + 0.5, RY + 0.34, Math.floor(s0[2]) + 0.5);
		const t0 = performance.now(), shown = new Set();
		const frame = (now) => {
			const t = (now - t0) / 1000;
			for (const ev of timeline) {
				if (t < ev.t0) break;
				const k = Math.min(1, (t - ev.t0) / (ev.dur || 1));
				if (ev.leg !== undefined) {
					const L = legMeshes[ev.leg], l = legs[ev.leg];
					L.m.visible = true; L.m.scale.x = Math.max(0.0001, L.len * k);
					if (k === 1) L.cap.visible = true;
					bot.position.set(l.a[0] + 0.5 + (l.b[0] - l.a[0]) * k, RY + 0.34, l.a[1] + 0.5 + (l.b[1] - l.a[1]) * k);
					stepButtons().forEach((b, i) => b.classList.toggle('now', i === l.step));
				} else if (!shown.has(ev.stop.step)) {
					shown.add(ev.stop.step);
					const at_ = ev.stop.at;
					stepPins.push(pin([at_[0], FY - 0.6, at_[1]], String(ev.stop.step + 1), 'step', 'stepno'));
					stepButtons()[ev.stop.step]?.classList.add('done');
				}
			}
			render();
			const end = timeline.at(-1);
			if (t < end.t0 + end.dur) routeAnim = requestAnimationFrame(frame);
			else stepButtons().forEach((b) => b.classList.remove('now'));
		};
		routeAnim = requestAnimationFrame(frame);
	};

	W.steps.forEach((s, i) => {
		const li = document.createElement('li'), b = document.createElement('button');
		b.type = 'button'; b.setAttribute('aria-pressed', 'false');
		b.innerHTML = `<b>${i + 1}</b><span>${esc(s.text.replace(/_(\d+)/g, ' $1'))}</span><code>${esc(s.commands.join('\n'))}</code>`;
		b.onclick = () => select(s, b);
		li.append(b); $('steps').append(li);
	});
	$('steps-note').textContent = `${W.n_commands} bot commands, in world coordinates (x, y, z). The bundle marks this answer as ${W.solvable ? 'solving' : 'not solving'} the world.`;
	$('viewer-caption').textContent = `${W.game} · ${W.blocks.length.toLocaleString()} blocks`;

	const toggle = (id, f) => $(id).addEventListener('click', () => { const on = $(id).getAttribute('aria-pressed') !== 'true'; $(id).setAttribute('aria-pressed', String(on)); f(on); render(); });
	toggle('ceiling', (on) => (ceiling.visible = on));
	toggle('labels', (on) => $('pins').classList.toggle('hide', !on));
	toggle('solution', (on) => (on ? playRoute() : clearRoute()));
	const zoom = (f) => { camera.zoom = Math.min(6, Math.max(0.5, camera.zoom * f)); camera.updateProjectionMatrix(); render(); };
	$('zoom-in').onclick = () => zoom(1.25);
	$('zoom-out').onclick = () => zoom(0.8);
	$('reset').onclick = () => { if (active) select(active); cancelAnimationFrame(anim); home(); };
	home();
})();
