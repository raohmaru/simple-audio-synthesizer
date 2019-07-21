// https://noisehack.com/generate-noise-web-audio-api/
export function createWhiteNoise(audioCtx) {
	const bufferSize = audioCtx.sampleRate * 2;
	const whiteNoiseBuffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
	const output0 = whiteNoiseBuffer.getChannelData(0);
	const output1 = whiteNoiseBuffer.getChannelData(1);
	for (let i = 0; i < bufferSize; i++) {
		output0[i] = Math.random() * 2 - 1;
		output1[i] = Math.random() * 2 - 1
	}
	return whiteNoiseBuffer;
}

export function base64ToArrayBuffer(base64) {
    let binaryString = window.atob(base64);
	let len = binaryString.length;
	let bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++)        {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// https://github.com/web-audio-components/simple-reverb/blob/master/index.js
export function buildNoiseImpulse(audioCtx, seconds, decay, reverse) {
	let rate = audioCtx.sampleRate;
	let len = rate * seconds;
	let impulse = audioCtx.createBuffer(2, len, rate);
	let impulseL = impulse.getChannelData(0);
	let impulseR = impulse.getChannelData(1);

	for (let i = 0; i < len; i++) {
		let n = reverse ? len - i : i;
		impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, decay);
		impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, decay);
	}

	return impulse;
}
