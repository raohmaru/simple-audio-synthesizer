function ultraMetalequation(deg, k, x) {
    return ( 3 + k ) * Math.pow(x, 0.6) * 10 * deg / ( Math.PI + k * Math.abs(Math.pow(x, 0.6)) );
}

export default [
	//  to make curve shape for distortion/wave shaper node to use => {
	// https://stackoverflow.com/questions/22312841/waveshaper-node-in-webaudio-how-to-emulate-distortion
	(amount, freq) => {
		const n_samples = freq * 100,
			curve = new Float32Array(n_samples),
			deg = Math.PI / 180;
		for (let i = 0; i < n_samples; ++i ) {
			let x = i * 2 / n_samples - 1;
			curve[i] = ( 3 + amount ) * x * 20 * deg / ( Math.PI + amount * Math.abs(x) );
		}
		return curve;
	},
	// Karplus–Strong
	// https://github.com/mohayonao/pluck-string-node/
	(amount, freq) => {
		const n_samples = amount || 5;
		const curve = new Float32Array(n_samples);
		for (let i = 0; i < n_samples; ++i ) {
			curve[i] = Math.random() - 0.5;
		}
		curve[(n_samples >> 1)] = 0;
		return curve;
	},
	// Vintage
	// https://github.com/CSynths/Howler-Plus/blob/master/src/Distortion/VintageDistortion/curve.js
	(amount, freq) => {
		const n_samples = freq * 100,
			curve = new Float32Array(n_samples),
			deg = Math.PI / 200;
		for (let i = 0; i < n_samples; ++i ) {
			let x = i * 2 / n_samples - 1;
			curve[i] = (3 + amount) * Math.sin(x) * 10 * deg / (Math.PI + (amount * 0.9) * Math.abs(x));
		}
		return curve;
	},
	// Ultra Metal
	// https://github.com/CSynths/Howler-Plus/blob/master/src/Distortion/UltraMetalDistortion/curve.js
	(amount, freq) => {
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
];

