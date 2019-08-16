import { createWhiteNoise, base64ToArrayBuffer, buildNoiseImpulse } from './utils.js';

const defaults = {
	type: 'sine',
	freq: 440,
	freqDetune: 0,
	volume: 1,
	envelope: [0, 0, 1, 0],
	envelopeSustainLevel: .6
};

export const NODE_TYPES = Object.assign(Object.create(null), {
	DISTORTION:    'distortion',
	REVERB:        'reverb',
	BIQUAD_FILTER: 'biquadFilter',
	DYNA_COMPR:    'dynaCompr'
});

export const WAVE_SHAPE = Object.assign(Object.create(null), {
	SINE:        'sine',
	SQUARE:      'square',
	SAWTOOTH:    'sawtooth',
	TRIANGLE:    'triangle',
	WHITE_NOISE: 'white_noise'
});

export default class {
	constructor(sas, params = defaults) {
		params = Object.assign({}, defaults, params);

		this._sas = sas;
		this._audioCtx = sas.context;
		this._createNodes();

		// Params
		this._type = params.type;
		this.freq = params.freq;
		this.freqDetune = params.freqDetune;
		this.volume = params.volume;
		this.setEnvelope(...params.envelope, params.envelopeSustainLevel);
		this._dest = sas.destination;

		for(let prop in NODE_TYPES) {
			const key = NODE_TYPES[prop];
			if (params[key]) {
				this.addNodeByType(key, params[key]);
			}
		}
	}

	get duration() {
		let dur = this._envelope.reduce((a, b) => a + b);
		if (this._nodes.reverb && this._nodes.reverb.enabled) {
			dur = Math.max(dur, this._impulseDuration);
		}
		return dur;
	}

	set destination(node) {
		this._dest = node;
	}

	set type(value) {
		this._type = value;
	}

	set freq(value) {
		this._freq = parseInt(value, 10);
	}

	set freqDetune(value) {
		this._freqDetune = parseInt(value, 10);
	}

	set volume(value) {
		this._nodes.gain.gain.setValueAtTime(parseFloat(value), this._audioCtx.currentTime);
	}

	get nodes() {
		return this._nodes;
	}

	_createNodes() {
		this._nodes = {
			generator: null,
			// Non-linear distortion
			distortion: undefined,
			// Performs a Linear Convolution on a given AudioBuffer, often used to achieve a reverb effect
			reverb: undefined,
			// Gain node node to control sound volume
			gain: this._audioCtx.createGain(),
			// Gain node node to control sound envelope
			envelope: this._audioCtx.createGain(),
			// Represent different kinds of filters, tone control devices, and graphic equalizers
			biquadFilter: undefined,
			// Compression lowers the volume of the loudest parts and raises the volume of the softest parts
			dynaCompr: undefined
		};
	}

	_disconnect() {
		for(let prop in this._nodes) {
			if (Object.prototype.hasOwnProperty.call(this._nodes, prop)) {
				this._nodes[prop] && this._nodes[prop].disconnect();
			}
		}
	}

	_connectNodes() {
		this._disconnect();

		const connectedNodes = Object.values(this._nodes)
			.filter(node => node && (node.enabled || node.enabled === undefined))
		connectedNodes.forEach((node, i) => {
			if (connectedNodes[i+1]) {
				node.connect(connectedNodes[i+1]);
			}
		});

		if (this._dest) {
			connectedNodes.slice(-1)[0].connect(this._dest);
		}
	}

	_applyEnvelope() {
		const envelope = this._nodes.envelope.gain;
		const time = this._audioCtx.currentTime;
		envelope.cancelScheduledValues(time);
		envelope.setValueAtTime(0.0001, time); // With a value of 0 next exponentialRampToValueAtTime() doesn't work
		// Attack
		// Using exponentialRampToValueAtTime() because according MDN it sounds more natural for our ear
		// envelope.linearRampToValueAtTime(1.0, time + this._envelope[0]);
		envelope.exponentialRampToValueAtTime(1.0, time + this._envelope[0]);
		// Decay
		// Duration / 3 gives a good approximation of 95% while being accurate on the duration
		envelope.setTargetAtTime(this._envelopeSustainLevel, time + this._envelope[0], this._envelope[1]/3 || .001);
		// Release
		envelope.setTargetAtTime(0.00001, time + this._envelope[0] + this._envelope[1] + this._envelope[2], this._envelope[3]/3 || .001);
	}

	_createGenerator() {
		if(this._nodes.generator) {
			this._nodes.generator.stop();
			this._nodes.generator.disconnect();
		}

		if(this._type === WAVE_SHAPE.WHITE_NOISE) {
			if(!this._whiteNoiseBuffer) {
				this._whiteNoiseBuffer = createWhiteNoise(this._audioCtx);
			}
			const sourceNode = this._audioCtx.createBufferSource();
			sourceNode.buffer = this._whiteNoiseBuffer;
			sourceNode.loop = true;
			this._nodes.generator = sourceNode;
		} else {
			/* Create an oscilator audio source that will provide a simple tone.
			Oscillators, by design, are only able to be started and stopped exactly once. This is actually
			better for performance, because it means they won’t be hanging around in memory waiting to be
			used when they don’t need to be.
			Luckily, oscillators are cheap and easy to make, so we create one every time the sound is played.
			*/
			const generator = this._audioCtx.createOscillator();
			// Sine wave — other values are 'square', 'sawtooth', 'triangle' and 'custom'
			generator.type = this._type;
			generator.frequency.value = this._freq; // value in hertz. Default is 440
			generator.detune.value = this._freqDetune; // value in cents. Default is 100
			this._nodes.generator = generator;
		}
	}

