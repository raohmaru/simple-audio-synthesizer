function ultraMetalequation(deg, k, x) {
    return ( 3 + k ) * Math.pow(x, 0.6) * 10 * deg / ( Math.PI + k * Math.abs(Math.pow(x, 0.6)) );
}

export default [
	//  to make curve shape for distortion/wave shaper node to use => {
	// https://stackoverflow.com/questions/22312841/waveshaper-node-in-webaudio-how-to-emulate-distortion
	(amount, freq) => {
		 const k = parseInt(amount, 10),
			n_samples = freq * 100,
			curve = new Float32Array(n_samples),
			deg = Math.PI / 180;
		for (let i = 0; i < n_samples; ++i ) {
			let x = i * 2 / n_samples - 1;
			curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
		}
		return curve;
	},
	// Karplus–Strong
	// https://github.com/mohayonao/pluck-string-node/
	(amount) => {
		const len = parseInt(amount, 10) || 5,
			curve = new Float32Array(len);
		for (let i = 0; i < len; ++i ) {
			curve[i] = Math.random() * 2 - 1;
		}
		curve[(len >> 1)] = 0;

		return curve;
	},
	// Vintage
	// https://github.com/CSynths/Howler-Plus/blob/master/src/Distortion/VintageDistortion/curve.js
	(amount, freq) => {
		const k = amount,
			n_samples = freq * 100,
			curve = new Float32Array(n_samples),
			deg = Math.PI / 200;
		for (let i = 0; i < n_samples; ++i ) {
			let x = i * 2 / n_samples - 1;
			curve[i] = (3 + k) * Math.sin(x) * 10 * deg / (Math.PI + (k * 0.9) * Math.abs(x));
		}
		return curve;
	},
	// Ultra Metal
	// https://github.com/CSynths/Howler-Plus/blob/master/src/Distortion/UltraMetalDistortion/curve.js
	(amount, freq) => {
		const k = amount,
			n_samples = freq * 100,
			curve = new Float32Array(n_samples),
			deg = Math.PI / 270;
		for (let i = 0; i < n_samples; ++i ) {
			let x = i * 2 / n_samples - 1;
			let result;
			if (x < 0) {
			  result = ultraMetalequation(deg, k, Math.abs(x)) * -1;
			} else {
				result = ultraMetalequation(deg, k, x);
			}
			curve[i] = result;
		}
		return curve;
	}
];

