class StrumProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Large buffer to capture audio during detection phase
    this.bufferSize = 48000 * 5; // 5 seconds @ 48kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.prevRMS = 0;
    
    // Spike detection state
    this.spikeStartIndex = null;
    this.isSpiking = false;
    this.spikeThreshold = 0.05; // Will be set from frontend

    this.port.onmessage = (event) => {
      if (event.data.type === "CAPTURE") {
        this.captureAudio();
      } else if (event.data.type === "SET_THRESHOLD") {
        this.spikeThreshold = event.data.threshold;
        console.log(`[Worklet] Threshold set to: ${this.spikeThreshold}`);
      }
    };
  }

  captureAudio() {
    // This is called AFTER the spike has ended
    // Extract audio from spike start to current position
    
    if (this.spikeStartIndex === null) {
      console.log("[Worklet] No spike recorded");
      return;
    }

    // Calculate how much audio to extract
    // From spike start to current write position
    let sampleCount;
    if (this.writeIndex >= this.spikeStartIndex) {
      sampleCount = this.writeIndex - this.spikeStartIndex;
    } else {
      // Wrapped around circular buffer
      sampleCount = (this.bufferSize - this.spikeStartIndex) + this.writeIndex;
    }

    // Extract the spike audio
    const outputBuffer = new Float32Array(sampleCount);
    let readIndex = this.spikeStartIndex;
    
    for (let i = 0; i < sampleCount; i++) {
      outputBuffer[i] = this.buffer[readIndex];
      readIndex = (readIndex + 1) % this.bufferSize;
    }

    console.log(`[Worklet] Captured ${sampleCount} samples (${(sampleCount / 48000).toFixed(2)}s)`);

    // Send to frontend
    this.port.postMessage(
      { type: "AUDIO_BUFFER", buffer: outputBuffer },
      [outputBuffer.buffer]
    );

    // Reset spike tracking
    this.spikeStartIndex = null;
    this.isSpiking = false;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    // 1. Write to Circular Buffer
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.writeIndex] = channelData[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }

    // 2. Compute RMS
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const frameRMS = Math.sqrt(sum / channelData.length);

    // 3. Smooth RMS
    this.prevRMS = (this.prevRMS * 0.8) + (frameRMS * 0.2);

    // 4. Detect Spike Start
    if (!this.isSpiking && this.prevRMS > this.spikeThreshold) {
      this.isSpiking = true;
      this.spikeStartIndex = this.writeIndex;
      console.log(`[Worklet] Spike detected! RMS: ${this.prevRMS.toFixed(4)}, Index: ${this.spikeStartIndex}`);
    }

    // 5. Send RMS for UI visualization
    this.port.postMessage({ type: "RMS", rms: this.prevRMS });

    return true;
  }
}

registerProcessor("strum-processor", StrumProcessor);