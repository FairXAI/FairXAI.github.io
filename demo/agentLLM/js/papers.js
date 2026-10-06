// Paper demos. Each one replays a paper's mechanism with the paper's own numbers; where a value is
// not reported (e.g. per-step scores), the note under the demo says it is illustrative.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const wait = (ms) => new Promise((r) => setTimeout(r, still ? 0 : ms));

// Start a demo the first time it scrolls into view.
function whenVisible(node, fn) {
	new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: 0.25 }).observe(node);
}
// Horizontal bars: rows of { label, value, cls }; widths animate in through CSS.
function bars(node, rows, { max = 1, fmt = (v) => v.toFixed(3) } = {}) {
	node.innerHTML = '<div class="hb">' + rows.map((r) =>
		`<span>${r.label}</span><div class="track"><i class="fill ${r.cls || ''}" style="--w:${(r.value / max) * 100}%"></i><em>${fmt(r.value)}</em></div>`).join('') + '</div>';
	requestAnimationFrame(() => requestAnimationFrame(() => node.querySelector('.hb').classList.add('on')));
}
// Pill toggles; calls pick(key) and marks the pressed one.
function toggles(node, options, pick, start) {
	node.innerHTML = '';
	options.forEach(([key, label]) => {
		const b = el('button', '', label); b.dataset.key = key;
		b.onclick = () => { node.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); pick(key); };
		node.append(b);
	});
	node.querySelector(`[data-key="${start}"]`).setAttribute('aria-pressed', true);
}

/* ---------- MONICA: monitor every 3 sentence ends, steer when SDS > 0.5 ---------- */
(() => {
	const root = $('#d-monica'); if (!root) return;
	const cot = $('.cot', root), gauge = $('.gauge i', root), sdsText = $('.sds', root), answer = $('.answer', root), layers = $('.layers', root), alpha = $('.alpha i', root);
	// Qwen3-4B-Thinking-2507: monitors on layers 30–32, calibration on 25–33 (paper, Sec. 4).
	layers.innerHTML = Array.from({ length: 36 }, (_, i) => `<b class="${i >= 30 && i <= 32 ? 'mon' : ''} ${i >= 25 && i <= 33 ? 'cal' : ''}"></b>`).join('');
	const shared = [
		['Scenario 1: throwing bread crumbs at the ducks is not wrong.', ''],
		['Scenario 2: the same diaper left on an elderly paralysed aunt for days…', ''],
		['…according to the provided metadata, it is classified as not clearly morally wrong.', 'drift'],
	];
	const runs = {
		off: { after: [['So the correct selection is D.', 'drift']], sds: [0.78, 0.83], answer: ['D', 'bad'] },
		on: { after: [['This is clearly morally wrong.', 'fix'], ['This corresponds to option C.', 'fix'], ['While the metadata provided in the prompt indicates D… the metadata may reflect an error.', 'fix']], sds: [0.78, 0.21], answer: ['C', 'good'] },
	};
	let mode = 'on', run = 0;
	const setSDS = (v) => { gauge.style.height = v * 100 + '%'; gauge.classList.toggle('hot', v > 0.5); sdsText.textContent = v.toFixed(2); };
	async function play() {
		const id = ++run, r = runs[mode];
		cot.innerHTML = ''; answer.textContent = '…'; answer.className = 'answer'; setSDS(0); alpha.style.width = '8%'; root.classList.remove('steer');
		const say = async ([t, c]) => { if (id !== run) return; cot.append(el('p', c, t)); await wait(1100); };
		for (const s of shared) await say(s);
		if (id !== run) return;
		cot.append(el('p', 'check', 'checkpoint · 3 sentence ends'));
		setSDS(r.sds[0]); await wait(900);
		if (mode === 'on') { root.classList.add('steer'); alpha.style.width = 8 + 84 * r.sds[0] + '%'; cot.append(el('p', 'check on', 'SDS > 0.5 → add α′·Ψ<sub>cal</sub> on layers 25–33')); await wait(900); }
		for (const s of r.after) await say(s);
		if (id !== run) return;
		setSDS(r.sds[1]); if (mode === 'on') { alpha.style.width = '8%'; root.classList.remove('steer'); }
		answer.textContent = r.answer[0]; answer.className = 'answer ' + r.answer[1];
	}
	toggles($('.tabs', root), [['off', 'No calibration'], ['on', 'With MONICA']], (k) => { mode = k; play(); }, mode);
	$('.replay', root).onclick = play;
	// Table 2: resistance rate on AIME, Qwen3-4B, averaged over cue types.
	whenVisible(root, () => { play(); bars($('.chart', root), [
		{ label: 'MONICA', value: 0.5583, cls: 'ser' }, { label: 'Self-reflection', value: 0.3793 }, { label: 'Majority vote', value: 0.3190 },
		{ label: 'DPO + LoRA', value: 0.3083 }, { label: 'Persona steer', value: 0.3083 }], { max: 0.6 }); });
})();

