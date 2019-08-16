import Note from './note.js';

const defaults = {
	analyse: false,
	masterVolume: 1
};

export default class {
	constructor(options = defaults) {
		options = Object.assign({}, defaults, options);
		// Creating an audio context
		this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		this._audioCtx.suspend();
		this._notes = [];
		this.masterVolume = options.masterVolume;
		if (options.analyse) {
			this._addAnalyser();
		}
		this.destination = this._audioCtx.destination;
	}

	get duration() {
		return this._notes.reduce((total, note) => total + note.duration, 0);
	}

	get state() {
		return this._audioCtx.state;
	}

	get destination() {
		return this._dest;
	}

	set destination(node) {
		if (this._analyserNode) {
			this._analyserNode.disconnect();
			this._analyserNode.connect(node);
			node = this._analyserNode;
		}

		this._volumeNode.disconnect();
		this._volumeNode.connect(node);
		this._dest = this._volumeNode;
	}

	get analyser() {
		return this._analyserNode;
	}

	get context() {
		return this._audioCtx;
	}

	get notes() {
		return this._notes.slice();
	}

	set masterVolume(value) {
		if (!this._volumeNode) {
			// Gain node node to control sound volume
			this._volumeNode = this._audioCtx.createGain();
		}
		this._volumeNode.gain.setValueAtTime(parseFloat(value), this._audioCtx.currentTime);
	}

	_addAnalyser() {
		if (!this._analyserNode) {
			// Represents a node able to provide real-time frequency and time-domain analysis information
			this._analyserNode = this._audioCtx.createAnalyser();
		}
	}

	createNote(params) {
		const note = new Note(this, params);
		this._notes.push(note);
		return note;
	}

	play() {
		this._notes.forEach((note) => {
			note.destination = this._dest;
			note.play();
		});

		this.start();

		return new Promise((resolve) => {
			window.clearTimeout(this._timeoutID);
			this._timeoutID = window.setTimeout(() => {
				resolve();
				this.stop();
			}, this.duration * 1000);
		});
	}

	stop() {
		window.clearTimeout(this._timeoutID);
		this._audioCtx.suspend();
	}

	start() {
		if (this._audioCtx.state !== 'running') {
			this._audioCtx.resume();
		}
	}
}
