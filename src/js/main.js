import viz from './viz.js';
import ui from './ui.js';
import SAS from './lib/sasynth.js';
import $ from './dom.js';

let sas;
let note;
let audioCtx;

function setDefaultValues() {
	// Initial volume
	note.nodes.envelope.gain.value = 1;

	// Size of the Fast Fourier Transform. Must be a power of 2 between 2^5 and 2^15. Defaults to 2048.
	// (32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, and 32768.)
	sas.analyser.fftSize = 2048;

	// Controls whether the impulse response from the buffer will be scaled by an equal-power normalization.
	if (note.nodes.reverb) {
		note.nodes.reverb.normalize = true;
	}
}

function playSound(renderViz = true) {
	console.log(`Playing sound for ${sas.duration}s`);
	const promise = sas.play();
	promise.then(stopSound);
	if(renderViz) {
		viz.render();
	}
	btnToggleAudio.value = "Stop";
	showNoteCode();
	return promise;
}

function stopSound() {
	console.log('Sound stop');
	sas.stop();
	viz.stop();
	btnToggleAudio.value = "Play";
}

// Buttons actions
let btnToggleAudio     = $('#toggleAudio'),
	btnExport          = $('#export'),
	btnProcess         = $('#process'),
	codefield          = $('#codefield');

function initActions() {
	btnToggleAudio.addEventListener('click', toggleAudio);
	btnExport.addEventListener('click', exportAudio);
	btnProcess.addEventListener('click', processAudio);
	$('#canvas').addEventListener('click', toggleAudio);
}

function toggleAudio(e) {
	if(sas.state === 'running') {
		stopSound();
	} else {
		playSound();
	}
}

function showNoteCode() {
	const data = {
		type: note._type,
		freq: note._freq,
		envelope: note._envelope,
		envelopeSustainLevel: note._envelopeSustainLevel
	};
	let node;

	if (note._freqDetune) {
		data.freqDetune = note._freqDetune;
	}

	if(note.nodes.distortion && note.nodes.distortion.enabled) {
		node = note.nodes.distortion;
		const curve = $('#distortion-curve');
		data.distortion = {
			curve:      curve.options[curve.selectedIndex].textContent,
			amount:     parseInt($('#distortion').value, 10),
			oversample: node.oversample
		};
	}

	if(note.nodes.reverb && note.nodes.reverb.enabled) {
		node = note.nodes.reverb;
		const selImpulse = $('#reverb-impulse');
		data.reverb = selImpulse.options[selImpulse.selectedIndex].textContent;;
	}

	if(note.nodes.biquadFilter && note.nodes.biquadFilter.enabled) {
		data.biquadFilter = {
			type     : note.nodes.biquadFilter.type,
			detune   : $('#biquad-detune').value,
			frequency: $('#biquad-frequency').value,
			gain     : $('#biquad-gain').value,
			Q        : $('#biquad-q').value
		};
	}

	if(note.nodes.dynaCompr && note.nodes.dynaCompr.enabled) {
		node = note.nodes.dynaCompr;
		data.dynaCompr = {
			threshold: $('#dynacompr-threshold').value,
			knee     : $('#dynacompr-knee').value,
			ratio    : $('#dynacompr-ratio').value,
			attack   : $('#dynacompr-attack').value,
			release  : $('#dynacompr-release').value
		};
	}

	codefield.value = JSON.stringify(data);
}

// Recording audio
let mediaStream;
let mediaRecorder;
const chunks = [];

function saveBlob(blob, fileName) {
	const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
	a.href = url;
	a.download = fileName;
	a.click();
	window.URL.revokeObjectURL(url);
	document.body.removeChild(a);
};

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
			// https://wiki.whatwg.org/wiki/Video_type_parameters#Browser_Support
			// const blob = new Blob(chunks, { 'type': 'audio/ogg; codecs=opus' }); // Only works in FF
			// const blob = new Blob(chunks, { 'type': 'audio/wave; codec=1' }); // Generates a damaged file
			const blob = new Blob(chunks, { 'type': 'audio/webm; codecs=vorbis' }); // Seems to work in all browsers
			saveBlob(blob, 'audio.webm');
			chunks.length = 0;
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

// Processing audio
const sharedBuffers = [];
let scriptNode;
let writeIdx;

