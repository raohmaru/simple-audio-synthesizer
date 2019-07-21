import { createWhiteNoise, base64ToArrayBuffer, buildNoiseImpulse } from './utils.js';

const impulseDuration = 3.0186041666666665;

export default class {
	constructor(audioCtx, type = 'sine', freq = '440') {
		this.audioCtx = audioCtx;
		this.type = type;
		this.freq = freq;
		this.freqDetune = 0;
		this.envelope = [0, 0, 1, 0];
		this.envelopeSustainLevel = .6;
		this.dest = null;

		this.createNodes();
	}

	get duration() {
		let dur = this.envelope.reduce((a, b) => a + b);
		if (this.nodes.reverb.enabled) {
			dur = Math.max(dur, impulseDuration);
		}
		return dur;
	}

	set destination(node) {
		this.dest = node;
	}

	createNodes() {
		this.nodes = {
			generator: null,
			// Gain node node to control sound volume
			gain: this.audioCtx.createGain(),
			// Gain node node to control sound envelope
			envelope: this.audioCtx.createGain(),
			// Non-linear distortion
			distortion: this.audioCtx.createWaveShaper(),
			// Represent different kinds of filters, tone control devices, and graphic equalizers
			biquadFilter: this.audioCtx.createBiquadFilter(),
			// Performs a Linear Convolution on a given AudioBuffer, often used to achieve a reverb effect
			reverb: this.audioCtx.createConvolver(),
			// Compression lowers the volume of the loudest parts and raises the volume of the softest parts
			dynacompr: this.audioCtx.createDynamicsCompressor(),
			// Represents a node able to provide real-time frequency and time-domain analysis information
			analyser: this.audioCtx.createAnalyser()
		};

		this.nodes.distortion.enabled = false;
		this.nodes.biquadFilter.enabled = false;
		this.nodes.reverb.enabled = false;
		this.nodes.dynacompr.enabled = false;
	}

	connectNodes() {
		for(var prop in this.nodes) {
			if (this.nodes.hasOwnProperty(prop)) {
				this.nodes[prop].disconnect();
			}
		}

		const connectedNodes = Object.values(this.nodes)
			.filter(node => node.enabled || node.enabled === undefined)
		connectedNodes.forEach((node, i) => {
			if (connectedNodes[i+1]) {
				node.connect(connectedNodes[i+1]);
			}
		});

		if (this.dest) {
			connectedNodes.slice(-1)[0].connect(this.dest);
		}
	}

	setEnvelope(attack, decay, sustain, release, sustainLevel) {
		this.envelope = [attack, decay, sustain, release];
		this.envelopeSustainLevel = sustainLevel;
	}

	applyEnvelope() {
		const gain = this.nodes.envelope.gain;
		const time = this.audioCtx.currentTime;
		gain.cancelScheduledValues(time);
		//gain.value = 0  // Deprecated
		gain.setValueAtTime(0.0001, time); // With a value of 0 exponentialRampToValueAtTime() doesn't work
		// Attack
		// Using exponentialRampToValueAtTime() because according MDN it sounds more natural for our ear
		// gain.linearRampToValueAtTime(1.0, time + this.envelope[0]);
		gain.exponentialRampToValueAtTime(1.0, time + this.envelope[0]);
		// Decay
		// Duration / 3 gives a good approximation of 95% while being accurate on the duration
		gain.setTargetAtTime(this.envelopeSustainLevel, time + this.envelope[0], this.envelope[1]/3 || .001);
		// Release
		gain.setTargetAtTime(0.0001, time + this.envelope[0] + this.envelope[1] + this.envelope[2], this.envelope[3]/3 || .001);
	}

	addReverb(impulse) {
		if (impulse === 'noise') {
			this.nodes.reverb.buffer = buildNoiseImpulse(this.audioCtx, this.duration, 1, false);
		} else {
			// Duration of impulse in seconds
			const reverbSoundArrayBuffer = base64ToArrayBuffer(impulse);
			// Get numer of bytes per seconds and cut array buffer to a length in second
			const reverbDuration = (reverbSoundArrayBuffer.byteLength/impulseDuration) * this.duration | 0;
			const sliceOfReverbSoundArrayBuffer = reverbSoundArrayBuffer.slice(0, reverbDuration);
			this.audioCtx.decodeAudioData(sliceOfReverbSoundArrayBuffer,
				(buffer) => {
					this.nodes.reverb.buffer = buffer;
				},
				(e) => {
					throw new Error(`Error when decoding audio reverb data ${e.err}`);
				}
			)
		}
	}

	createGenerator() {
		if(this.nodes.generator) {
			this.nodes.generator.stop();
			this.nodes.generator.disconnect();
		}

		if(this.type === 'noise') {
			if(!this.whiteNoiseBuffer) {
				this.whiteNoiseBuffer = createWhiteNoise(this.audioCtx);
			}
			const sourceNode = this.audioCtx.createBufferSource();
			sourceNode.buffer = this.whiteNoiseBuffer;
			sourceNode.loop = true;
			this.nodes.generator = sourceNode;
		} else {
			/* Create an oscilator audio source that will provide a simple tone.
			Oscillators, by design, are only able to be started and stopped exactly once. This is actually
			better for performance, because it means they won’t be hanging around in memory waiting to be
			used when they don’t need to be.
			Luckily, oscillators are cheap and easy to make, so we create one every time the sound is played.
			*/
			const generator = this.audioCtx.createOscillator();
			// Sine wave — other values are 'square', 'sawtooth', 'triangle' and 'custom'
			generator.type = this.type;
			generator.frequency.value = this.freq; // value in hertz. Default is 440
			generator.detune.value = this.freqDetune; // value in cents. Default is 100
			this.nodes.generator = generator;
		}
	}

	play() {
		this.createGenerator();
		this.connectNodes();
		this.applyEnvelope();
		this.nodes.generator.start();
	}

	stop() {
		if(this.nodes.generator) {
			this.nodes.generator.stop();
			this.nodes.generator.disconnect();
		}
		this.nodes.generator = undefined;
	}
}