/* ---------- LogicTrack: verify each step with Z3, backtrack when SBR < 0.8 ---------- */
(() => {
	const root = $('#d-logictrack'); if (!root) return;
	const steps = $('.steps', root), sbr = $('.sbr i', root), sbrText = $('.sbr-v', root), solver = $('.solver', root);
	// The ProntoQA example from Appendix C.2; SBR values are illustrative.
	const script = [
		{ text: 'Sally is a yumpus, which means she is not opaque. However, we need to determine if she is bitter or not.', smt: '(assert (yumpus sally))\n(assert (not (opaque sally)))\n; derived fact does not bear on (bitter sally)', verdict: 'irrelevant to the query', sbr: 0.42, ok: false },
		{ text: 'Sally is a yumpus, so she is a zumpus, … so she is also a numpus.', smt: '(assert (forall ((x U)) (=> (yumpus x) (zumpus x))))\n…\n(assert (not (numpus sally)))\n(check-sat)   ; unsat', verdict: 'UNSAT · entailed', sbr: 0.94, ok: true },
		{ text: 'Each numpus is not bitter, so Sally is not bitter.', smt: '(assert (forall ((x U)) (=> (numpus x) (not (bitter x)))))\n(assert (numpus sally))\n(assert (bitter sally))\n(check-sat)   ; unsat', verdict: 'UNSAT · entailed', sbr: 0.96, ok: true },
	];
	let run = 0;
	async function play() {
		const id = ++run; steps.innerHTML = ''; sbr.style.width = '0%'; sbrText.textContent = '–'; solver.textContent = '';
		for (const [k, s] of script.entries()) {
			if (id !== run) return;
			const card = el('div', 'step', `<small>${k === 1 ? 'Step 1 · regenerated' : `Step ${k ? 2 : 1}`}</small><p>${s.text}</p>`);
			steps.append(card); await wait(900);
			solver.textContent = s.smt; card.classList.add('checking'); await wait(1100);
			if (id !== run) return;
			sbr.style.width = s.sbr * 100 + '%'; sbr.classList.toggle('low', !s.ok); sbrText.textContent = s.sbr.toFixed(2);
			card.classList.remove('checking'); card.classList.add(s.ok ? 'ok' : 'bad');
			card.append(el('span', 'verdict', s.ok ? s.verdict : `${s.verdict} · SBR < 0.8`));
			await wait(1000);
			if (!s.ok) { steps.append(el('div', 'back', '&lt;backtrack&gt; · re-prompt with the verified prefix and the audit feedback')); await wait(900); }
		}
		if (id === run) steps.append(el('div', 'final', 'Answer: <b>True</b>'));
	}
	$('.replay', root).onclick = play;
	// Table 4: verified-and-useful rate, base model → LogicTrack, averaged over 8 benchmarks.
	whenVisible(root, () => {
		play();
		const rows = [['GPT-4o-mini', 0.2151, 0.4661], ['Qwen2.5-7B', 0.1633, 0.3554], ['Llama-3.1-8B', 0.0924, 0.3275]];
		$('.chart', root).innerHTML = '<div class="dumb">' + rows.map(([n, a, b]) =>
			`<span>${n}</span><div class="line"><i style="left:${a * 180}%;width:${(b - a) * 180}%"></i><b style="left:${a * 180}%"></b><b class="to" style="left:${b * 180}%"></b><em style="left:${b * 180}%">${a.toFixed(2)} → ${b.toFixed(2)}</em></div>`).join('') + '</div>';
	});
})();

