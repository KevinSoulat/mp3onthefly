importScripts('lame.all.js');


function bufferToWav(buffer, opt){

	opt = opt || {}

	var numChannels = buffer.channels.length;//buffer.numberOfChannels
	var sampleRate = buffer.sampleRate
	var format = opt.float32 ? 3 : 1
	var bitDepth = format === 3 ? 32 : 16

	var result
	if (numChannels === 2) {
	result = interleave(buffer.channels[0], buffer.channels[1] )
	} else {
	result = buffer.channels[0];
	}

	return encodeWAV(result, format, sampleRate, numChannels, bitDepth)


	function encodeWAV (samples, format, sampleRate, numChannels, bitDepth) {
		var bytesPerSample = bitDepth / 8
		var blockAlign = numChannels * bytesPerSample

		var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
		var view = new DataView(buffer)

		/* RIFF identifier */
		writeString(view, 0, 'RIFF')
		/* RIFF chunk length */
		view.setUint32(4, 36 + samples.length * bytesPerSample, true)
		/* RIFF type */
		writeString(view, 8, 'WAVE')
		/* format chunk identifier */
		writeString(view, 12, 'fmt ')
		/* format chunk length */
		view.setUint32(16, 16, true)
		/* sample format (raw) */
		view.setUint16(20, format, true)
		/* channel count */
		view.setUint16(22, numChannels, true)
		/* sample rate */
		view.setUint32(24, sampleRate, true)
		/* byte rate (sample rate * block align) */
		view.setUint32(28, sampleRate * blockAlign, true)
		/* block align (channel count * bytes per sample) */
		view.setUint16(32, blockAlign, true)
		/* bits per sample */
		view.setUint16(34, bitDepth, true)
		/* data chunk identifier */
		writeString(view, 36, 'data')
		/* data chunk length */
		view.setUint32(40, samples.length * bytesPerSample, true)
		if (format === 1) { // Raw PCM
		floatTo16BitPCM(view, 44, samples)
		} else {
		writeFloat32(view, 44, samples)
		}

		return buffer
	}

	function interleave (inputL, inputR) {
		var length = inputL.length + inputR.length
		var result = new Float32Array(length)

		var index = 0
		var inputIndex = 0

		while (index < length) {
		result[index++] = inputL[inputIndex]
		result[index++] = inputR[inputIndex]
		inputIndex++
		}
		return result
	}

	function writeFloat32 (output, offset, input) {
		for (var i = 0; i < input.length; i++, offset += 4) {
		output.setFloat32(offset, input[i], true)
		}
	}

	function floatTo16BitPCM (output, offset, input) {
		for (var i = 0; i < input.length; i++, offset += 2) {
		var s = Math.max(-1, Math.min(1, input[i]))
		output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
		}
	}

	function writeString (view, offset, string) {
		for (var i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i))
		}
	}

}

function wavToMp3( audioData, onProgress ){

	var wav = lamejs.WavHeader.readHeader( new DataView(audioData) );

	var buffer = [];
	var channels = wav.channels;
	var sampleRate = wav.sampleRate;
	var samples = new Int16Array(audioData, wav.dataOffset, wav.dataLen / 2);


	//var mp3encoder = new lamejs.Mp3Encoder(2, 44100, 128);
	var mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);


	var dataView = new Int16Array(samples, wav.dataOffset, wav.dataLen / 2);
	left = wav.channels === 1 ? dataView : new Int16Array(wav.dataLen / (2 * wav.channels));
	right = wav.channels === 2 ? new Int16Array(wav.dataLen / (2 * wav.channels)) : undefined;
	if(wav.channels > 1){
		for (var i = 0; i < left.length; i++) {
			left[i] = dataView[i * 2];
			right[i] = dataView[i * 2 + 1];
		}
	}

	var remaining = left.length;
	var sampleBlockSize = 1152; //can be anything but make it a multiple of 576 to make encoders life easier

	for(var i = j = 0; remaining >= sampleBlockSize; i += sampleBlockSize, j++){

		if( j % 20 === 0 ){
			onProgress?.({ progress: 1-(remaining/left.length) });
		}


		var leftChunk = left.subarray(i, i + sampleBlockSize);
		var rightChunk;
		if( right ){
			rightChunk = right.subarray(i, i + sampleBlockSize);
		}
		var mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);


		if( mp3buf.length > 0 ){
			buffer.push( new Int8Array(mp3buf) );
		}

		remaining -= sampleBlockSize;

	}

	var mp3buf = mp3encoder.flush();
	if( mp3buf.length > 0 ){ buffer.push( new Int8Array(mp3buf) ); }

	return buffer;

}



function converter({ fileArrayBuffer, fileType }){

	console.group('worker');

	let wav;
	if( !fileType.match( /audio/ ) ){ // note: non-audio files (i.e. video) require conversion to wav beforehand
		console.time( 'convertToWav' );
		wav = bufferToWav( fileArrayBuffer );
		console.time( 'convertToWav' );
	}

	console.time( 'convertWavToMp3' );
	const onProgress = ({ progress }) => self.postMessage({ cmd: 'progress', progress });
	const mp3 = wavToMp3( wav || fileArrayBuffer, onProgress );
	console.timeEnd( 'convertWavToMp3' );

	self.postMessage({ cmd: 'end', mp3 });
	console.groupEnd('worker') ;

}


self.onmessage = function( event ){

	switch( event.data.cmd ){
	  case 'convert': converter( event.data ); break;
	}

};