	addNodeByType(type, params) {
		let node;

		switch(type) {
			case NODE_TYPES.DISTORTION:
				this._nodes.distortion = node = this._audioCtx.createWaveShaper();
				if (params) {
					this.setDistortion(params.curve, params.oversample);
				}
				break;

			case NODE_TYPES.REVERB:
				this._nodes.reverb = node = this._audioCtx.createConvolver();
				if (params) {
					this.addReverb(params.impulse, params.impulseDuration);
				}
				break;

			case NODE_TYPES.BIQUAD_FILTER:
				this._nodes.biquadFilter = node = this._audioCtx.createBiquadFilter();
				if (params) {
					this.setBiquadFilter(params.type, params.detune, params.frequency, params.gain, params.Q);
				}
				break;

			case NODE_TYPES.DYNA_COMPR:
				this._nodes.dynaCompr = node = this._audioCtx.createDynamicsCompressor();
				if (params) {
					this.setDynaCompr(params.threshold, params.knee, params.ratio, params.attack, params.release);
				}
				break;
		}

		if (node) {
			node.enabled = true;
		}

		return node;
	}

	setEnvelope(attack, decay, sustain, release, sustainLevel) {
		this._envelope = [attack, decay, sustain, release];
		this._envelopeSustainLevel = parseFloat(sustainLevel);
	}

	setDistortion(curve, oversample) {
		if (!this._nodes.distortion) {
			this.addNodeByType(NODE_TYPES.DISTORTION);
		}
		this._nodes.distortion.curve = curve;
		this._nodes.distortion.oversample = oversample;
	}

	addReverb(impulse, impulseDuration) {
		if (!this._nodes.reverb) {
			this.addNodeByType(NODE_TYPES.REVERB);
		}

		// Duration of impulse in seconds
		this._impulseDuration = impulseDuration;

		if (impulse === WAVE_SHAPE.WHITE_NOISE) {
			this._nodes.reverb.buffer = buildNoiseImpulse(this._audioCtx, this.duration, 1, false);
		} else {
			const reverbSoundArrayBuffer = base64ToArrayBuffer(impulse);
			// Get numer of bytes per seconds and cut array buffer to a length in second
			const reverbDuration = (reverbSoundArrayBuffer.byteLength/impulseDuration) * this.duration | 0;
			const sliceOfReverbSoundArrayBuffer = reverbSoundArrayBuffer.slice(0, reverbDuration);
			this._audioCtx.decodeAudioData(sliceOfReverbSoundArrayBuffer,
				(buffer) => {
					this._nodes.reverb.buffer = buffer;
				},
				(e) => {
					throw new Error(`Error when decoding audio reverb data ${e.err}`);
				}
			)
		}
	}

	setBiquadFilter(type, detune, frequency, gain, Q) {
		if (!this._nodes.biquadFilter) {
			this.addNodeByType(NODE_TYPES.BIQUAD_FILTER);
		}

		const node = this._nodes.biquadFilter;
		const time = this._audioCtx.currentTime;
		node.type = type;
		node.detune   .setValueAtTime(detune,    time);
		node.frequency.setValueAtTime(frequency, time);
		node.gain     .setValueAtTime(gain,      time);
		node.Q        .setValueAtTime(Q,         time);
	}

	setDynaCompr(threshold, knee, ratio, attack, release) {
		if (!this._nodes.dynaCompr) {
			this.addNodeByType(NODE_TYPES.DYNA_COMPR);
		}

		const node = this._nodes.dynaCompr;
		const time = this._audioCtx.currentTime;
		node.threshold.setValueAtTime(threshold, time);
		node.knee     .setValueAtTime(knee,      time);
		node.ratio    .setValueAtTime(ratio,     time);
		node.attack   .setValueAtTime(attack,    time);
		node.release  .setValueAtTime(release,   time);
	}

	play() {
		this._createGenerator();
		this._connectNodes();
		this._applyEnvelope();
		this.nodes.generator.start();

		return new Promise((resolve) => {
			window.clearTimeout(this._timeoutID);
			this._timeoutID = window.setTimeout(() => {
				resolve();
				this.stop();
			}, this.duration * 1000);
		});
	}

	stop() {
		if(this._nodes.generator) {
			this._nodes.generator.stop();
			this._nodes.generator.disconnect();
			this._nodes.generator = undefined;
		}
		window.clearTimeout(this._timeoutID);
	}

	destroy() {
		this.stop();
		this._disconnect();
		delete this._nodes;
		delete this._dest;
		delete this._audioCtx;
		delete this._sas;
	}
}
