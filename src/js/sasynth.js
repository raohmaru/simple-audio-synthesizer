import Note from './note.js';

export default class {
	constructor() {
		// Creating an audio context
		this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		this.audioCtx.suspend();
		this.notes = [];
		this.dest = this.audioCtx.destination;
	}

	get duration() {
		return this.notes.reduce((total, note) => total + note.duration, 0);
	}

	get state() {
		return this.audioCtx.state;
	}

	set destination(node) {
		this.dest = node;
	}

	createNote(type, freq) {
		const note = new Note(this.audioCtx, type, freq)
		this.notes.push(note);
		return note;
	}

	play() {
		this.notes.forEach((note) => {
			note.destination = this.dest;
			note.play();
		});

		if (this.audioCtx.state !== 'running') {
			this.audioCtx.resume();
		}

		return new Promise((resolve, reject) => {
			window.clearTimeout(this.timeoutID);
			this.timeoutID = window.setTimeout(() => {
				this.stop();
				resolve();
			}, this.duration * 1000);
		});
	}

	stop() {
		window.clearTimeout(this.timeoutID);
		this.audioCtx.suspend().then(() => {
			this.notes.forEach((note) => note.stop());
		});
	}

	getContext() {
		return this.audioCtx;
	}
}