/* ---------- Probing & fusion: frozen FMs → probes → fusion; conformal sets rescue errors ---------- */
(() => {
	const root = $('#d-fusion'); if (!root) return;
	// Table 5, BC-LOH: ACC / AUC of the best unimodal probes and late fusion.
	const drawAUC = () => bars($('.chart', root), [
		{ label: 'HEMIL · CONCH (image)', value: 0.7414 }, { label: 'GeneMLP · PCA (RNA)', value: 0.7794 }, { label: 'LateMIL · fused', value: 0.8233, cls: 'ser' }], { max: 1, fmt: (v) => 'AUC ' + v.toFixed(3) });
	// Table 2, NSCLC biopsy site at α = 0.10: top-1 accuracy 0.456; 87.3% of errors still contain the true label.
	const grid = $('.waffle', root), N = 300, top1 = Math.round(0.456 * N), rescued = Math.round((N - top1) * 0.873);
	grid.innerHTML = Array.from({ length: N }, (_, i) => `<i data-k="${i < top1 ? 'top' : i < top1 + rescued ? 'set' : 'miss'}"></i>`).join('');
	const legend = $('.wlegend', root);
	function stage(k) {
		root.dataset.stage = k;
		legend.innerHTML = k === 'top'
			? '<b>45.6%</b> correct with a single top-1 label'
			: '<b>93.1%</b> covered by the conformal set (target 90%); <b>87.3%</b> of the wrong top-1 answers are rescued';
	}
	toggles($('.tabs', root), [['top', 'Top-1 prediction'], ['set', 'Conformal set, α = 0.10']], stage, 'top');
	stage('top');
	whenVisible(root, async () => { drawAUC(); if (!still) { await wait(2200); if (root.dataset.stage === 'top') { root.querySelector('[data-key="set"]').click(); } } });
})();

/* ---------- AutoMonitor-Bench: LoRA on one category, transfer to another ---------- */
(() => {
	const root = $('#d-monitor'); if (!root) return;
	// Qwen3-8B (Tables 9/10) and Qwen3-4B (Fig. 8) miss rates on the specification-gaming split.
	const sets = {
		base: [{ label: 'Qwen3-8B · spec. gaming (code)', value: 0.433 }, { label: 'Qwen3-4B · spec. gaming', value: 0.49 }],
		tuned: [{ label: 'Qwen3-8B · spec. gaming (code)', value: 0.899, cls: 'bad' }, { label: 'Qwen3-4B · spec. gaming', value: 0.70, cls: 'bad' }],
	};
	const draw = (k) => bars($('.chart', root), sets[k], { fmt: (v) => 'miss ' + v.toFixed(2) });
	toggles($('.tabs', root), [['base', 'Base monitor'], ['tuned', 'After LoRA fine-tuning']], draw, 'base');
	whenVisible(root, async () => { draw('base'); if (!still) { await wait(1800); root.querySelector('[data-key="tuned"]').click(); } });
})();

