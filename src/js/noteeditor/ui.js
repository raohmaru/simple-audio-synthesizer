import $ from '../util/dom.js';
import distortionCurves from '../distortionCurves/index.js';
import impulses from '../impulses/index.js';

let sas;
let note;
let audioCtx;
let	audioForm = $('#audioForm');
let playSound;
const biquadParamsByType = {
	lowpass  : {q: true,  gain: false},
	highpass : {q: true,  gain: false},
	bandpass : {q: true,  gain: false},
	lowshelf : {q: false, gain: true},
	highshelf: {q: false, gain: true},
	peaking  : {q: true,  gain: true},
	notch    : {q: true,  gain: false},
	allpas   : {q: true,  gain: false}
};
const impulseDuration = 3.0186041666666665;

function getActionObj(el) {
	const action = el.dataset.action;
	if(!action) {
		return null;
	} else if(action.indexOf('.') !== -1) {
		const [nodeName, aparam] = action.split('.');
		let node = note.nodes[nodeName];
		if (!node) {
			return null;
		}
		return node[aparam];
	} else {
		return eval(action);
	}
}

function setDefaultValues() {
	// Enable/Disable nodes
	$('input[type="checkbox"][id$="enable"]').forEach(el => {
		const node = note.nodes[el.dataset.node];
		if (node) {
			node.enabled = el.checked;
		}
		if(el.checked && el.dataset.action) {
			if (!node) {
				note.addNodeByType(el.dataset.node);
			}
			getActionObj(el)();
		}

		if (!el.checked) {
			enableFields(el.dataset.node, false);
		}
	});

	// Set values from input ranges
	$('input[type="range"]').forEach(el => {
		const action = getActionObj(el);
		if(action instanceof AudioParam) {
			action.setValueAtTime(el.value, audioCtx.currentTime);
		}
	});

	setWave();
	setEnvelope();
	setMasterVolume();
	if(note.nodes.distortion && note.nodes.distortion.enabled) {
		setDistorsion();
	}
	if(note.nodes.biquadFilter) {
		setBiquadType();
	}
}

function resetForm() {
	// Executed after the form is reset
	setTimeout(() => {
		setDefaultValues();
		audioForm.dispatchEvent(new Event("afterreset"));
	}, 0);
}

function selectListener(obj) {
	let cb = () => {
		const handler = getActionObj(obj);
		if(handler) {
			handler.call(obj, obj);
		}
	}
	obj.addEventListener('change', e => {
		cb(e);
		playSound();
	});
	audioForm.addEventListener('afterreset', cb);
}

function stepListener(obj) {
	let output = document.getElementById(obj.id + '-output');
	output.value = obj.value;

	obj.addEventListener('input', e => {
		output.value = e.target.value;
	});

	obj.addEventListener('change', e => {
		const handler = getActionObj(obj);
		if(handler instanceof AudioParam) {
			handler.setValueAtTime(e.target.value, audioCtx.currentTime);
		} else if(handler) {
			handler.call(e.target, e);
		}
		playSound();
	});

	audioForm.addEventListener('afterreset', () => {
		output.value = obj.value;
	});
}

function enableFields(nodeName, enabled) {
	$(`#${nodeName}-set input[type="range"], #${nodeName}-set select`).forEach(o => {
		if (enabled) {
			o.removeAttribute('disabled');
		} else {
			o.setAttribute('disabled', true);
		}
	});
}

function enableNodeListener(obj, nodeName) {
	obj.addEventListener('change', e => {
		let node = note.nodes[nodeName];
		if (e.target.checked && !node) {
			node = note.addNodeByType(nodeName);
		}
		if (node) {
			node.enabled = e.target.checked;
			if (node.enabled) {
				const action = getActionObj(obj);
				action && action();
			}
		}
		playSound();
		enableFields(nodeName, e.target.checked);
	});
}

function setWave() {
	note.type = $('#oscillatorType').value;
	note.freq = $('#frequency').value;
	note.freqDetune = $('#detune').value;

	$('#frequency').disabled = note.type === 'noise';
	$('#detune').disabled = note.type === 'noise';
}

function setMasterVolume() {
	sas.masterVolume = $('#volume').value;
}

function getEnvelope() {
	return [
		parseFloat($('#attack').value),
		parseFloat($('#decay').value),
		parseFloat($('#sustain').value),
		parseFloat($('#release').value)
	];
}

function setDistorsion() {
	const idx = parseInt($('#distortion-curve').value, 10);
	const curve = distortionCurves[idx](
		parseInt($('#distortion').value, 10),
		$('#frequency').value
	);
	const oversample = $('#oversample').value;  // Values: 'none', '2x', '4x'
	note.setDistortion(curve, oversample);
}

function setEnvelope() {
	note.setEnvelope(...getEnvelope(), $('#sustainlevel').value);
}

function setBiquadType() {
	if (note.nodes.biquadFilter) {
		let selBiquadType = $('#biquad-type'),
			params = biquadParamsByType[selBiquadType.value];
		note.nodes.biquadFilter.type = selBiquadType.value;
		$('#biquad-q').disabled = !params.q;
		$('#biquad-gain').disabled = !params.gain;
	}
}

function createReverb() {  // eslint-disable-line no-unused-vars
	const selImpulse = $('#reverb-impulse');
	let impulse;
	switch (selImpulse.value) {
		case "0":
			impulse = 'white_noise';
			break;
		default:
			impulse = impulses[selImpulse.value - 1];
			break;
	}
	note.addReverb(impulse, impulseDuration);
}

function init(theSas, playFunc) {
	sas = theSas;
	note = sas.notes[0];
	audioCtx = sas.context;
	playSound = playFunc;

	audioForm.addEventListener('reset', resetForm);

	$('select').forEach(el => selectListener(el));

	$('input[type="range"]').forEach(el => stepListener(el));

	$('input[type="checkbox"][id$="enable"]').forEach(el => {
		enableNodeListener(el, el.dataset.node);
	});

	$('[data-toggle]').forEach(el => {
		el.addEventListener('click', () => {
			$(el.dataset.toggle)[0].classList.toggle('hide');
		});
	});

	setDefaultValues();
}

export default {
	init
};