function processAudio() {
	btnProcess.value = "Processing...";
	btnProcess.setAttribute('disabled', true);

	// Newest browsers should support Audio Worklet
	if (audioCtx.audioWorklet && typeof audioCtx.audioWorklet.addModule === 'function') {
		if (!scriptNode) {
			audioCtx.audioWorklet.addModule('js/script-processor.js').then(() => {
				scriptNode = new AudioWorkletNode(audioCtx, 'script-processor');
				setupAudioWorklet();
			});
		} else {
			setupAudioWorklet();
		}
	// ScriptProcessor will be deprecated, but meanwhile...
	} else {
		const buffer = audioCtx.createBuffer(2, sas.duration * audioCtx.sampleRate, audioCtx.sampleRate);
		sharedBuffers.push(buffer);
		writeIdx = [0, 0];
		if (!scriptNode) {
			scriptNode = audioCtx.createScriptProcessor(2048, 2, 2);
		}
		scriptNode.onaudioprocess = onAudioScriptProcess;
		startAudioProcessing();
	}
}

function onAudioScriptProcess(audioProcessingEvent) {
	// Stores input buffer data into an AudioBuffer
	const buffer = sharedBuffers[sharedBuffers.length-1];
	const inputBuffer = audioProcessingEvent.inputBuffer;
	let inputChannelData;

	for (let i=0; i < inputBuffer.numberOfChannels; i++) {
		inputChannelData = inputBuffer.getChannelData(i);
		if (inputChannelData.length + writeIdx[i] < buffer.getChannelData(i).length) {
			buffer.getChannelData(i).set(inputChannelData, writeIdx[i]);
			writeIdx[i] += inputChannelData.length;
		} else {
			let splitIndex = buffer.length - writeIdx[i];
			let firstHalf = inputChannelData.subarray(0, splitIndex);
			buffer.getChannelData(i).set(firstHalf, writeIdx[i]);
			writeIdx[i] = buffer.length;
		}
	}
}

function setupAudioWorklet() {
	const bytelen = Math.round(sas.duration * audioCtx.sampleRate * Float32Array.BYTES_PER_ELEMENT);
	const sab = new SharedArrayBuffer(bytelen);
	sharedBuffers.push(new Float32Array(sab));
	// Send SharedArrayBuffer to processor
	scriptNode.port.postMessage({
		message: 'setup',
		buffer: sharedBuffers[sharedBuffers.length-1]
	});
	startAudioProcessing();
}

function startAudioProcessing() {
	// To process current audio we need to connect it
	sas.destination = scriptNode;
	scriptNode.connect(audioCtx.destination);

	playSound(false).then(() => {
		scriptNode.disconnect();
		sas.destination = audioCtx.destination;
		scriptNode.onaudioprocess = undefined;
		btnProcess.value = "Process";
		btnProcess.removeAttribute('disabled');

		const btn = document.createElement('span');
		btn.classList.add('audio-btn');
		btn.textContent = 'Audio ' + sharedBuffers.length;
		btn.dataset.idx = sharedBuffers.length - 1;
		btn.addEventListener('click', (e) => {
			let buffer = sharedBuffers[e.target.dataset.idx];
			// Using Audio Worklet?
			if(buffer instanceof Float32Array) {
				const audioBuffer = audioCtx.createBuffer(1, buffer.length, audioCtx.sampleRate);
				audioBuffer.getChannelData(0).set(buffer);
				buffer = audioBuffer;
				sharedBuffers[e.target.dataset.idx] = audioBuffer;
			}
			// Once played, AudioNode cannot be longer used, so each time a new AudioNode is created
			const source = audioCtx.createBufferSource();
			source.buffer = buffer;
			source.addEventListener('ended', (e) => {
				source.disconnect();
				audioCtx.suspend();
			});
			source.connect(audioCtx.destination);
			source.start(0);
			audioCtx.resume();
		});
		$('.audios')[0].appendChild(btn);
	});
}

// Release the Kraken with an electric guitar
function init() {
	sas = new SAS({analyse: true});
	note = sas.createNote();
	audioCtx = sas.context;
	viz.init($('#canvas'), sas.analyser);
	ui.init(sas, playSound);
	initActions();
	setDefaultValues();
	viz.reset();
}

init();
