import distortionCurves from './distortionCurves.js';
import impulses from './impulses/index.js';

let distortionCurveIdx;
let audioCtx;
let generatorNode;
let distortion;
let biquadFilter;
let gainNode;
let envelopeNode;
let reverbNode;
let dynacomprNode;
let analyser;
let audioNodes;
let timeoutID;
let whiteNoiseBuffer;
let recording;

function createNodes() {
	// Creating an audio context
	audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	audioCtx.suspend();
	// Non-linear distortion
	distortion = audioCtx.createWaveShaper();
	// Represent different kinds of filters, tone control devices, and graphic equalizers
	biquadFilter = audioCtx.createBiquadFilter();
	// Gain node node to control sound volume
	gainNode = audioCtx.createGain();
	// Gain node node to control sound envelope
	envelopeNode = audioCtx.createGain();
	// Represents a node able to provide real-time frequency and time-domain analysis information
	analyser = audioCtx.createAnalyser();
	// Performs a Linear Convolution on a given AudioBuffer, often used to achieve a reverb effect
	reverbNode = audioCtx.createConvolver();	
	// Performs a Linear Convolution on a given AudioBuffer, often used to achieve a reverb effect
	dynacomprNode = audioCtx.createDynamicsCompressor();	
	
	audioNodes = [
		undefined,  // generatorNode will go here
		 distortion
		,biquadFilter
		,gainNode
		,reverbNode
		,envelopeNode
		,dynacomprNode
		,analyser
	];
}

// Create an oscilator audio source that will provide a simple tone
// 
// Oscillators, by design, are only able to be started and stopped exactly once. This is actually
// better for performance, because it means they won’t be hanging around in memory waiting to be
// used when they don’t need to be.
// Luckily, oscillators are cheap and easy to make, so we create one every time the sound is played.
function addOscillatorOrNoiseNode() {
	let nodeType = document.getElementById('oscillatorType').value;
	if(generatorNode) {
		generatorNode.stop();
		generatorNode.disconnect();
	}
	
	if(nodeType !== 'noise') {
		generatorNode = audioCtx.createOscillator();
		// Sine wave — other values are 'square', 'sawtooth', 'triangle' and 'custom'
		generatorNode.type = nodeType;
		generatorNode.frequency.value = document.getElementById('frequency').value; // value in hertz. Default is 440
		generatorNode.detune.value = document.getElementById('detune').value; // value in cents. Default is 100
	} else {
		generatorNode = createWhiteNoise();
	}
	
	document.getElementById('frequency').disabled = nodeType === 'noise';
	document.getElementById('detune').disabled = nodeType === 'noise';
	
	audioNodes[0] = generatorNode;
	connectNodes();
	generatorNode.start();
}

// Linking source and destination nodes together
function connectNodes() {
	let enabledNodes = audioNodes.filter(node => node && (node.enabled || node.enabled === undefined));
	let dest = recording ? mediaStream : audioCtx.destination;
		
	for(let i=0; i<audioNodes.length; i++) {
		audioNodes[i] && audioNodes[i].disconnect();
	}
	
	for(let i=0; i<enabledNodes.length - 1; i++) {
		enabledNodes[i].connect(enabledNodes[i+1]);
	}
	enabledNodes[enabledNodes.length-1].connect(dest);
}

function setDefaultValues() {
	// Enable/Disable nodes nodes
	[].slice.apply(document.querySelectorAll('input[type="checkbox"][id$="enable"]'))
		.forEach(el => {
			let node = eval(el.dataset.node);
			node.enabled = el.checked
			if(node.enabled && el.dataset.action) {
				eval(el.dataset.action+'()');
			}
		});
	
	// Set values from input ranges
	[].slice.apply(document.querySelectorAll('input[type="range"]'))
		.forEach(el => {
			let aparam = eval(el.dataset.action);
			if(aparam instanceof AudioParam) {
				aparam.setValueAtTime(el.value, audioCtx.currentTime);
			}
		});	
		
	// Set values from selects
	[].slice.apply(document.querySelectorAll('select'))
		.forEach(el => {
			let node = eval(el.dataset.node);
			if(node) {
				node.enabled = el.checked
				if(node.enabled && el.dataset.action) {
					eval(el.dataset.action+'()');
				}
			}
		});
		
	distortionCurveIdx = document.getElementById('distortion-curve').value;
	
	// Describes the distortion to apply
	distortion.curve = distortionCurves[distortionCurveIdx](document.getElementById('distortion').value, document.getElementById('frequency').value);
	distortion.oversample = document.getElementById('oversample').value;  // Values: 'none', '2x', '4x'

	// Initial volume
	envelopeNode.gain.value = 1;	

	// Size of the Fast Fourier Transform. Must be a power of 2 between 2^5 and 2^15. Defaults to 2048.
	// (32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, and 32768.)
	analyser.fftSize = 2048;
	
	// Controls whether the impulse response from the buffer will be scaled by an equal-power normalization.
	reverbNode.normalize = true;
}

