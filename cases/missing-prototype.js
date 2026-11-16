// Caso: The Missing Prototype (chapTR · Foundations · U1 · Escena 3 · Parte B)
// Todo el contenido del caso vive acá. El motor (app.js) es genérico: para otro
// caso, copiar este archivo, cambiar los datos y abrir ?case=<id>.
// La solución está codificada en base64 solo para que no se lea a simple vista.

window.CASES = window.CASES || {};
window.CASES['missing-prototype'] = {
  id: 'missing-prototype',
  number: 'Case 02',
  title: 'The Missing Prototype',
  place: 'Halden Studio',
  subtitle: 'chapTR · Foundations · Unit 1 · Scene 3',

  briefing: [
    'Every Thursday at 6:20, the prototype is not on its base.',
    'Every Friday at 11:00, it is there again.',
    'It is not a crime. It is a mystery.',
  ],
  questions: ['Who moves it?', 'Where is it on Thursday night?'],
  briefingPhotos: [
    { img: 'assets/images/base-empty.jpg', stamp: 'THU 6:20' },
    { img: 'assets/images/base-full.jpg', stamp: 'FRI 11:00' },
  ],

  // Inspección: la foto del estudio y el candado de 3 cifras.
  // El código tiene que coincidir con la imagen final (2 vasos, 3 plantas, 1 lámpara).
  scene: {
    img: 'assets/images/studio.jpg',
    prompt: ['There is ___ .', 'There are ___ .', 'The base is ___ .'],
    code: 'MjMx', // "231" en base64
    altCodes: ['MjQx'], // "241": hay una cuarta planta detrás del vidrio, afuera; se acepta si la cuentan
    hint: 'Count again. Cups? Plants? Lamps?',
  },

  // Línea de tiempo del tablero
  timeline: ['6:05', '6:10', '6:12', '6:20', 'Fri 9:00', 'Fri 11:00'],

  // Evidencia. `kind` define cómo se dibuja el objeto.
  evidence: {
    'E-02': { team: 'A', kind: 'log', title: 'Security log — Thursday', lines: ['6:05 — Leo checks the studio. The prototype is on the base.', '6:20 — The base is empty.'] },
    'E-03': { team: 'A', kind: 'tape', title: 'Door log — Thursday', lines: ['6:12 — The meeting room door opens.', 'Key card: 07'] },
    'E-04': { team: 'A', kind: 'bag', title: 'Red fiber', lines: ['There is a red fiber on a chair next to the base.', 'Maya has a red bag.'] },
    'E-05': { team: 'B', kind: 'memo', title: 'Staff routines', lines: ['Maya works in the studio every day. She leaves at 6:10.', 'Leo checks every room at 6:05.', 'Nora works late on Thursdays. She prepares the meeting room for client demos.'] },
    'E-06': { team: 'B', kind: 'map', title: 'Place map', lines: ['The studio is next to the meeting room.', 'The meeting room is on the left.', 'The storage room is far from the studio, near the exit.'] },
    'E-07': { team: 'B', kind: 'photo', title: 'The floor', lines: ['There are new wheel marks on the floor.', 'They start at the base. They go to the left.'], img: 'assets/images/wheel-marks.jpg' },
    'E-08': { team: 'C', kind: 'cards', title: 'Key card list', lines: ['Card 03 — Maya Chen', 'Card 05 — Leo Martins (all rooms)', 'Card 07 — Nora Blake'] },
    'E-09': { team: 'C', kind: 'note', title: 'A note on a desk (no name)', lines: ['Friday, 9:00 — client demo.', 'Meeting room.', 'Bring the prototype in the black case.', 'Do not tell the team.'] },
    'E-10': { team: 'C', kind: 'calendar', title: 'Studio calendar', lines: ['Every Friday:', '9:00 — CLIENT DEMO'] },
  },

  // Equipos. `solo` libera la evidencia en tandas según preguntas hechas.
  teams: {
    A: { label: 'Team A · Times', evidence: ['E-02', 'E-03', 'E-04'] },
    B: { label: 'Team B · Routines & Places', evidence: ['E-05', 'E-06', 'E-07'] },
    C: { label: 'Team C · Objects & Messages', evidence: ['E-08', 'E-09', 'E-10'] },
    '1': { label: 'Team 1 (4 students)', evidence: ['E-02', 'E-03', 'E-04', 'E-05'] },
    '2': { label: 'Team 2 (4 students)', evidence: ['E-08', 'E-09', 'E-10', 'E-06', 'E-07'] },
    solo: { label: 'Solo detective', batches: [
      { after: 0, evidence: ['E-02', 'E-03', 'E-04'] },
      { after: 2, evidence: ['E-05', 'E-06', 'E-07'] },
      { after: 4, evidence: ['E-08', 'E-09', 'E-10'] },
    ] },
  },

  // Interrogatorio
  questionBudget: 6,
  starters: ['Is', 'Does', 'Is there'],
  subjects: ['Leo', 'Maya', 'Nora', 'the prototype', 'the storage room', 'the meeting room', 'this fiber', 'a client demo'],
  suspects: [
    { id: 'maya', name: 'Maya Chen', role: 'Product designer', img: 'assets/images/maya.jpg', voice: { pitch: 1.15, rate: 0.85, female: true },
      qa: [
        { id: 'M1', q: ['Does', 'Leo', 'check the studio every day?'], a: 'Yes, he does. He checks it at six oh five.', yes: true, audio: 'assets/audio/maya-1.mp3' },
        { id: 'M2', q: ['Is', 'this fiber', 'from your bag?'], a: 'Yes, it is. My chair is next to the base. I sit there every day.', yes: true, audio: 'assets/audio/maya-2.mp3' },
        { id: 'M3', q: ['Does', 'Nora', 'work late on Thursdays?'], a: 'Yes, she does. She is here until eight.', yes: true, audio: 'assets/audio/maya-3.mp3' },
        { id: 'M4', q: ['Is', 'the meeting room', 'open on Thursday night?'], a: "No, it isn't. You need a key card.", yes: false, audio: 'assets/audio/maya-4.mp3' },
      ] },
    { id: 'leo', name: 'Leo Martins', role: 'Security technician', img: 'assets/images/leo.jpg', voice: { pitch: 0.8, rate: 0.85, female: false },
      qa: [
        { id: 'L1', q: ['Is', 'the prototype', 'on the base at six oh five?'], a: 'Yes, it is. I see it every Thursday at six oh five.', yes: true, audio: 'assets/audio/leo-1.mp3' },
        { id: 'L2', q: ['Does', 'Maya', 'leave at six ten?'], a: 'Yes, she does. She leaves at six ten every day.', yes: true, audio: 'assets/audio/leo-2.mp3' },
        { id: 'L3', q: ['Is', 'the storage room', 'empty on Thursday night?'], a: 'Yes, it is. I check it at six thirty. It is empty.', yes: true, audio: 'assets/audio/leo-3.mp3' },
        { id: 'L4', q: ['Does', 'Nora', 'have a key card?'], a: 'Yes, she does. Card seven.', yes: true, audio: 'assets/audio/leo-4.mp3' },
      ] },
    { id: 'nora', name: 'Nora Blake', role: 'Event coordinator', img: 'assets/images/nora.jpg', voice: { pitch: 1.0, rate: 0.85, female: true },
      qa: [
        { id: 'N1', q: ['Is there', 'a client demo', 'on Friday?'], a: 'Yes, there is. At nine, in the meeting room.', yes: true, audio: 'assets/audio/nora-1.mp3' },
        { id: 'N2', q: ['Does', 'Maya', 'use the prototype?'], a: 'Yes, she does. She works with it every day.', yes: true, audio: 'assets/audio/nora-2.mp3' },
        { id: 'N3', q: ['Does', 'Leo', 'have the storage room key?'], a: 'Yes, he does. Only Leo.', yes: true, audio: 'assets/audio/nora-3.mp3' },
        { id: 'N4', q: ['Is', 'the prototype', 'in the meeting room on Thursday night?'], a: "No, it isn't. It is in the storage room.", yes: false, audio: 'assets/audio/nora-4.mp3' },
      ] },
  ],
  // false = todavía no están los mp3 nuevos: la app usa la voz del navegador.
  audioReady: true,

  // Veredicto
  places: ['Design studio', 'Meeting room', 'Storage room'],
  // Solución en base64 (JSON). Ver README para editarla.
  solution: 'eyJwZXJzb24iOiJub3JhIiwicGxhY2UiOiJNZWV0aW5nIHJvb20iLCJsaWUiOiJONCIsInBlcnNvblByb29mcyI6W1siRS0wMyIsIkUtMDgiXSxbIkUtMDMiLCJMNCJdXSwicGxhY2VQcm9vZnMiOltbIkUtMDYiLCJFLTA3Il0sWyJFLTA5IiwiRS0xMCJdLFsiTDMiLCJFLTA3Il1dfQ==',
  maxVerdictTries: 2,
  teacherCode: 'NzMxOQ==', // "7319"

  reveal: {
    voicemail: { audio: 'assets/audio/client-voicemail.mp3', text: "Hi Nora, it's Sam from Bright Labs. See you tomorrow at nine, in the meeting room. Please bring the prototype in the black case. And please — do not tell the team yet. Thank you!" },
    headline: 'Nora moves the prototype.',
    lines: ['It is in the meeting room, in the black case.', 'The red fiber is a false clue.', "Nora's answer is not true."],
    photos: [
      { img: 'assets/images/rec-605.jpg', stamp: '6:05', baked: true },
      { img: 'assets/images/rec-610.jpg', stamp: '6:10', baked: true },
      { img: 'assets/images/rec-612.jpg', stamp: '6:12', baked: true },
      { img: 'assets/images/rec-620.jpg', stamp: '6:20', baked: true },
    ],
  },
};
