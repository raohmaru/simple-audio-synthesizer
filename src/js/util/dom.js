export default function $(elOrSelector, selector) {
	let el = window.document,
		els,
		arr,
		idx;

	if (typeof elOrSelector === 'string') {
		selector = elOrSelector;
	} else {
		el = elOrSelector;
	}

	if ((idx = selector.indexOf('#')) !== -1 && selector.indexOf(' ') === -1) {
		return el.getElementById(selector.substr(idx + 1));
	}

	els = el.querySelectorAll(selector);
	arr = [];
	// Maybe faster than Array.prototype.slice.call(els)
	for (let i = 0, len = arr.length = els.length; i < len; i++) {
		arr[i] = els[i];
	}
	return arr;
}
