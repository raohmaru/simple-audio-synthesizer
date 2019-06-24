import SAS from './sasynth.js';
import distortionCurves from './distortionCurves.js';
import impulses from './impulses/index.js';

let sas;
let note;
let audioCtx;

function getActionObj(el) {
	const action = el.dataset.action;
	if(!action) {
		return null;
	} else if(action.indexOf('.') !== -1) {
		const [node, aparam] = action.split('.');
		return note.nodes[node][aparam];
	} else {
		return eval(action);
	}
}

function setDefaultValues() {
	// Enable/Disable nodes
	[].slice.apply(document.querySelectorAll('input[type="checkbox"][id$="enable"]'))
		.forEach(el => {
			const node = note.nodes[el.dataset.node];
			node.enabled = el.checked
			if(node.enabled && el.dataset.action) {
				getActionObj(el)();
			}
		});

	// Set values from input ranges
	[].slice.apply(document.querySelectorAll('input[type="range"]'))
		.forEach(el => {
			const action = getActionObj(el);
			if(action && action instanceof AudioParam) {
				action.setValueAtTime(el.value, audioCtx.currentTime);
			}
		});

	// Initial volume
	note.nodes.envelope.gain.value = 1;

	// Size of the Fast Fourier Transform. Must be a power of 2 between 2^5 and 2^15. Defaults to 2048.
	// (32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, and 32768.)
	note.nodes.analyser.fftSize = 2048;

	// Controls whether the impulse response from the buffer will be scaled by an equal-power normalization.
	note.nodes.reverb.normalize = true;

	setWave();
	setEnvelope();
	setDistorsion();
}

function playSound(viz = true) {
	console.log(`Playing sound for ${sas.duration}s`);
	const promise = sas.play();
	promise.then(stopSound);
	if(viz) {
		visualize();
	}
	btnToggleAudio.value = "Stop";
	return promise;
}

function stopSound() {
	console.log('Sound stop');
	sas.stop();
	window.cancelAnimationFrame(rafID);
	window.setTimeout(resetVisualization, 0);
	btnToggleAudio.value = "Play";
}

function getEnvelope() {
	return [
		parseFloat(document.getElementById('attack').value),
		parseFloat(document.getElementById('decay').value),
		parseFloat(document.getElementById('sustain').value),
		parseFloat(document.getElementById('release').value)
	];
}


function createReverb() {
	const selImpulse = document.getElementById('reverb-impulse');
	let impulse;
	switch (selImpulse.value) {
		case "0":
			impulse = 'noise';
			break;
		default:
			impulse = impulses[selImpulse.value - 1];
			break;
	}
	note.addReverb(impulse);
}

// Visualization ///////////////////////////////////////////////////////////////////////////////////
let canvas;
let canvasCtx;
let bufferLength;
let dataArray;
let rafID;
let WIDTH;
let HEIGHT;
let HEIGHT_2;

function initViz() {
	canvas = document.getElementById('canvas');
	canvasCtx = canvas.getContext('2d');
	WIDTH = canvas.width;
	HEIGHT = canvas.height;
	HEIGHT_2 = HEIGHT / 2;

	canvasCtx.fillStyle = 'rgb(0, 200, 200)';
	canvasCtx.lineWidth = 2;
	canvasCtx.strokeStyle = 'rgb(255, 255, 255)';
}

function visualize() {
	bufferLength = note.nodes.analyser.frequencyBinCount; // half the FFT value
	dataArray = new Uint8Array(bufferLength); // create an array to store the data
	draw();
}

