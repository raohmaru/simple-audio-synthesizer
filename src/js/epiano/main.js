import SAS from '../lib/sasynth.js';
import Note from '../lib/note.js';
import $ from '../util/dom.js';
import viz from '../util/viz.js';
import distortionCurves from '../distortionCurves/index.js';

const freq = 50;
const curve = distortionCurves[1](5, freq, 0.5, 0.25); // karplus-strong
const defNoteParams = {
	"type": "sine",
	"freq": freq,
	"envelope": [
		0.06,
		0.1,
		0.1,
		0.9
	],
	// "volume": 0,
	"envelopeSustainLevel": 0.28,
	"distortion": {
		curve,
		"oversample": "4x"
	}
};

const notesParams = [
	{
		...defNoteParams
	},
	{
		...defNoteParams,
		freqDetune: 100
	},
	{
		...defNoteParams,
		freqDetune: 200
	},
	{
		...defNoteParams,
		freqDetune: 300
	},
	{
		...defNoteParams,
		freqDetune: 400
	},
	{
		...defNoteParams,
		freqDetune: 500
	}
];

const notes = []
const accessKeys = new Map();
const pressedKeys = {};
const letters = 'QWERTY';
let sas;
let $keys;

function playNote(i) {
	let note;
	if (!notes[i]) {
		note = new Note(sas, notesParams[i]);
		// notes[i] = note;
	} else {
		note = notes[i];
	}
	note.play().then(() => {
		note.destroy();
	});
}

function onKeyDown(e) {
	const key = e.key.toLowerCase();
	if (accessKeys.has(key) && !pressedKeys[key]) {
		const idx = accessKeys.get(key);
		$keys[idx].classList.add('key-btn--pressed');
		playNote(idx);
		pressedKeys[key] = true;
	}
}

function onKeyUp(e) {
	const key = e.key.toLowerCase();
	if (accessKeys.has(key)) {
		const idx = accessKeys.get(key);
		$keys[idx].classList.remove('key-btn--pressed');
		delete pressedKeys[key];
	}
}

function init() {
	sas = new SAS({ masterVolume: 1, analyse: true });
	let html = '';

	notesParams.forEach((params, i) => {
		const letter = letters[i];
		html += `<a href="#" class="key-btn" accesskey="${letter.toLowerCase()}">${letter}</a>`;
	});

	$('#keyboard').innerHTML = html;
	$keys = $('.key-btn');
	$keys.forEach((btn, i) => {
		btn.addEventListener('mousedown', () => playNote(i));
		accessKeys.set(btn.getAttribute('accesskey'), i);
	});

	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);

	viz.init($('#canvas'), sas.analyser);
	viz.render();
	sas.start();
}

init();
