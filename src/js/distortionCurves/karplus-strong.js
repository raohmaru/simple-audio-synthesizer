// Karplus–Strong
// https://github.com/mohayonao/pluck-string-node/
export default function(amount, freq) {
	const n_samples = amount || 5;
	const curve = new Float32Array(n_samples);
	for (let i = 0; i < n_samples; ++i ) {
		curve[i] = Math.random() - 0.5;
	}
	curve[(n_samples >> 1)] = 0;
	return curve;
};

