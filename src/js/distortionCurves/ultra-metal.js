function ultraMetalequation(deg, k, x) {
	return ( 3 + k ) * Math.pow(x, 0.6) * 10 * deg / ( Math.PI + k * Math.abs(Math.pow(x, 0.6)) );
}

// Ultra Metal
// https://github.com/CSynths/Howler-Plus/blob/master/src/Distortion/UltraMetalDistortion/curve.js
export default function (amount, freq) {
	const n_samples = freq * 100,
		curve = new Float32Array(n_samples),
		deg = Math.PI / 270;
	for (let i = 0; i < n_samples; ++i ) {
		let x = i * 2 / n_samples - 1;
		let result;
		if (x < 0) {
			result = ultraMetalequation(deg, amount, Math.abs(x)) * -1;
		} else {
			result = ultraMetalequation(deg, amount, x);
		}
		curve[i] = result;
	}
	return curve;
}
