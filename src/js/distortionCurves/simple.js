// to make curve shape for distortion/wave shaper node to use
// https://stackoverflow.com/questions/22312841/waveshaper-node-in-webaudio-how-to-emulate-distortion
export default function(amount, freq) {
	const n_samples = freq * 100,
		curve = new Float32Array(n_samples),
		deg = Math.PI / 180;
	for (let i = 0; i < n_samples; ++i ) {
		let x = i * 2 / n_samples - 1;
		curve[i] = ( 3 + amount ) * x * 20 * deg / ( Math.PI + amount * Math.abs(x) );
	}
	return curve;
}