function playSound(viz = true) {
	let dur = getSoundDuration();
	if(audioCtx.state === 'running') {
		addOscillatorOrNoiseNode();
		setEnvelope();
	} else {
		audioCtx.resume().then(() => {
			addOscillatorOrNoiseNode();
			setEnvelope();
			if(viz) {
				visualize();
			}
			btnToggleAudio.value = "Stop";
		});
	}
	console.log(`Playing sound for ${dur}s`);
	
	return new Promise((resolve, reject) => {
		window.clearTimeout(timeoutID);
		timeoutID = window.setTimeout(() => {
			stopSound();
			resolve();
		}, dur * 1000);
	});
}

function stopSound() {
	window.clearTimeout(timeoutID);
	window.cancelAnimationFrame(rafID);
	audioCtx.suspend().then(() => {
		if(generatorNode) {
			generatorNode.stop();
			generatorNode.disconnect();
		}
		generatorNode = undefined;
		btnToggleAudio.value = "Play";
		resetVisualization();
	});
}

function getSoundDuration() {
	return getEnvelope().reduce((a, b) => a + b);
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
	let selImpulse = document.getElementById('reverb-impulse');
	switch (selImpulse.value) {
		case "0":
			reverbNode.buffer = buildImpulse(getSoundDuration(), 1, false);
			break;
		default:
			// Impulses are base64 encoded sounds stored at impulses/*.js
			let impulse = impulses[selImpulse.value - 1];
			// Duration of impulse in seconds
			const impulseDuration = 3.0186041666666665;
			let reverbSoundArrayBuffer = base64ToArrayBuffer(impulse),
				// Get numer of bytes per seconds and cut array buffer to a length in seconds
				reverbDuration = (reverbSoundArrayBuffer.byteLength/impulseDuration) * getSoundDuration() | 0,
				sliceOfReverbSoundArrayBuffer = reverbSoundArrayBuffer.slice(0, reverbDuration);
			audioCtx.decodeAudioData(sliceOfReverbSoundArrayBuffer,
				function(buffer) {
					reverbNode.buffer = buffer;
				},
				function(e) {
					console.log('Error when decoding audio reverb data ' + e.err);
				}
			)
			break;
	}
}

// https://noisehack.com/generate-noise-web-audio-api/
function createWhiteNoise() {
	const bufferSize = 2 * audioCtx.sampleRate;
	const sourceNode = audioCtx.createBufferSource();
	let output;
		
	if(!whiteNoiseBuffer) {
		whiteNoiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
		output = whiteNoiseBuffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			output[i] = Math.random() * 2 - 1;
		}
	}

	sourceNode.buffer = whiteNoiseBuffer;
	sourceNode.loop = true;
	return sourceNode;
}

// https://github.com/web-audio-components/simple-reverb/blob/master/index.js
function buildImpulse(seconds, decay, reverse) {
	var rate = audioCtx.sampleRate,
		len = rate * seconds,
		impulse = audioCtx.createBuffer(2, len, rate),
		impulseL = impulse.getChannelData(0),
		impulseR = impulse.getChannelData(1);

	for (let i = 0; i < len; i++) {
		let n = reverse ? len - i : i;
		impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, decay);
		impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, decay);
	}

	return impulse;
}

function base64ToArrayBuffer(base64) {
    let binaryString = window.atob(base64),
		len = binaryString.length,
		bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++)        {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}


// Visualization ///////////////////////////////////////////////////////////////////////////////////
let canvas = document.getElementById('canvas');
let canvasCtx = canvas.getContext('2d');
let bufferLength;
let dataArray;
let rafID;
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const HEIGHT_2 = HEIGHT / 2;
	  
