/* Evidence Locker V2 — motor genérico de casos de investigación (chapTR).
   Sin backend: el progreso se guarda en el dispositivo (localStorage).
   URL: index.html?case=<id>&team=<A|B|C|1|2|solo> */
(() => {
  'use strict';

  // ---------- Caso y equipo ----------
  const params = new URLSearchParams(location.search);
  const CASES = window.CASES || {};
  const caseId = params.get('case') || Object.keys(CASES)[0];
  const C = CASES[caseId];
  const app = document.getElementById('app');
  if (!C) { app.innerHTML = '<p class="center">Case not found.</p>'; return; }

  const decode = (b64) => { try { return decodeURIComponent(escape(atob(b64))); } catch { return ''; } };
  const SOL = JSON.parse(decode(C.solution) || '{}');
  const CODES = [C.scene.code, ...(C.scene.altCodes || [])].map(decode);
  const CODE = CODES[0];
  const TEACHER = decode(C.teacherCode);

  const allQA = C.suspects.flatMap(s => s.qa.map(q => ({ ...q, suspect: s })));
  const qaById = Object.fromEntries(allQA.map(q => [q.id, q]));
  const suspectById = Object.fromEntries(C.suspects.map(s => [s.id, s]));

  // ---------- Estado persistente ----------
  const fresh = () => ({ stage: 'cover', tab: 'evidence', keyFacts: [], timeline: {}, hunches: [], asked: [], verdict: null, verdictTries: 0, verdictLocked: false, revealOpen: false, seenBatches: 1, hypotheses: [] });
  let team = params.get('team');
  const storeKey = () => `evidence-locker:${caseId}:${team}`;
  let S = fresh();
  const load = () => { try { const raw = localStorage.getItem(storeKey()); if (raw) S = { ...fresh(), ...JSON.parse(raw) }; } catch { /* sin storage */ } };
  const save = () => { try { localStorage.setItem(storeKey(), JSON.stringify(S)); } catch { /* sin storage */ } };
  if (team && C.teams[team]) load(); else team = null;

  // Selección actual del constructor (no se guarda)
  let build = { starter: null, subject: null, ending: null, said: false };
  let currentSuspect = C.suspects[0].id;
  let pending = null; // pregunta recién hecha esperando Yes/No

  // ---------- Utilidades ----------
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const tilt = (i) => `${[-1.6, 1.2, -0.6, 1.8, -1.1, 0.7][i % 6]}deg`;
  const photo = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" data-fallback="${esc(alt)}">`;
  const toast = (msg) => { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800); };
  const go = (patch) => { Object.assign(S, patch); save(); render(); scrollTo({ top: 0, behavior: 'smooth' }); };
  const askedCount = () => S.asked.length;
  const tapesLeft = () => C.questionBudget - askedCount();

  function visibleEvidence() {
    const t = C.teams[team];
    if (!t) return [];
    if (!t.batches) return t.evidence;
    return t.batches.filter(b => askedCount() >= b.after).flatMap(b => b.evidence);
  }
  function lockedBatches() {
    const t = C.teams[team];
    return t && t.batches ? t.batches.filter(b => askedCount() < b.after) : [];
  }

  // Imágenes que faltan: placeholder en vez de ícono roto
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.fallback) return;
    const div = document.createElement('div');
    div.className = 'ph-missing';
    div.textContent = img.dataset.fallback;
    img.replaceWith(div);
  }, true);

  // ---------- Audio ----------
  let currentAudio = null;
  function stopAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  function pickVoice(female) {
    const voices = ('speechSynthesis' in window) ? speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)) : [];
    if (!voices.length) return null;
    const fem = /female|samantha|karen|moira|tessa|serena|victoria|zira|susan|hazel|libby|sonia|aria|jenny/i;
    const mal = /male|daniel|alex|fred|george|ryan|guy|david|mark|arthur|oliver/i;
    return voices.find(v => (female ? fem : mal).test(v.name)) || voices[female ? 0 : voices.length - 1];
  }
  function speak(text, voice, onEnd) {
    if (!('speechSynthesis' in window)) { onEnd && onEnd(); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(voice ? voice.female : true);
    if (v) u.voice = v;
    u.lang = (v && v.lang) || 'en-GB';
    u.rate = voice ? voice.rate : 0.85;
    u.pitch = voice ? voice.pitch : 1;
    u.onend = () => onEnd && onEnd();
    speechSynthesis.speak(u);
  }
  function play({ src, text, voice }, onStart, onEnd) {
    stopAudio();
    onStart && onStart();
    if (C.audioReady && src) {
      currentAudio = new Audio(src);
      currentAudio.onended = () => onEnd && onEnd();
      currentAudio.play().catch(() => speak(text, voice, onEnd));
    } else {
      speak(text, voice, onEnd);
    }
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};


  // ---------- Glosario con dibujos (trazo de tinta, sin spoilers) ----------
  const ICONS = {
    prototype: '<rect x="18" y="14" width="28" height="38" rx="7"/><circle cx="32" cy="30" r="7"/><line x1="26" y1="44" x2="38" y2="44"/>',
    base: '<ellipse cx="32" cy="38" rx="22" ry="9"/><ellipse cx="32" cy="35" rx="13" ry="5"/><line x1="54" y1="38" x2="60" y2="30"/>',
    case: '<rect x="12" y="20" width="40" height="28" rx="4"/><path d="M25 20v-6h14v6"/><circle cx="20" cy="52" r="3"/><circle cx="44" cy="52" r="3"/>',
    card: '<rect x="10" y="18" width="44" height="28" rx="3"/><rect x="15" y="24" width="10" height="12"/><line x1="30" y1="28" x2="48" y2="28"/><line x1="30" y1="35" x2="44" y2="35"/>',
    meeting: '<rect x="14" y="26" width="36" height="12" rx="2"/><circle cx="20" cy="18" r="4"/><circle cx="32" cy="18" r="4"/><circle cx="44" cy="18" r="4"/><line x1="20" y1="38" x2="20" y2="50"/><line x1="44" y1="38" x2="44" y2="50"/>',
    storage: '<rect x="12" y="10" width="40" height="44"/><line x1="12" y1="25" x2="52" y2="25"/><line x1="12" y1="40" x2="52" y2="40"/><rect x="17" y="15" width="10" height="10"/><rect x="33" y="30" width="12" height="10"/><rect x="19" y="44" width="14" height="10"/>',
    wheels: '<path d="M8 44 C22 40, 34 30, 56 26" stroke-dasharray="4 4"/><path d="M8 52 C22 48, 34 38, 56 34" stroke-dasharray="4 4"/>',
    fiber: '<path d="M10 40 C18 20, 26 50, 34 30 S48 22, 54 34" style="stroke:#9c3d26"/>',
  };
  function glossary(compact) {
    if (!C.glossary) return '';
    return `<div class="gloss ${compact ? 'compact' : ''}" aria-label="Case words">
      ${C.glossary.map(g => `<figure class="gloss-item"><svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[g.icon] || ''}</svg><figcaption>${esc(g.word)}</figcaption></figure>`).join('')}
    </div>`;
  }

  // ---------- Vistas ----------
  function render() {
    stopAudio();
    const views = { cover: viewCover, briefing: viewBriefing, inspect: viewInspect, desk: viewDesk, reveal: viewReveal };
    app.innerHTML = (team ? views[S.stage] : viewCover)();
    bind();
  }

  function viewCover() {
    const t = team ? C.teams[team] : null;
    return `
    <section class="cover">
      <div>
        <div class="folder">
          <span class="tab dymo">${esc(C.number)}</span>
          <div class="sub">${esc(C.subtitle)}</div>
          <h1>${esc(C.title)}</h1>
          <div class="sub">${esc(C.place)}</div>
          <div class="polaroid"><div class="ph">${photo(C.scene.img, 'The studio')}</div><span class="cap">6:20</span></div>
          <span class="stamp confidential">Confidential</span>
        </div>
        ${t ? `
          <div class="center" style="margin-top:28px">
            <p><span class="dymo">${esc(t.label)}</span></p>
            <button class="btn primary" data-go="briefing">Open the case file</button>
            <p class="note-small">No names. Your progress stays on this device.</p>
          </div>` : `
          <div class="team-pick">
            ${['A', 'B', 'C', 'solo'].map(id => `<button class="btn ${id === 'solo' ? 'ghost' : ''}" data-team="${id}">${esc(C.teams[id].label)}</button>`).join('')}
          </div>
          <p class="note-small center">Only 4 students? <a href="?case=${esc(caseId)}&team=1" style="color:inherit">Team 1</a> · <a href="?case=${esc(caseId)}&team=2" style="color:inherit">Team 2</a></p>`}
      </div>
    </section>`;
  }

  function viewBriefing() {
    return `
    <section>
      <div class="briefing">
        <article class="paper memo clip" style="--r:-.8deg">
          <div class="letterhead">${esc(C.place.toUpperCase())} · INTERNAL MEMO</div>
          <h2>${esc(C.title)}</h2>
          ${C.briefing.map(l => `<p>${esc(l)}</p>`).join('')}
          ${C.questions.map(q => `<p class="ask">${esc(q)}</p>`).join('')}
        </article>
        <div class="photo-pair">
          ${C.briefingPhotos.map((p, i) => `<div class="polaroid" style="--r:${tilt(i + 1)}"><div class="ph">${photo(p.img, p.stamp)}<span class="datestamp">${esc(p.stamp)}</span></div></div>`).join('')}
        </div>
      </div>
      <div class="suspect-strip">
        ${C.suspects.map((s, i) => `
          <figure class="polaroid pin" style="--r:${tilt(i)};margin:0">
            <div class="ph">${photo(s.img, s.name)}</div>
            <figcaption class="cap"><b>${esc(s.name)}</b>${esc(s.role)}</figcaption>
          </figure>`).join('')}
      </div>
      <p class="dymo" style="margin-top:28px">Case words</p>
      ${glossary(false)}
      <div class="row" style="justify-content:center;margin-top:30px">
        <button class="btn primary" data-go="inspect">Inspect the studio</button>
      </div>
    </section>`;
  }

  let dialValues = [0, 0, 0];
  function viewInspect() {
    if (S.unlocked) dialValues = CODE.split('').map(Number);
    return `
    <section class="inspect">
      <div>
        <p><span class="dymo big">6:20 · The studio</span></p>
        <div class="flash" id="flash">
          ${photo(C.scene.img, 'The studio at 6:20')}
          <div class="dark"></div>
          <span class="hint dymo">Move your finger · Look · Count</span>
        </div>
      </div>
      <div class="stack">
        <div class="paper count-card lined" style="--r:1deg">
          <p class="marker">Count!</p>
          ${C.scene.prompt.map(p => `<p>${esc(p)}</p>`).join('')}
          <p class="small" style="margin-top:10px">Say three sentences to your partner. Your three numbers open the locker.</p>
        </div>
        <div class="lock ${S.unlocked ? 'open' : ''}" id="lock">
          <div class="shackle"></div>
          <div class="body">
            <div class="dials">
              ${dialValues.map((v, i) => `
                <div class="dial">
                  <button data-dial="${i}" data-step="1" aria-label="Number ${i + 1} up">▲</button>
                  <div class="num" aria-live="polite">${v}</div>
                  <button data-dial="${i}" data-step="-1" aria-label="Number ${i + 1} down">▼</button>
                </div>`).join('')}
            </div>
          </div>
          <div class="row" style="justify-content:center;margin-top:18px">
            <button class="btn primary" data-act="open-lock">${S.unlocked ? 'Open the locker' : 'Try the code'}</button>
          </div>
        </div>
      </div>
    </section>`;
  }

  function viewDesk() {
    const tabs = [
      ['evidence', 'Evidence', visibleEvidence().length],
      ['board', 'Case board', ''],
      ['interrogate', 'Interrogation', tapesLeft()],
      ['verdict', 'Verdict', ''],
    ];
    const body = { evidence: tabEvidence, board: tabBoard, interrogate: tabInterrogate, verdict: tabVerdict }[S.tab]();
    return `
    <section>
      <div class="desk-head">
        <span class="dymo">${esc(C.number)} · ${esc(C.title)}</span>
        <span class="meta">${esc(C.teams[team].label)}</span>
      </div>
      <nav class="tabs" role="tablist">
        ${tabs.map(([id, label, n]) => `<button role="tab" aria-selected="${S.tab === id}" data-tab="${id}">${label}${n !== '' ? `<span class="badge">${n}</span>` : ''}</button>`).join('')}
      </nav>
      <div class="drawer" role="tabpanel">${body}</div>
    </section>`;
  }

  function evidenceCard(id, i) {
    const e = C.evidence[id];
    return `
      <button class="paper ev ${e.kind} ${S.keyFacts.includes(id) ? 'key' : ''}" style="--r:${tilt(i)}" data-ev="${id}">
        <div class="no">${esc(id)}</div>
        ${e.img ? `<div class="ev-img">${photo(e.img, e.title)}</div>` : ''}
        <h3>${esc(e.title)}</h3>
        ${e.lines.map(l => `<p>${esc(l)}</p>`).join('')}
      </button>`;
  }

  function tabEvidence() {
    const ids = visibleEvidence();
    const locked = lockedBatches();
    const tapes = S.asked.filter(a => a.yn !== null);
    return `
      <h2>Your evidence</h2>
      <p class="lead">Read. Choose <b>two key facts</b> (tap a card). Say them. Do not show your screen.</p>
      ${glossary(true)}
      <div class="ev-grid">
        ${ids.map(evidenceCard).join('')}
        ${locked.map(b => `<div class="locked-env"><div><b>SEALED ENVELOPE</b><p class="typed" style="margin:8px 0 0">Opens after ${b.after} questions in the interrogation room.</p></div></div>`).join('')}
      </div>
      ${tapes.length ? `
        <h2 style="margin-top:30px">Interview tapes</h2>
        <div class="ev-grid">
          ${tapes.map((a, i) => { const q = qaById[a.id]; return `
            <div class="paper ev tape" style="--r:${tilt(i + 2)}">
              <div class="no">TAPE ${esc(a.id)} · ${esc(q.suspect.name)}</div>
              <h3>${esc(q.q.join(' '))}</h3>
              <p>${esc(q.a)}</p>
            </div>`; }).join('')}
        </div>` : ''}`;
  }

  function tabBoard() {
    return `
      <h2>Case board</h2>
      <p class="lead">Team A + Team B + Team C. Say your facts. Listen. Write the timeline. Choose two suspects — do not vote yet.</p>
      <div class="board">
        <div class="tl">
          ${C.timeline.map((t, i) => `
            <div class="slot pin" style="--r:${tilt(i)}">
              <b>${esc(t)}</b>
              <textarea data-tl="${esc(t)}" aria-label="What happens at ${esc(t)}?" placeholder="What happens?">${esc(S.timeline[t] || '')}</textarea>
            </div>`).join('')}
        </div>
        <div class="suspect-pick">
          ${C.suspects.map((s, i) => `
            <label>
              <input type="checkbox" data-hunch="${s.id}" ${S.hunches.includes(s.id) ? 'checked' : ''}>
              <div class="polaroid" style="--r:${tilt(i + 3)}"><div class="ph">${photo(s.img, s.name)}</div><span class="cap">${esc(s.name)}</span></div>
            </label>`).join('')}
        </div>
      </div>`;
  }

  function endingsFor(suspectId) {
    const own = suspectById[suspectId].qa.map(q => q.q[2]);
    const others = allQA.filter(q => q.suspect.id !== suspectId).map(q => q.q[2]);
    const nDecoys = C.decoysPerSuspect ?? 2;
    const decoys = [others[(suspectId.length * 3) % others.length], others[(suspectId.length * 5 + 2) % others.length]].slice(0, nDecoys);
    const list = [...new Set([...own, ...decoys])];
    // orden estable pero mezclado
    return list.map((v, i) => [v, (i * 7 + suspectId.length) % list.length]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  }

  function tabInterrogate() {
    const s = suspectById[currentSuspect];
    const full = build.starter && build.subject && build.ending;
    const logRows = S.asked.map((a, i) => {
      const q = qaById[a.id];
      return `<tr>
        <td>${esc(q.suspect.name.split(' ')[0])}</td>
        <td>${esc(q.q.join(' '))}</td>
        <td class="yn">${a.yn === null ? '—' : a.yn ? 'Yes' : 'No'}</td>
        <td><input data-fact="${i}" value="${esc(a.fact || '')}" placeholder="new fact" aria-label="New fact"></td>
      </tr>`;
    }).join('');
    return `
      <h2>Interrogation room</h2>
      <p class="lead">Build the question → say it aloud → listen → write Yes / No and one new fact. <b>One answer is not true.</b></p>
      ${glossary(true)}
      <div class="tapes" aria-label="${tapesLeft()} questions left">${Array.from({ length: C.questionBudget }, (_, i) => `<span class="tape-ic ${i < askedCount() ? 'used' : ''}"></span>`).join('')}<span class="small" style="margin-left:8px">${tapesLeft()} tapes left</span></div>
      <div class="room">
        <div class="who">
          ${C.suspects.map(x => `
            <button data-suspect="${x.id}" aria-pressed="${x.id === currentSuspect}">
              <span class="mini">${photo(x.img, x.name)}</span>
              <span><b>${esc(x.name)}</b><small>${esc(x.role)}</small></span>
            </button>`).join('')}
        </div>
        <div>
          <div class="builder">
            <div class="chip-label">YOUR QUESTION FOR ${esc(s.name.toUpperCase())}</div>
            <div class="slots">
              ${full || build.starter || build.subject || build.ending
                ? ['starter', 'subject', 'ending'].map(k => build[k] ? `<button class="chip on" data-clear="${k}">${esc(build[k])}</button>` : '<span class="ph">…</span>').join('')
                : '<span class="ph">Tap the words below.</span>'}
            </div>
            <div class="chip-label">START</div>
            <div class="chip-row">${C.starters.map(w => `<button class="chip starter ${build.starter === w ? 'on' : ''}" data-pick="starter" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>
            <div class="chip-label">WHO / WHAT</div>
            <div class="chip-row">${C.subjects.map(w => `<button class="chip ${build.subject === w ? 'on' : ''}" data-pick="subject" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>
            <div class="chip-label">THE REST</div>
            <div class="chip-row">${endingsFor(currentSuspect).map(w => `<button class="chip ${build.ending === w ? 'on' : ''}" data-pick="ending" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>
            <label class="row small" style="margin:6px 0 12px;gap:8px"><input type="checkbox" data-said ${build.said ? 'checked' : ''} ${full ? '' : 'disabled'}> We said the question aloud.</label>
            <div class="row">
              <button class="btn primary" data-act="ask" ${full && build.said && tapesLeft() > 0 ? '' : 'disabled'}>Ask ${esc(s.name.split(' ')[0])}</button>
              <button class="btn" data-act="clear">Clear</button>
            </div>
          </div>
          <div class="recorder" id="recorder">
            <div class="deck"><span class="reel l"></span><span class="reel r"></span></div>
            <div>
              <div><span class="red"></span><span class="small">${pending ? 'Interview tape' : 'Ready to record'}</span></div>
              ${pending ? `
                <div class="answer-box">
                  ${pending.logged ? `<div class="transcript">${esc(qaById[pending.id].a)}</div>` : `
                    <p class="small" style="margin:8px 0">What is the answer?</p>
                    <div class="row"><button class="btn" data-yn="1">Yes</button><button class="btn" data-yn="0">No</button></div>`}
                  <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="replay">Play again</button></div>
                </div>` : ''}
            </div>
          </div>
        </div>
      </div>
      ${S.asked.length ? `<div class="log-sheet"><table><thead><tr><th>SUSPECT</th><th>QUESTION</th><th>YES / NO</th><th>NEW FACT</th></tr></thead><tbody>${logRows}</tbody></table></div>` : ''}`;
  }

  function proofOptions() {
    const ev = visibleEvidence().map(id => [id, `${id} · ${C.evidence[id].title}`]);
    const tapes = S.asked.filter(a => a.yn !== null).map(a => [a.id, `Tape · ${qaById[a.id].suspect.name.split(' ')[0]}: "${qaById[a.id].a.split('.')[0]}."`]);
    return [...ev, ...tapes];
  }

  function tabVerdict() {
    const v = S.verdict;
    const done = v && (v.ok || S.verdictLocked);
    const asked = S.asked.filter(a => a.yn !== null);
    return `
      <h2>Your verdict</h2>
      <p class="lead">Who moves the prototype? Where is it on Thursday night? Two pieces of evidence. Which answer is not true?</p>
      <form class="verdict-form" id="verdict">
        ${v && v.ok ? '<span class="stamp press">Verified</span>' : S.verdictLocked ? '<span class="stamp press">Locked</span>' : ''}
        <h3>WHO MOVES IT?</h3>
        <div class="opts">${C.suspects.map(s => `<label><input type="radio" name="person" value="${s.id}" ${v && v.person === s.id ? 'checked' : ''} ${done ? 'disabled' : ''}><span>${esc(s.name)}</span></label>`).join('')}</div>
        <h3>WHERE IS IT ON THURSDAY NIGHT?</h3>
        <div class="opts">${C.places.map(p => `<label><input type="radio" name="place" value="${esc(p)}" ${v && v.place === p ? 'checked' : ''} ${done ? 'disabled' : ''}><span>${esc(p)}</span></label>`).join('')}</div>
        <h3>TWO PIECES OF EVIDENCE</h3>
        <div class="opts">${proofOptions().map(([id, label]) => `<label><input type="checkbox" name="proof" value="${esc(id)}" ${v && v.proofs.includes(id) ? 'checked' : ''} ${done ? 'disabled' : ''}><span>${esc(label)}</span></label>`).join('')}</div>
        <h3>WHICH ANSWER IS NOT TRUE?</h3>
        ${asked.length ? `<div class="opts">${asked.map(a => `<label><input type="radio" name="lie" value="${a.id}" ${v && v.lie === a.id ? 'checked' : ''} ${done ? 'disabled' : ''}><span>${esc(qaById[a.id].suspect.name.split(' ')[0])}: "${esc(qaById[a.id].a)}"</span></label>`).join('')}</div>` : '<p class="typed">Ask questions in the interrogation room first.</p>'}
        <p class="frame">We think ___ moves it, because ___ and ___ .</p>
        ${done ? '' : `<div class="row" style="margin-top:14px"><button class="btn primary" type="submit">Stamp the verdict</button><span class="small">${C.maxVerdictTries - S.verdictTries} tries left</span></div>`}
        ${v ? `<p class="small" style="margin-top:14px">Verdict code — say it or type it in the chat:</p><span class="vcode">${esc(v.code)}</span>` : ''}
      </form>
      ${done ? `
        <div class="paper" style="--r:.6deg;margin-top:22px">
          <p class="typed" style="margin-top:0">${v && v.ok ? 'Strong verdict. Wait for your teacher.' : 'Your verdict is locked. Wait for your teacher.'}</p>
          <label class="small" for="tcode">Teacher code</label>
          <div class="row"><input id="tcode" inputmode="numeric" maxlength="6" style="padding:12px;width:140px;font-size:20px;border:2px solid #b9a988;background:#fffaf0;color:var(--ink)"><button class="btn primary" data-act="teacher">Open the reveal</button></div>
        </div>` : ''}`;
  }

  function viewReveal() {
    const r = C.reveal;
    return `
    <section class="stack">
      <p><span class="dymo big">${esc(C.number)} · Final message</span></p>
      <div class="machine">
        <div class="am ${S.vmPlayed ? 'played' : ''}" id="am"><span class="slot"></span><span class="light"></span></div>
        <div>
          <p class="typed" style="font-size:22px;margin:0 0 12px">Listen: a message for ${esc(suspectById[SOL.person]?.name.split(' ')[0] || '')}.</p>
          <button class="btn primary" data-act="voicemail">${S.vmPlayed ? 'Play again' : 'Play the message'}</button>
        </div>
      </div>
      ${S.vmPlayed ? `
        <div class="paper" style="--r:-.6deg">
          <span class="stamp press" style="float:right">Case closed</span>
          <p class="closed-head">${esc(r.headline)}</p>
          ${r.lines.map(l => `<p class="typed" style="font-size:19px;margin:6px 0">${esc(l)}</p>`).join('')}
        </div>
        <p class="marker" style="font-size:24px;color:var(--cream);margin-top:24px">Tell the story.</p>
        <div class="rec-row">
          ${r.photos.map((p, i) => `<div class="polaroid" style="--r:${tilt(i)}"><div class="ph">${photo(p.img, p.stamp)}${p.baked ? '' : `<span class="datestamp">${esc(p.stamp)}</span>`}</div></div>`).join('')}
        </div>
        <div class="paper lined" style="--r:.8deg;margin-top:26px">
          <p class="marker" style="margin-top:0">Exit ticket</p>
          <p class="typed">One fact: There is / There are …</p>
          <p class="typed">One question: Is / Does … ?</p>
          <p class="typed">What changes your theory?</p>
        </div>` : ''}
    </section>`;
  }

  // ---------- Modales ----------
  function openEvidence(id) {
    const e = C.evidence[id];
    const isKey = S.keyFacts.includes(id);
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `
      <div class="paper ev ${e.kind}" role="dialog" aria-modal="true" aria-label="${esc(e.title)}">
        <div class="no">${esc(id)}</div>
        ${e.img ? `<div class="ev-img">${photo(e.img, e.title)}</div>` : ''}
        <h3>${esc(e.title)}</h3>
        ${e.lines.map(l => `<p>${esc(l)}</p>`).join('')}
        <div class="row" style="margin-top:18px">
          <button class="btn primary" data-m="key">${isKey ? 'Remove key fact' : 'Mark as key fact'}</button>
          <button class="btn" data-m="close">Close</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.addEventListener('click', (ev) => { if (ev.target === m) close(); });
    m.querySelector('[data-m="close"]').onclick = close;
    m.querySelector('[data-m="key"]').onclick = () => {
      if (isKey) S.keyFacts = S.keyFacts.filter(x => x !== id);
      else { S.keyFacts.push(id); if (S.keyFacts.length > 2) toast('Only two key facts! Choose the best two.'); }
      save(); close(); render();
    };
    m.querySelector('[data-m="close"]').focus();
  }

  function askHypothesis() {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `
      <div class="paper" role="dialog" aria-modal="true">
        <p class="marker" style="margin-top:0;font-size:24px">New evidence!</p>
        <p class="typed">Before you read it: who moves the prototype? How sure are you?</p>
        <div class="opts" style="margin:12px 0">${C.suspects.map(s => `<label><input type="radio" name="h" value="${s.id}"><span>${esc(s.name)}</span></label>`).join('')}</div>
        <div class="opts">${[1, 2, 3].map(n => `<label><input type="radio" name="c" value="${n}"><span>${'●'.repeat(n)}${'○'.repeat(3 - n)}</span></label>`).join('')}</div>
        <div class="row" style="margin-top:16px"><button class="btn primary" data-m="ok">Open the envelope</button></div>
      </div>`;
    document.body.appendChild(m);
    m.querySelector('[data-m="ok"]').onclick = () => {
      const h = m.querySelector('input[name="h"]:checked'); const c = m.querySelector('input[name="c"]:checked');
      if (!h || !c) { toast('Choose a person and how sure you are.'); return; }
      S.hypotheses.push({ after: askedCount(), person: h.value, sure: Number(c.value) });
      save(); m.remove(); S.tab = 'evidence'; save(); render();
    };
  }

  // ---------- Lógica del interrogatorio ----------
  function ask() {
    const s = suspectById[currentSuspect];
    const key = [build.starter, build.subject, build.ending].join('|');
    const match = s.qa.find(q => q.q.join('|') === key);
    if (!match) {
      const elsewhere = allQA.find(q => q.q.join('|') === key);
      const sameRest = allQA.find(q => q.q[1] === build.subject && q.q[2] === build.ending);
      if (elsewhere) toast(`${s.name.split(' ')[0]} can't answer that. Ask another person.`);
      else if (sameRest) toast(sameRest.q[0] === 'Does' ? 'Check the start: action or routine → Does.' : sameRest.q[0] === 'Is there' ? 'Check the start: does it exist? → Is there.' : 'Check the start: place or thing → Is.');
      else toast('That question is not in the file. Try other words.');
      return;
    }
    if (S.asked.some(a => a.id === match.id)) { toast('You have this tape. Check your log.'); return; }
    if (tapesLeft() <= 0) { toast('No more tapes.'); return; }
    const before = lockedBatches().length;
    S.asked.push({ id: match.id, yn: null, fact: '' });
    pending = { id: match.id, logged: false };
    build = { starter: null, subject: null, ending: null, said: false };
    save(); render();
    playAnswer(qaById[match.id]);
    if (lockedBatches().length < before) setTimeout(() => toast('A sealed envelope is open. Check your evidence.'), 2500);
  }
  function playAnswer(q) {
    const rec = document.getElementById('recorder');
    play({ src: q.audio, text: q.a, voice: q.suspect.voice }, () => rec && rec.classList.add('playing'), () => { const r = document.getElementById('recorder'); r && r.classList.remove('playing'); });
  }

  // ---------- Veredicto ----------
  function submitVerdict(form) {
    const f = new FormData(form);
    const person = f.get('person'); const place = f.get('place'); const lie = f.get('lie'); const proofs = f.getAll('proof');
    if (!person || !place || !lie || proofs.length !== 2) { toast('Choose a person, a place, exactly two pieces of evidence and the answer that is not true.'); return; }
    const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
    const validPair = [...(SOL.personProofs || []), ...(SOL.placeProofs || [])].some(p => same(p, proofs));
    const ok = person === SOL.person && place === SOL.place && lie === SOL.lie && validPair;
    const code = [person[0].toUpperCase(), place.split(' ').map(w => w[0]).join('').toUpperCase(), ...proofs.map(p => p.replace('E-', ''))].join('-');
    S.verdictTries += 1;
    S.verdict = { person, place, lie, proofs, ok, code };
    if (!ok && S.verdictTries >= C.maxVerdictTries) S.verdictLocked = true;
    save(); render();
    if (!ok && !S.verdictLocked) toast('Not enough. Check the times and the key cards.');
  }

  // ---------- Eventos ----------
  function bind() {
    app.querySelectorAll('[data-team]').forEach(b => b.onclick = () => {
      team = b.dataset.team; history.replaceState({}, '', `?case=${caseId}&team=${team}`); S = fresh(); load(); render();
    });
    app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go({ stage: b.dataset.go }));

    // Linterna
    const flash = document.getElementById('flash');
    if (flash) {
      const move = (ev) => {
        const r = flash.getBoundingClientRect();
        const p = ev.touches ? ev.touches[0] : ev;
        flash.style.setProperty('--x', `${((p.clientX - r.left) / r.width) * 100}%`);
        flash.style.setProperty('--y', `${((p.clientY - r.top) / r.height) * 100}%`);
        flash.style.setProperty('--rad', `${Math.max(90, r.width * 0.22)}px`);
      };
      flash.addEventListener('pointermove', move);
      flash.addEventListener('pointerdown', move);
      if (S.unlocked) flash.classList.add('lit');
    }
    app.querySelectorAll('[data-dial]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.dial);
      dialValues[i] = (dialValues[i] + Number(b.dataset.step) + 10) % 10;
      b.parentElement.querySelector('.num').textContent = dialValues[i];
    });
    const openLock = app.querySelector('[data-act="open-lock"]');
    if (openLock) openLock.onclick = () => {
      const lock = document.getElementById('lock');
      if (CODES.includes(dialValues.join(''))) {
        lock.classList.add('open');
        document.getElementById('flash')?.classList.add('lit');
        if (!S.unlocked) toast('Click. The evidence locker is open.');
        S.unlocked = true; save();
        setTimeout(() => go({ stage: 'desk', tab: 'evidence' }), 1100);
      } else {
        lock.classList.remove('shake'); void lock.offsetWidth; lock.classList.add('shake');
        toast(C.scene.hint);
      }
    };

    // Escritorio
    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { pending = pending && pending.logged ? null : pending; go({ tab: b.dataset.tab }); });
    app.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => openEvidence(b.dataset.ev));
    app.querySelectorAll('[data-tl]').forEach(t => t.oninput = () => { S.timeline[t.dataset.tl] = t.value; save(); });
    app.querySelectorAll('[data-hunch]').forEach(c => c.onchange = () => {
      S.hunches = c.checked ? [...S.hunches, c.dataset.hunch] : S.hunches.filter(x => x !== c.dataset.hunch);
      if (S.hunches.length > 2) toast('Two suspects only.');
      save();
    });

    // Interrogatorio
    app.querySelectorAll('[data-suspect]').forEach(b => b.onclick = () => { currentSuspect = b.dataset.suspect; build.ending = null; build.said = false; if (pending && pending.logged) pending = null; render(); });
    app.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { build[b.dataset.pick] = b.dataset.word; build.said = false; render(); });
    app.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => { build[b.dataset.clear] = null; build.said = false; render(); });
    const said = app.querySelector('[data-said]');
    if (said) said.onchange = () => { build.said = said.checked; render(); };
    const clear = app.querySelector('[data-act="clear"]');
    if (clear) clear.onclick = () => { build = { starter: null, subject: null, ending: null, said: false }; render(); };
    const askBtn = app.querySelector('[data-act="ask"]');
    if (askBtn) askBtn.onclick = ask;
    const replay = app.querySelector('[data-act="replay"]');
    if (replay) replay.onclick = () => pending && playAnswer(qaById[pending.id]);
    app.querySelectorAll('[data-yn]').forEach(b => b.onclick = () => {
      const row = S.asked.find(a => a.id === pending.id);
      row.yn = b.dataset.yn === '1';
      const q = qaById[pending.id];
      pending.logged = true; save();
      const team_ = C.teams[team];
      render();
      toast(row.yn === q.yes ? 'Logged. Now write one new fact.' : 'Listen again: is it Yes or No?');
      // Modo solo: nueva tanda → hipótesis antes de abrir
      if (team_.batches && S.seenBatches < team_.batches.filter(bt => askedCount() >= bt.after).length) {
        S.seenBatches += 1; save(); setTimeout(askHypothesis, 900);
      }
    });
    app.querySelectorAll('[data-fact]').forEach(inp => inp.oninput = () => { S.asked[Number(inp.dataset.fact)].fact = inp.value; save(); });

    // Veredicto
    const vf = document.getElementById('verdict');
    if (vf) vf.onsubmit = (e) => { e.preventDefault(); submitVerdict(vf); };
    const tb = app.querySelector('[data-act="teacher"]');
    if (tb) tb.onclick = () => {
      if (document.getElementById('tcode').value.trim() === TEACHER) go({ stage: 'reveal', revealOpen: true });
      else toast('That is not the teacher code.');
    };

    // Revelación
    const vm = app.querySelector('[data-act="voicemail"]');
    if (vm) vm.onclick = () => {
      const am = document.getElementById('am');
      play({ src: C.reveal.voicemail.audio, text: C.reveal.voicemail.text, voice: { female: false, pitch: 1, rate: 0.9 } },
        () => am && am.classList.add('played'),
        () => { if (!S.vmPlayed) { S.vmPlayed = true; save(); render(); } });
    };
  }

  // Volver al inicio con doble toque en la etiqueta (para el docente)
  document.addEventListener('dblclick', (e) => {
    if (e.target.closest('.desk-head .dymo') && confirmReset()) { S = fresh(); save(); render(); }
  });
  function confirmReset() { return window.confirm('Reset this device for a new team?'); }

  render();
})();