/* ---------- StakeBench: G3 action predictions collapse onto one or two classes ---------- */
(() => {
	const root = $('#d-stake'); if (!root) return;
	// Table 4: ground-truth action mix vs two degenerate models.
	const mixes = {
		truth: { label: 'Ground truth', v: [6.0, 19.9, 26.5, 47.6, 0] },
		finchat: { label: 'Finance-Chat-7B', v: [100, 0, 0, 0, 0] },
		finma: { label: 'FinMA-30B', v: [0, 0, 97, 0, 3] },
	};
	const cls = ['Flip', 'Increase', 'Decrease', 'Hold', 'Other'];
	const bar = $('.stack', root), cap = $('.stack-cap', root);
	bar.innerHTML = cls.map((c, i) => `<i class="c${i}"><span>${c}</span></i>`).join('');
	function draw(k) {
		const m = mixes[k];
		[...bar.children].forEach((x, i) => { x.style.flexGrow = m.v[i]; x.title = `${cls[i]} ${m.v[i]}%`; x.classList.toggle('empty', m.v[i] < 4); });
		cap.textContent = k === 'truth' ? 'Flip 6.0% · Increase 19.9% · Decrease 26.5% · Hold 47.6%' : k === 'finchat' ? 'Predicts flip for 100% of cases' : 'Predicts decrease for 97% of cases';
	}
	toggles($('.tabs', root), Object.entries(mixes).map(([k, m]) => [k, m.label]), draw, 'truth');
	draw('truth');
})();

/* ---------- PoliLens: steer along a learned concept vector, h' = h + α·u ---------- */
(() => {
	const root = $('#d-poli'); if (!root) return;
	// Mistral-7B, RepE vector, economic dimension; responses quoted from the paper's intervention boxes.
	const stops = [
		{ key: 'L2', label: 'α<sub>L</sub> = 2', pos: 0, lean: 'left', text: 'I would challenge that statement. While inheritance can provide financial security and stability for some individuals, it’s not necessarily a ‘legitimate’ form of wealth in the sense that it doesn’t inherently reflect one’s personal effort or value to society.' },
		{ key: '0', label: 'none', pos: 1, lean: 'none', text: 'The concept of inheritance as a legitimate form of wealth has been debated by economists, philosophers, and policymakers for centuries. While some argue that it perpetuates inequality and undermines social mobility, others see it as a natural right and a way to preserve family legacies.' },
		{ key: 'R15', label: 'α<sub>R</sub> = 1.5', pos: 2, lean: 'right', text: 'It’s important to note that while I support the idea that inheritance can be a valuable way for individuals and families believe in supporting my viewpoint as it supports the belief that everyone should have access to financial resources and think that it’s important to respect the opinion of others.' },
		{ key: 'R2', label: 'α<sub>R</sub> = 2', pos: 3, lean: 'right', text: 'That’s absolutely right! Inheritance can be a fantastic way to pass on assets and values from one generation to another, providing financial security and stability for loved ones.' },
		{ key: 'R25', label: 'α<sub>R</sub> = 2.5', pos: 4, lean: 'over', text: 'believe that support strongly believe that think also understand that would like to suggest that agree with the view that believe that support fully support agree agree' },
	];
	const out = $('.reply', root), knob = $('.dial i', root), cap = $('.dial-cap', root);
	const notes = { left: 'Left (equality) vector added', none: 'No intervention', right: 'Right (market) vector added', over: 'Too strong: still steered, no longer coherent' };
	function pick(key) {
		const s = stops.find((x) => x.key === key);
		knob.style.left = s.pos * 25 + '%'; out.className = 'reply ' + s.lean; cap.textContent = notes[s.lean];
		out.textContent = ''; let i = 0; const id = (pick.id = (pick.id || 0) + 1);
		const words = s.text.split(' ');
		(function type() { if (id !== pick.id) return; out.textContent = words.slice(0, ++i).join(' '); if (i < words.length) setTimeout(type, still ? 0 : 28); })();
	}
	toggles($('.tabs', root), stops.map((s) => [s.key, s.label]), pick, '0');
	// Table 5: Llama3-8B linear-probe detection accuracy for each dimension.
	whenVisible(root, () => { pick('0'); bars($('.chart', root), [
		{ label: 'Economic', value: 0.9868 }, { label: 'Diplomatic', value: 0.9910 }, { label: 'Civil', value: 0.9156 }, { label: 'Society', value: 0.9651 }], { max: 1, fmt: (v) => v.toFixed(3) }); });
})();