canvasCtx.fillStyle = 'rgb(0, 200, 200)';
canvasCtx.lineWidth = 2;
canvasCtx.strokeStyle = 'rgb(255, 255, 255)';

function visualize() {
	bufferLength = analyser.frequencyBinCount; // half the FFT value
	dataArray = new Uint8Array(bufferLength); // create an array to store the data
	draw();
}

function draw() {
	rafID = window.requestAnimationFrame(draw);

	analyser.getByteTimeDomainData(dataArray); // get waveform data and put it into the array created above

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

resetVisualization();


// UI //////////////////////////////////////////////////////////////////////////////////////////////
let	audioForm          = document.getElementById('audioForm'),
	btnToggleAudio     = document.getElementById('toggleAudio'),
	btnExport          = document.getElementById('export'),
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
	canvas.addEventListener('click', toggleAudio);
	
	[].slice.apply(document.querySelectorAll('select'))
		.forEach(el => selectListener(el, eval(el.dataset.action)));
	
	[].slice.apply(document.querySelectorAll('input[type="range"]'))
		.forEach(el => stepListener(el, eval(el.dataset.action)));
	
	[].slice.apply(document.querySelectorAll('input[type="checkbox"][id$="enable"]'))
		.forEach(el => {
			enableNodeListener(el, eval(el.dataset.node));
			if(el.dataset.action) {
				eval(el.dataset.action+'()');
			}
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

function selectListener(obj, handler) {
	let cb = e => {		
		if(handler instanceof AudioNode) {
			handler.type = e.target.value;
		} else if(handler) {
			handler.call(obj, obj);
		}
	}
	obj.addEventListener('change', e => {
		cb(e);
		playSound();
	});
	audioForm.addEventListener('afterreset', cb);
}

function enableNodeListener(obj, handler) {
	obj.addEventListener('change', e => {
		if(handler instanceof AudioNode) {
			handler.enabled = e.target.checked;
		} else {
			handler.call(obj, obj.checked);
		}
		connectNodes();
		playSound();
	});
}

function toggleAudio(e) {
	if(audioCtx.state === 'running') {
		stopSound();
	} else {
		playSound();
	}
}

function setOversample(obj) {
	distortion.oversample = obj.value;
}

function setDistorsionAmount(e) {
	let amount = document.getElementById('distortion').value;
	if(e) {
		amount = e.target.value;
	}
	distortion.curve = distortionCurves[distortionCurveIdx](amount, document.getElementById('frequency').value);
}

function setDistorsionAmountCurve(obj) {
	distortionCurveIdx = parseInt(obj.value, 10);
	setDistorsionAmount();
}

function setEnvelope(e) {
	let values = getEnvelope();
	envelopeNode.gain.cancelScheduledValues(audioCtx.currentTime);
	//envelopeNode.gain.value = 0  // Deprecated
	envelopeNode.gain.setValueAtTime(0.0001, audioCtx.currentTime); // With a value of 0 exponentialRampToValueAtTime() doesn't work
	// Attack
	// Using exponentialRampToValueAtTime() because according MDN it sounds more natural for our ear
	// envelopeNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + values[0]);
	envelopeNode.gain.exponentialRampToValueAtTime(1.0, audioCtx.currentTime + values[0]);
	// Decay
	// Duration / 3 gives a good approximation of 95% while being accurate on the duration
	envelopeNode.gain.setTargetAtTime(document.getElementById('sustainlevel').value, audioCtx.currentTime + values[0], values[1]/3 || .001);
	// Release
	envelopeNode.gain.setTargetAtTime(0.0001, audioCtx.currentTime + values[0] + values[1] + values[2], values[3]/3 || .001);
}

function setBiquadType(e) {
	let selBiquadType = document.getElementById('biquad-type'),
		params = biquadParamsByType[selBiquadType.value];
	biquadFilter.type = selBiquadType.value;
	document.getElementById('biquad-q').disabled = !params.q;
	document.getElementById('biquad-gain').disabled = !params.gain;
}

// Recording audio
let mediaStream;
let mediaRecorder;
let chunks = [];

function exportAudio() {
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
		};
	}
	recording = true;
	mediaRecorder.start();
	playSound(false).then(() => {
		recording = false;
		mediaRecorder.requestData();
		mediaRecorder.stop();
	});
}


// Release the Kraken with an electric guitar ///////////////////////////////////////////////////////
function init() {
	createNodes();
	initUI();
	setDefaultValues();
}

init();
