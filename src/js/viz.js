let canvas;
let canvasCtx;
let analyser;
let bufferLength;
let dataArray;
let rafID;
let WIDTH;
let HEIGHT;
let HEIGHT_2;

function init(view, analyserNode) {
	canvas = view;
	canvasCtx = canvas.getContext('2d');
	analyser = analyserNode;
	WIDTH = canvas.width;
	HEIGHT = canvas.height;
	HEIGHT_2 = HEIGHT / 2;

	canvasCtx.fillStyle = 'rgb(0, 200, 200)';
	canvasCtx.lineWidth = 2;
	canvasCtx.strokeStyle = 'rgb(255, 255, 255)';
}

function render() {
	bufferLength = analyser.frequencyBinCount; // half the FFT value
	dataArray = new Uint8Array(bufferLength); // create an array to store the data
	window.cancelAnimationFrame(rafID);
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

function stop() {
	window.cancelAnimationFrame(rafID);
	window.setTimeout(reset, 0);
}

function reset() {
	canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
	canvasCtx.beginPath();
	canvasCtx.moveTo(0, HEIGHT_2);
	canvasCtx.lineTo(WIDTH, HEIGHT_2);
	canvasCtx.stroke();
}

export default {
	init,
	render,
	stop,
	reset
};