function draw() {
	rafID = window.requestAnimationFrame(draw);

	note.nodes.analyser.getByteTimeDomainData(dataArray); // get waveform data and put it into the array created above

	canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
	canvasCtx.beginPath();

	let sliceWidth = WIDTH * 1.0 / bufferLength,
		x = 0,
		v,
		y;

	for(let i = 0; i < bufferLength; i++) {
		v = dataArray[i] / 128.0;
		y = v * HEIGHT_2;

		if(i === 0) {
			canvasCtx.moveTo(x, y);
		} else {
			canvasCtx.lineTo(x, y);
		}

		x += sliceWidth;
	}

	canvasCtx.lineTo(WIDTH, HEIGHT_2);
	canvasCtx.stroke();
}

function resetVisualization() {
	canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
	canvasCtx.beginPath();
	canvasCtx.moveTo(0, HEIGHT_2);
	canvasCtx.lineTo(WIDTH, HEIGHT_2);
	canvasCtx.stroke();
}


// UI //////////////////////////////////////////////////////////////////////////////////////////////
let	audioForm          = document.getElementById('audioForm'),
	btnToggleAudio     = document.getElementById('toggleAudio'),
	btnExport          = document.getElementById('export'),
	btnProcess         = document.getElementById('process'),
	biquadParamsByType = {
		lowpass  : {q: true,  gain: false},
		highpass : {q: true,  gain: false},
		bandpass : {q: true,  gain: false},
		lowshelf : {q: false, gain: true},
		highshelf: {q: false, gain: true},
		peaking  : {q: true,  gain: true},
		notch    : {q: true,  gain: false},
		allpas   : {q: true,  gain: false}
	};

function initUI() {
	audioForm.addEventListener('reset', resetForm);
	btnToggleAudio.addEventListener('click', toggleAudio);
	btnExport.addEventListener('click', exportAudio);
	btnProcess.addEventListener('click', processAudio);
	canvas.addEventListener('click', toggleAudio);

	[].slice.apply(document.querySelectorAll('select'))
		.forEach(el => selectListener(el, getActionObj(el)));

	[].slice.apply(document.querySelectorAll('input[type="range"]'))
		.forEach(el => stepListener(el, getActionObj(el)));

	[].slice.apply(document.querySelectorAll('input[type="checkbox"][id$="enable"]'))
		.forEach(el => {
			enableNodeListener(el, note.nodes[el.dataset.node]);
		});

	setBiquadType();
}

function resetForm(e) {
	// Executed after the form is reset
	setTimeout(() => {
		setDefaultValues();
		audioForm.dispatchEvent(new Event("afterreset"));
	}, 0);
}

