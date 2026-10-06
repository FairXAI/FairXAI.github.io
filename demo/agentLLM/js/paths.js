// Demo 0 · Optimisation paths. A toy written for this page, not a result from the project.
// Four quadratic "tasks" in a 2-D parameter space, trained with noisy gradient descent.
// A path's gradient noise shrinks with the share of data it sees: sharing helps transfer, conflict hurts.
(() => {
	const root = document.getElementById('paths');
	if (!root) return;
	const canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
	const C = { paper: '#f3f6fa', deep: '#e6edf5', ink: '#0b1c30', soft: '#52637a', navy: '#123a66', sea: '#2a6fb0', light: '#7fb3dc', rust: '#b4532a' };

	const tasks = [
		{ name: 'Arithmetic', m: [0.25, 0.30], a: [1.0, 0.6], color: C.light, lab: ['right', -10, 16] },
		{ name: 'Algebra', m: [0.30, 0.27], a: [0.7, 1.0], color: C.sea, lab: ['left', 10, 16] },
		{ name: 'Translation', m: [0.74, 0.70], a: [1.0, 0.7], color: C.navy, lab: ['left', 10, 16] },
		{ name: 'Summarising', m: [0.69, 0.74], a: [0.6, 1.0], color: C.ink, lab: ['right', -10, -10] },
	];
	const ETA = 0.06, NOISE = 0.35, START = [0.5, 0.12], TRAIL = 140;
	// Two tasks conflict when their gradients point apart (cos < 0) and both are large enough to matter;
	// near a joint optimum every pair of gradients opposes, but both are tiny.
	const STRONG = 0.08;
	const conflict = (u, v) => cos(u, v) < 0 && Math.hypot(...u) > STRONG && Math.hypot(...v) > STRONG;

	const grad = (i, th) => [tasks[i].a[0] * (th[0] - tasks[i].m[0]), tasks[i].a[1] * (th[1] - tasks[i].m[1])];
	const loss = (i, th) => 0.5 * (tasks[i].a[0] * (th[0] - tasks[i].m[0]) ** 2 + tasks[i].a[1] * (th[1] - tasks[i].m[1]) ** 2);
	const cos = (u, v) => (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) + 1e-9);

	// Seeded Gaussian noise so every replay is the same run.
	let seed = 1;
	const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

	// Data-driven grouping: warm up one shared policy, measure task-gradient cosines there,
	// and join tasks whose gradients agree (connected components of cos > 0).
	function cosMatrix(th) { const g = tasks.map((_, i) => grad(i, th)); return g.map((u) => g.map((v) => cos(u, v))); }
	function groupsFrom(M) {
		const seen = new Set(), out = [];
		tasks.forEach((_, i) => {
			if (seen.has(i)) return;
			const group = [], stack = [i]; seen.add(i);
			while (stack.length) { const j = stack.pop(); group.push(j); tasks.forEach((_, k) => { if (!seen.has(k) && M[j][k] > 0) { seen.add(k); stack.push(k); } }); }
			out.push(group.sort());
		});
		return out;
	}
	let warm = [...START];
	for (let t = 0; t < 120; t++) { const g = [0, 1, 2, 3].map((i) => grad(i, warm)); warm = warm.map((x, d) => x - ETA * g.reduce((s, v) => s + v[d], 0) / 4); }
	const warmCos = cosMatrix(warm), learned = groupsFrom(warmCos);

	const modes = {
		shared: { label: 'One shared policy', paths: [[0, 1, 2, 3]],
			text: 'Every task updates the same parameters. Near the middle the tasks pull in opposite directions (orange arrows), so the policy settles on a compromise that suits none of them.' },
		task: { label: 'One path per task', paths: [[0], [1], [2], [3]],
			text: 'No interference, but each path sees only a quarter of the data. Gradients are noisier and nothing learned by one task is shared with a related one.' },
		grouped: { label: 'Grouped by gradient similarity', paths: learned,
			text: 'The cosine matrix, measured on a briefly warmed-up shared policy, sends tasks that agree to the same path. Related tasks share data and the conflicting ones are kept apart.' },
	};
	let mode = 'grouped', state;

	function reset() {
		seed = 7;
		state = { step: 0, ema: null, paths: modes[mode].paths.map((ts) => ({ ts, th: [...START], trail: [] })) };
	}
	function step() {
		let total = 0;
		for (const p of state.paths) {
			const sigma = NOISE / Math.sqrt(p.ts.length);
			const g = [0, 0];
			for (const i of p.ts) grad(i, p.th).forEach((v, d) => (g[d] += v / p.ts.length));
			p.th = p.th.map((x, d) => x - ETA * (g[d] + sigma * gauss()));
			p.trail.push([...p.th]); if (p.trail.length > TRAIL) p.trail.shift();
			for (const i of p.ts) total += loss(i, p.th);
		}
		const avg = total / tasks.length * 1000;
		state.ema = state.ema == null ? avg : state.ema * 0.97 + avg * 0.03;
		state.step++;
	}

	// Drawing
	let W = 0, H = 0;
	const X = (x) => 18 + x * (W - 36), Y = (y) => H - 18 - y * (H - 36);
	function resize() {
		const dpr = Math.min(devicePixelRatio || 1, 2);
		W = canvas.clientWidth; H = Math.round(W * 0.72);
		canvas.style.height = H + 'px'; canvas.width = W * dpr; canvas.height = H * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	function arrow(x0, y0, dx, dy, color, width) {
		const x1 = x0 + dx, y1 = y0 + dy, a = Math.atan2(dy, dx);
		ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = width;
		ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 8 * Math.cos(a - 0.45), y1 - 8 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 8 * Math.cos(a + 0.45), y1 - 8 * Math.sin(a + 0.45)); ctx.fill();
	}
	function draw() {
		ctx.clearRect(0, 0, W, H);
		const s = W - 36;
		// Loss contours of each task
		tasks.forEach((t) => {
			ctx.strokeStyle = t.color; ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
			[0.002, 0.007, 0.016].forEach((c) => {
				ctx.beginPath(); ctx.ellipse(X(t.m[0]), Y(t.m[1]), Math.sqrt(2 * c / t.a[0]) * s, Math.sqrt(2 * c / t.a[1]) * (H - 36), 0, 0, 2 * Math.PI); ctx.stroke();
			});
			ctx.globalAlpha = 1;
		});
		// Task optima and names
		ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
		tasks.forEach((t, i) => {
			const x = X(t.m[0]), y = Y(t.m[1]);
			ctx.fillStyle = t.color; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
			ctx.fillStyle = C.ink; ctx.textAlign = t.lab[0];
			ctx.fillText(t.name, x + t.lab[1], y + t.lab[2]);
		});
		ctx.textAlign = 'left';
		// Start point
		ctx.strokeStyle = C.soft; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X(START[0]), Y(START[1]), 5, 0, 2 * Math.PI); ctx.stroke();
		ctx.fillStyle = C.soft; ctx.fillText('init', X(START[0]) + 9, Y(START[1]) + 4);
		// Paths: trail and current point
		state.paths.forEach((p) => {
			const color = p.ts.length === 4 ? C.ink : tasks[p.ts[0]].color;
			ctx.strokeStyle = color; ctx.lineWidth = 1.5;
			p.trail.forEach((q, k) => {
				if (!k) return;
				ctx.globalAlpha = 0.08 + 0.5 * k / p.trail.length;
				ctx.beginPath(); ctx.moveTo(X(p.trail[k - 1][0]), Y(p.trail[k - 1][1])); ctx.lineTo(X(q[0]), Y(q[1])); ctx.stroke();
			});
			ctx.globalAlpha = 1;
			ctx.fillStyle = color; ctx.strokeStyle = C.paper; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.arc(X(p.th[0]), Y(p.th[1]), 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
			// On a shared path, show where each task wants to go; orange when it opposes another task on the same path.
			if (p.ts.length > 1) {
				const g = p.ts.map((i) => grad(i, p.th));
				p.ts.forEach((i, a) => {
					const v = g[a], n = Math.hypot(...v);
					if (n < STRONG) return; // this task is already close to satisfied here
					const hit = p.ts.some((_, b) => b !== a && conflict(v, g[b]));
					arrow(X(p.th[0]), Y(p.th[1]), -v[0] / n * 46, v[1] / n * 46, hit ? C.rust : tasks[i].color, hit ? 2 : 1.5);
				});
			}
		});
	}

	// Side panel: cosine matrix, tiles, tabs
	const tabs = root.querySelector('.tabs'), text = root.querySelector('.mode-text'), matrix = root.querySelector('.cos');
	const tile = (k) => root.querySelector(`[data-tile="${k}"]`);
	matrix.innerHTML = '<span></span>' + tasks.map((t) => `<b>${t.name.slice(0, 3)}</b>`).join('') +
		warmCos.map((row, i) => `<b>${tasks[i].name.slice(0, 3)}</b>` + row.map((v, j) => `<span class="${v < 0 ? 'neg' : ''} ${learned.some((g) => g.includes(i) && g.includes(j)) ? 'same' : ''}"style="--v:${Math.abs(v).toFixed(2)}">${v.toFixed(2)}</span>`).join('')).join('');
	Object.entries(modes).forEach(([k, m]) => {
		const b = document.createElement('button'); b.textContent = m.label; b.dataset.mode = k;
		b.onclick = () => { mode = k; reset(); sync(); if (still) settle(); };
		tabs.append(b);
	});
	root.querySelector('.replay').onclick = () => { reset(); if (still) settle(); };
	function sync() {
		tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === mode));
		text.textContent = modes[mode].text;
		const paths = modes[mode].paths;
		tile('paths').textContent = paths.length;
		tile('data').textContent = paths.map((ts) => `${ts.length}/4`).join(' · ');
		root.classList.toggle('show-groups', mode === 'grouped');
	}
	function stats() {
		let conflicts = 0;
		state.paths.forEach((p) => { const g = p.ts.map((i) => grad(i, p.th)); g.forEach((u, a) => g.forEach((v, b) => { if (a < b && conflict(u, v)) conflicts++; })); });
		tile('loss').textContent = state.ema == null ? '–' : state.ema.toFixed(1);
		tile('conflict').textContent = conflicts;
	}

	// Run only while on screen; settle instantly for reduced motion.
	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	let visible = false;
	function settle() { for (let t = 0; t < 400; t++) step(); draw(); stats(); }
	function frame() { if (visible && !still) { step(); step(); draw(); if (state.step % 6 < 2) stats(); } requestAnimationFrame(frame); }
	new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
	addEventListener('resize', () => { resize(); draw(); });
	resize(); reset(); sync(); draw();
	if (still) settle(); else requestAnimationFrame(frame);
})();
