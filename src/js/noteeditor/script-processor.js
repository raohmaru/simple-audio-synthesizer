class ScriptProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.writeIdx = 0;
		this.port.onmessage = this.handleMessage.bind(this);
	}

	// Handling data from the node.
	handleMessage(event) {
		if (event.data.message === 'setup') {
			this.buffer = event.data.buffer;
			this.writeIdx = 0;
		}
	}

	process(inputs, outputs) {
		// By default, the node has single input and output.
		const input = inputs[0];
		const output = outputs[0];
		const inputChannel0 = input[0];  // For now, we only handle one channel

		if (inputChannel0.length + this.writeIdx < this.buffer.length) {
			this.buffer.set(inputChannel0, this.writeIdx);
			this.writeIdx += inputChannel0.length;
		} else {
			let splitIndex = this.buffer.length - this.writeIdx;
			let firstHalf = inputChannel0.subarray(0, splitIndex);
			this.buffer.set(firstHalf, this.writeIdx);
			this.writeIdx = this.buffer.length;
		}

		// bypass input to output without modification
		for (let channel = 0; channel < output.length; ++channel) {
			output[channel].set(input[channel]);
		}

		return true;
	}
}

registerProcessor('script-processor', ScriptProcessor);
