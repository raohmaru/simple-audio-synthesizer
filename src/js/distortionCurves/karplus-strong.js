// Karplus–Strong
// https://github.com/mohayonao/pluck-string-node/
export default function(amount, freq, peak = 0.5, valley = -0.5) {
	const n_samples = amount || 5;
	const curve = new Float32Array(n_samples);
	const amplitude = peak - valley;
	for (let i = 0; i < n_samples; ++i ) {
		curve[i] = Math.random() * amplitude + valley;
	}
	curve[(n_samples >> 1)] = 0;
	return curve;
};

