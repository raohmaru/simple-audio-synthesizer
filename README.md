# Simple Synthesizer with Web Audio API
An audio synthesizer build with [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

&#x1F3B5; &nbsp; [Editor](https://raohmaru.github.io/simple-audio-synthesizer/src/) &nbsp; &#x1F3B5; &nbsp; [Virtua Piano](https://raohmaru.github.io/simple-audio-synthesizer/src/electric-piano.html) &nbsp; &#x1F3B5;

It uses the [OscillatorNode](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode) or
white noise to generate a sound, which can be manipulated with the different [AudioNodes](https://developer.mozilla.org/en-US/docs/Web/API/AudioNode)
the API exposes.

This tool was built by means of learning how to generate sounds in the modern browsers. Do not expect
a polished code or excellent performance.

## Installation
- Clone the repository
- Open src/index.html

## Usage
```
import SAS from './lib/sasynth.js';
import Note from './lib/note.js';

const noteParams = {
    type: "sine",
    freq: 220
};

const sas = new SAS();
sas.createNote(noteParams);
sas.play();

// or
const note = new Note(sas, noteParams);
note.play();
```

## Browser Support
Chrome, Firefox, Edge, Safari. Essentially any browser that understands ECMAScript 2015+ and the [Web Audio API](https://caniuse.com/#search=Web%20Audio).

## A Note on the Impulse Responses
The impulse response sounds used for the [ConvolverNode](https://developer.mozilla.org/en-US/docs/Web/API/ConvolverNode)
are encoded in Base64 and placed under src/js/impulses/. The original sound files are provided for
free thanks to [Samplicty](http://www.samplicity.com/bricasti-m7-impulse-responses/).

## License
Released under The MIT License (MIT).

## Useful Links
- [Nine Components of Sound](http://www.filmsound.org/articles/ninecomponents/9components.htm)
- [Synthesizer definition in Wikipedia](https://en.wikipedia.org/wiki/Synthesizer)
- [JavaScript Systems Music](https://teropa.info/blog/2016/07/28/javascript-systems-music.html)
- [Recreating legendary 8-bit games music with Web Audio API](https://codepen.io/gregh/post/recreating-legendary-8-bit-games-music-with-web-audio-api)
- [Developing Game Audio with the Web Audio API](https://www.html5rocks.com/en/tutorials/webaudio/games/)
- [Frequencies for equal-tempered scale](https://pages.mtu.edu/~suits/notefreqs.html)
- [Electric Guitar Synth in HTML5](https://fazli.sapuan.org/blog/electric-guitar-synth-in-html5/)
- [Synthesising Drum Sounds with the Web Audio API](https://dev.opera.com/articles/drum-sounds-webaudio/)
- [How to Generate Noise with the Web Audio API](https://noisehack.com/generate-noise-web-audio-api/)
- [jsfxr Generator](http://github.grumdrig.com/jsfxr/)
