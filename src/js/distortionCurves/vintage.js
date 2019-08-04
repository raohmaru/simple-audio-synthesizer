// Vintage
// https://github.com/CSynths/Howler-Plus/blob/master/src/Distortion/VintageDistortion/curve.js
export default function(amount, freq) {
	const n_samples = freq * 100,
		curve = new Float32Array(n_samples),
		deg = Math.PI / 200;
	for (let i = 0; i < n_samples; ++i ) {
		let x = i * 2 / n_samples - 1;
		curve[i] = (3 + amount) * Math.sin(x) * 10 * deg / (Math.PI + (amount * 0.9) * Math.abs(x));
	}
	return curve;
}