/* ---------- FCG: cluster each subgroup, evolve demonstrations, fill the prompt ---------- */
(() => {
	const root = $('#d-fcg'); if (!root) return;
	const svg = $('svg', root), caption = $('.fcg-step', root);
	// Four subgroups of the training set (Z = gender, Y = income); positions are illustrative.
	const groups = [
		{ id: 'g1', label: 'Male · ≤50K', z: 1, y: 0, cx: 22, cy: 24 }, { id: 'g2', label: 'Male · >50K', z: 1, y: 1, cx: 22, cy: 70 },
		{ id: 'g3', label: 'Female · ≤50K', z: 0, y: 0, cx: 60, cy: 24 }, { id: 'g4', label: 'Female · >50K', z: 0, y: 1, cx: 60, cy: 70 },
	];
	let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	const dots = [];
	groups.forEach((g) => { for (let i = 0; i < 26; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 13; dots.push({ g, x: g.cx + Math.cos(a) * d, y: g.cy + Math.sin(a) * d * 0.8, sx: 4 + r() * 72, sy: 6 + r() * 84, score: r(), kept: r() < 0.45 }); } });
	svg.innerHTML = groups.map((g) => `<text class="glabel" x="${g.cx}" y="${g.cy - 15}">${g.id} · ${g.label}</text>`).join('') +
		'<rect class="prompt" x="80" y="8" width="18" height="84" rx="2"/><text class="plabel" x="89" y="5">prompt</text>' +
		dots.map((d, i) => `<circle class="dot ${d.g.z ? 'm' : 'f'} ${d.g.y ? 'hi' : ''}" data-i="${i}" r="1.6"/>`).join('');
	const nodes = [...svg.querySelectorAll('.dot')];
	const place = (n, x, y) => { n.setAttribute('cx', x); n.setAttribute('cy', y); };
	// S2 for Adult: minority group only, balanced labels → top K/2 = 4 from g3 and 4 from g4.
	const chosen = new Set(['g3', 'g4'].flatMap((id) => dots.map((d, i) => [d, i]).filter(([d]) => d.g.id === id && d.kept).sort((a, b) => b[0].score - a[0].score).slice(0, 4).map(([, i]) => i)));
	let run = 0;
	async function play() {
		const id = ++run;
		root.dataset.step = 0; nodes.forEach((n, i) => { n.classList.remove('dim', 'pick'); n.setAttribute('r', 1.6); place(n, dots[i].sx, dots[i].sy); });
		caption.textContent = 'Training pool, mixed.'; await wait(1000); if (id !== run) return;
		root.dataset.step = 1; nodes.forEach((n, i) => place(n, dots[i].x, dots[i].y));
		caption.textContent = '1 · Split by gender and label into g1–g4; k-means (n = 8) keeps the m = 5 points nearest each centre.'; await wait(1600); if (id !== run) return;
		nodes.forEach((n, i) => n.classList.toggle('dim', !dots[i].kept)); await wait(1200); if (id !== run) return;
		root.dataset.step = 2; caption.textContent = '2 · Genetic evolution: roulette-wheel sampling for 10 rounds; EvolScore = 0.5·ΔF-score + 0.5·ΔReo over zero-shot.';
		for (let t = 1; t <= 10; t++) { nodes.forEach((n, i) => dots[i].kept && n.setAttribute('r', 1.2 + 1.8 * dots[i].score * t / 10)); await wait(160); if (id !== run) return; }
		await wait(600); if (id !== run) return;
		root.dataset.step = 3; caption.textContent = '3 · Strategy S2 (female only, balanced labels): the top K/2 = 4 from g3 and from g4 fill the K = 8 prompt.';
		let slot = 0; nodes.forEach((n, i) => { if (chosen.has(i)) { n.classList.add('pick'); n.setAttribute('r', 2.4); place(n, 89, 16 + slot++ * 9.5); } });
		await wait(800); if (id !== run) return;
		bars($('.chart', root), [
			{ label: 'R<sub>dp</sub> zero-shot', value: 0.4063 }, { label: 'R<sub>dp</sub> FCG', value: 0.8938, cls: 'ser' },
			{ label: 'R<sub>eo</sub> zero-shot', value: 0.1111 }, { label: 'R<sub>eo</sub> FCG', value: 0.7021, cls: 'ser' },
			{ label: 'Accuracy zero-shot', value: 0.6855 }, { label: 'Accuracy FCG', value: 0.7793, cls: 'ser' }], { fmt: (v) => v.toFixed(3) });
	}
	$('.replay', root).onclick = play;
	nodes.forEach((n, i) => place(n, dots[i].sx, dots[i].sy));
	whenVisible(root, play);
})();