function selectListener(obj, handler) {
	let cb = e => {
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

function stepListener(obj, handler) {
	let output = document.getElementById(obj.id + '-output');
	output.value = obj.value;

	obj.addEventListener('input', e => {
		output.value = e.target.value;
	});

	obj.addEventListener('change', e => {
		if(handler instanceof AudioParam) {
			handler.setValueAtTime(e.target.value, audioCtx.currentTime);
		} else if(handler) {
			handler.call(e.target, e);
		}
		playSound();
	});

	audioForm.addEventListener('afterreset', e => {
		output.value = obj.value;
	});
}

function enableNodeListener(obj, handler) {
	obj.addEventListener('change', e => {
		handler.enabled = e.target.checked;
		playSound();
	});
}

function toggleAudio(e) {
	if(sas.state === 'running') {
		stopSound();
	} else {
		playSound();
	}
}

function setWave() {
	note.type = document.getElementById('oscillatorType').value;
	note.freq = document.getElementById('frequency').value;
	note.freqDetune = document.getElementById('detune').value;

	document.getElementById('frequency').disabled = note.type === 'noise';
	document.getElementById('detune').disabled = note.type === 'noise';
}

function setDistorsion(e) {
	const idx = parseInt(document.getElementById('distortion-curve').value, 10);
	let amount = parseInt(document.getElementById('distortion').value, 10);
	note.nodes.distortion.curve = distortionCurves[idx](
		amount,
		document.getElementById('frequency').value
	);
	note.nodes.distortion.oversample = document.getElementById('oversample').value;  // Values: 'none', '2x', '4x'
}

function setEnvelope(e) {
	note.setEnvelope(...getEnvelope(), document.getElementById('sustainlevel').value);
}

function setBiquadType(e) {
	let selBiquadType = document.getElementById('biquad-type'),
		params = biquadParamsByType[selBiquadType.value];
	note.nodes.biquadFilter.type = selBiquadType.value;
	document.getElementById('biquad-q').disabled = !params.q;
	document.getElementById('biquad-gain').disabled = !params.gain;
}

// Recording audio  ////////////////////////////////////////////////////////////////////////////////////////
let mediaStream;
let mediaRecorder;
const chunks = [];

function exportAudio() {
	btnExport.value = "Exporting...";
	btnExport.setAttribute('disabled', true);

	if(!mediaStream) {
		mediaStream = audioCtx.createMediaStreamDestination();
		mediaRecorder = new MediaRecorder(mediaStream.stream);
		mediaRecorder.ondataavailable = function(evt) {
			// push each chunk (blobs) in an array
			chunks.push(evt.data);
		};
		mediaRecorder.onstop = function(evt) {
			// Make blob out of our blobs, and open it.
			const blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
			const src = URL.createObjectURL(blob);
			window.open(src, 'sasynth-export');
			URL.revokeObjectURL(src);
			chunks.length = 0;
			// When the window loses the focus, AudioContext does not suspend right on (at least in Firefox)
			const onFocus = (e) => {
				sas.stop();
				window.removeEventListener('focus', onFocus);
			}
			window.addEventListener('focus', onFocus);
		};
	}
	mediaRecorder.start();
	sas.destination = mediaStream;
	playSound(false).then(() => {
		mediaRecorder.requestData();
		mediaRecorder.stop();
		sas.destination = audioCtx.destination;
		btnExport.value = "Export";
		btnExport.removeAttribute('disabled');
	});
}

// Process audio ////////////////////////////////////////////////////////////////////////////////////////
let audioCount = 0;

function processAudio() {
	const buffer = audioCtx.createBuffer(2, sas.duration * audioCtx.sampleRate, audioCtx.sampleRate);
	let currPos = 0;
	btnProcess.value = "Processing...";
	btnProcess.setAttribute('disabled', true);

	const scriptNode = audioCtx.createScriptProcessor(2048, 2, 2);
	scriptNode.onaudioprocess = function(audioProcessingEvent) {
		// Stores input buffer data into an AudioBuffer
		const inputBuffer = audioProcessingEvent.inputBuffer;
		for (let i=0; i < inputBuffer.numberOfChannels; i++) {
			buffer.getChannelData(i).set(inputBuffer.getChannelData(i), currPos);
		}
		currPos += inputBuffer.getChannelData(0).length;
	}
	// To process current audio we need to connect it
	sas.destination = scriptNode;

	playSound(false).then(() => {
		sas.destination = audioCtx.destination;
		scriptNode.disconnect();
		scriptNode.onaudioprocess = undefined;
		btnProcess.value = "Process";
		btnProcess.removeAttribute('disabled');

		const btn = document.createElement('span');
		btn.classList.add('audio-btn');
		btn.textContent = 'Audio ' + ++audioCount;
		btn.addEventListener('click', (e) => {
			// Once are played, AudioNode cannot be longer used, so each time a new AudioNode is created
			let source = audioCtx.createBufferSource();
			source.buffer = buffer;
			source.addEventListener('ended', (e) => {
				source.disconnect();
				audioCtx.suspend();
			});
			source.connect(audioCtx.destination);
			source.start(0);
			audioCtx.resume();
		});
		document.querySelector('.audios').appendChild(btn);
	});
}


// Release the Kraken with an electric guitar ///////////////////////////////////////////////////////
function init() {
	sas = new SAS();
	note = sas.createNote();
	audioCtx = sas.getContext();
	initViz();
	initUI();
	setDefaultValues();
	resetVisualization();
}

init();
