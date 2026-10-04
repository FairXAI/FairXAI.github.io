// RQ2 results of causal.html: tiles, parallel-vs-serial bars, four serial line charts and a table.
// Data: rq2.js (window.RQ2), written by rq2_data.py from causal-game-synthesis/v8/eval/results. Metrics: v8/eval/METRICS.md.
'use strict';
(function rq2() {
	const D = window.RQ2, $ = (id) => document.getElementById(id);
	const SLOT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']; // categorical slots 1-4 of v8/eval/plot.py, fixed order by model
	const color = (name) => SLOT[D.models.indexOf(name)];
	const pct = (k, n) => Math.round((100 * k) / n);
	const frac = (k, n) => `${k}/${n} = ${pct(k, n)}%`;
	const ser = Object.fromEntries(D.serial.map((s) => [s.name, s]));
	const par = Object.fromEntries(D.parallel.map((p) => [p.name, p]));

	// ---- Tiles: the headline numbers ----
	const lead = 'gpt-6-luna', also = 'deepseek-v4-flash', o = (x) => x.overall;
	const sCR = (n) => pct(o(ser[n]).correct, o(ser[n]).requests), sVR = (n) => pct(o(ser[n]).violating, o(ser[n]).requests);
	const pCR = (n) => pct(o(par[n]).correct, o(par[n]).requests), pVR = (n) => pct(o(par[n]).violating, o(par[n]).requests);
	const at = (n, key, k) => { const v = ser[n].rounds[key][k - 1]; return pct(v[0], v[1]); };
	const RR = (n) => pct(...o(ser[n]).kept), last = D.serial[0].rounds.correct.length;
	const clean = D.serial.map((s) => [s.name, o(s).clean_scenes]).sort((a, b) => b[1] - a[1]);
	$('rq2-tiles').innerHTML = [
		[`${pCR(lead)}% → ${sCR(lead)}%`, `of ${lead}'s requests are correct, parallel → serial; ${also} ${pCR(also)}% → ${sCR(also)}%`],
		[`${pVR(lead)}% → ${sVR(lead)}%`, `of its requests break a round-1 rule, parallel → serial; ${also} ${pVR(also)}% → ${sVR(also)}%`],
		[`${at(lead, 'correct', 1)}% → ${at(lead, 'correct', last)}%`, `of its scenes correct in serial, round 1 → round ${last}; ${also} ${at(also, 'correct', 1)}% → ${at(also, 'correct', last)}%`],
		[`${RR(lead)}% · ${RR(also)}%`, `of earlier features still work for ${lead} and ${also}: they lose rules, not features`],
		[`${clean[0][1]}/${o(ser[clean[0][0]]).scenes}`, `scenes correct through all ${last} rounds, at best (${clean[0][0]}; ` + clean.slice(1).map(([n, c]) => `${n} ${c}`).join(', ') + ')'],
	].map(([v, t]) => `<div><strong>${v}</strong><span>${t}</span></div>`).join('');

	// ---- Parallel vs serial: one pair of bars per model, 0-100% ----
	function bars(id, key, label) {
		const row = (cls, setting, run) => {
			if (!run) return `<div><span class="none">no ${setting} run yet</span></div>`;
			const r = run.overall, v = pct(r[key], r.requests);
			return `<div data-tip="<b>${run.name}, ${setting}</b><br>${label}: ${frac(r[key], r.requests)}<br>not judged: ${r.not_judged}"><span class="fill ${cls}" style="width:${0.85 * v}%"></span><span class="val">${v}%</span></div>`;
		};
		$(id).innerHTML = D.models.map((n) => `<span>${n}</span><div class="track">${row('par', 'parallel', par[n])}${row('ser', 'serial', ser[n])}</div>`).join('');
	}
	bars('rq2-cr', 'correct', 'correct');
	bars('rq2-vr', 'violating', 'rule broken');

	// ---- Serial line charts: one line per model, y from 0 to 100% (VR: to the next 20 above its top) ----
	$('rq2-keys').innerHTML = D.models.map((n) => `<span><i class="line" style="border-color:${color(n)}"></i>${n}</span>`).join('');
	const W = 520, H = 250, L = 40, R = 150, T = 10, B = 34;
	const xOf = (k) => L + ((k - 1) / (last - 1)) * (W - L - R);
	function lines(key) {
		const share = (v) => (v && v[1] ? v[0] / v[1] : null);
		const top = Math.min(100, Math.ceil((100 * Math.max(...D.serial.flatMap((s) => s.rounds[key].map((v) => share(v) || 0)))) / 20) * 20);
		const yOf = (p) => T + (1 - (100 * p) / top) * (H - T - B);
		let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
		for (let t = 0; t <= top; t += 20) svg += `<line class="${t ? 'grid' : 'base'}" x1="${L}" x2="${W - R}" y1="${yOf(t / 100)}" y2="${yOf(t / 100)}"/><text class="tick" x="${L - 8}" y="${yOf(t / 100) + 4}" text-anchor="end">${t}%</text>`;
		for (let k = 1; k <= last; k++) svg += `<text class="tick" x="${xOf(k)}" y="${H - B + 17}" text-anchor="middle">${k}</text>`;
		svg += `<text class="tick" x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle">Round</text>`;
		svg += `<line class="hair" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
		const ends = [];
		for (const s of D.serial) {
			const pts = s.rounds[key].map((v, i) => [i + 1, share(v)]).filter(([, p]) => p !== null);
			svg += `<path stroke="${color(s.name)}" d="${pts.map(([k, p], i) => (i ? 'L' : 'M') + xOf(k).toFixed(1) + ',' + yOf(p).toFixed(1)).join('')}"/>`;
			svg += pts.map(([k, p]) => `<circle fill="${color(s.name)}" cx="${xOf(k).toFixed(1)}" cy="${yOf(p).toFixed(1)}" r="4"/>`).join('');
			const [k, p] = pts.at(-1);
			ends.push([yOf(p), Math.round(100 * p) + '%', s.name]);
		}
		ends.sort((a, b) => a[0] - b[0]); // name every line at its end, labels at least 14px apart
		for (let i = 1; i < ends.length; i++) ends[i][0] = Math.max(ends[i][0], ends[i - 1][0] + 14);
		const over = ends.at(-1)[0] - (H - B + 4);
		for (const e of ends) { if (over > 0) e[0] -= over; svg += `<text class="end" x="${xOf(last) + 10}" y="${(e[0] + 4).toFixed(1)}"><tspan>${e[1]}</tspan><tspan dx="6">${e[2]}</tspan></text>`; }
		svg += `<rect class="hit" x="${L - 12}" y="${T}" width="${W - L - R + 24}" height="${H - T - B}" fill="transparent"/></svg>`;
		const box = $('rq2-l-' + key);
		box.innerHTML = svg;
		const el = box.querySelector('svg'), hair = el.querySelector('.hair'), title = box.parentElement.querySelector('h5').textContent;
		el.querySelector('.hit').addEventListener('pointermove', (e) => {
			const r = el.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W;
			const k = Math.max(1, Math.min(last, Math.round(((x - L) / (W - L - R)) * (last - 1) + 1)));
			hair.setAttribute('x1', xOf(k)); hair.setAttribute('x2', xOf(k)); hair.setAttribute('visibility', 'visible');
			tip(e, `<b>${title.replace(' k', ' ' + k)}</b><br>` + D.serial.map((s) => {
				const v = s.rounds[key][k - 1];
				return `<i style="background:${color(s.name)}"></i>${s.name}: ${v && v[1] ? frac(v[0], v[1]) : '—'}`;
			}).join('<br>'));
		});
		el.querySelector('.hit').addEventListener('pointerleave', () => { hair.setAttribute('visibility', 'hidden'); $('tip').hidden = true; });
	}
	['correct', 'violating_cum', 'kept', 'survival'].forEach(lines);

	// ---- Shared tooltip ----
	function tip(e, html) {
		const t = $('tip');
		t.innerHTML = html; t.hidden = false;
		const r = t.getBoundingClientRect();
		t.style.left = Math.min(e.clientX + 14, innerWidth - r.width - 8) + 'px';
		t.style.top = Math.max(8, e.clientY - r.height - 10) + 'px';
	}
	document.addEventListener('pointermove', (e) => {
		if (e.target.closest && e.target.closest('.lines svg')) return;
		const t = e.target.closest && e.target.closest('#demo-2-rq2 [data-tip]');
		if (t) tip(e, t.dataset.tip); else $('tip').hidden = true;
	});

	// ---- Table: every model, serial and parallel ----
	const cellOf = (x, f) => (x ? f(x.overall) : null);
	const ROWS = [
		['Round 1 admitted', (r) => frac(r.admitted, r.scenes)],
		['Correct Rate', (r) => frac(r.correct, r.requests)],
		['Violation Rate', (r) => frac(r.violating, r.requests)],
		['Not judged', (r) => frac(r.not_judged, r.requests)],
	];
	const SERIAL_ONLY = [
		['Retention Rate (rounds 2+)', (r) => frac(...r.kept)],
		['Scenes correct in all rounds', (r) => frac(r.clean_scenes, r.scenes)],
	];
	const td = (v) => (v === null ? '<td class="na">—</td>' : `<td>${v}</td>`);
	$('rq2-table').innerHTML = '<thead><tr><th>Metric</th>' + D.models.map((n) => `<th>${n}</th>`).join('') + '</tr></thead><tbody>'
		+ [['Serial', [...ROWS, ...SERIAL_ONLY], ser], ['Parallel', ROWS, par]].map(([setting, rows, runs]) =>
			rows.map(([label, f]) => `<tr><td>${setting} · ${label}</td>` + D.models.map((n) => td(cellOf(runs[n], f))).join('') + '</tr>').join('')).join('')
		+ '</tbody>';
})();