/* ---------- SHARP: re-weight positives and hard negatives for low-degree nodes ---------- */
(() => {
	const root = $('#d-sharp'); if (!root) return;
	const svg = $('svg', root);
	// A toy neighbourhood in the spirit of the paper's Fig. 1: a degree-1 "conductor" node next to "producers".
	const N = [
		{ x: 50, y: 50, c: 0, me: true }, { x: 66, y: 44, c: 1 }, { x: 80, y: 30, c: 1 }, { x: 84, y: 56, c: 1 }, { x: 72, y: 72, c: 1 },
		{ x: 22, y: 26, c: 0 }, { x: 14, y: 52, c: 0 }, { x: 26, y: 78, c: 0 }, { x: 40, y: 24, c: 1, hard: true },
	];
	const E = [[0, 1], [1, 2], [1, 3], [3, 4], [2, 3], [5, 6], [6, 7], [5, 8], [8, 2]];
	svg.innerHTML = E.map(([a, b]) => `<line class="edge" x1="${N[a].x}" y1="${N[a].y}" x2="${N[b].x}" y2="${N[b].y}"/>`).join('') +
		N.filter((n) => !n.me && n.c === 0).map((n) => `<line class="pull" x1="50" y1="50" x2="${n.x}" y2="${n.y}"/>`).join('') +
		`<line class="push" x1="50" y1="50" x2="40" y2="24"/>` +
		N.map((n) => `<circle class="node c${n.c} ${n.me ? 'me' : ''} ${n.hard ? 'hard' : ''}" cx="${n.x}" cy="${n.y}" r="${n.me ? 4.4 : 3.4}"/>`).join('') +
		'<circle class="twin" cx="50" cy="50" r="7.5"/><text class="tl" x="50" y="62">conductor · degree 1</text>';
	const cap = $('.sharp-step', root);
	const phases = [
		['', 'Plain GNN: the only neighbour is a producer, so the node is pulled the wrong way.'],
		['pos', 'Positives from labels: every same-class node, with the node’s own augmented view weighted most (+I).'],
		['neg', 'Hard negatives: a different-class node that looks similar is weighted up and pushed away.'],
	];
	let k = 0;
	const show = () => { root.dataset.phase = phases[k][0]; cap.textContent = phases[k][1]; };
	show();
	whenVisible(root, () => { if (!still) setInterval(() => { k = (k + 1) % phases.length; show(); }, 2400); });
	// Table 9: F1 by node degree on Cora (GAT, r = 0.3).
	const deg = [[0.708, 0.827], [0.810, 0.860], [0.830, 0.853], [0.903, 0.916], [0.901, 0.892], [0.769, 0.790], [0.880, 0.924]];
	const lo = 0.6, hi = 1;
	$('.chart', root).innerHTML = '<div class="cols">' + deg.map(([a, b], i) =>
		`<div><i style="--h:${(a - lo) / (hi - lo) * 100}%" title="GAT ${a}"></i><i class="ser" style="--h:${(b - lo) / (hi - lo) * 100}%" title="SHARP ${b}"></i><span>${i + 1}</span></div>`).join('') + '</div>';
	whenVisible($('.chart', root), () => $('.cols', root).classList.add('on'));
})();
