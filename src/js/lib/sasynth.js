import Note from './note.js';

const defaults = {
	analyse: false
};

export default class {
	constructor(options = defaults) {
		// Creating an audio context
		this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		this._audioCtx.suspend();
		this._notes = [];
		this._dest = this._audioCtx.destination;

		if (options.analyse) {
			this.analyse = true;
		}
	}

	get duration() {
		return this._notes.reduce((total, note) => total + note.duration, 0);
	}

	get state() {
		return this._audioCtx.state;
	}

	set destination(node) {
		this._dest = node;
	}

	set analyse(bool) {
		if (bool) {
			if (!this._analyser) {
				// Represents a node able to provide real-time frequency and time-domain analysis information
				this._analyser = this._audioCtx.createAnalyser();
			}
		} else {
			this._analyser.disconnect();
			this._analyser = undefined;
		}
	}

	get analyser() {
		return this._analyser;
	}

	get context() {
		return this._audioCtx;
	}

	get notes() {
		return this._notes.slice();
	}

	createNote(params) {
		const note = new Note(this._audioCtx, params);
		this._notes.push(note);
		return note;
	}

	play() {
		let dest = this._dest;
		if (this._analyser) {
			this._analyser.connect(this._dest);
			dest = this._analyser;
		}

		this._notes.forEach((note) => {
			note.destination = dest;
			note.play();
		});

		if (this._audioCtx.state !== 'running') {
			this._audioCtx.resume();
		}

		return new Promise((resolve, reject) => {
			window.clearTimeout(this._timeoutID);
			this._timeoutID = window.setTimeout(() => {
				resolve();
			}, this.duration * 1000);
		});
	}

	stop() {
		window.clearTimeout(this._timeoutID);
		this._audioCtx.suspend().then(() => {
			this._notes.forEach((note) => note.stop());
		});
	}
}
