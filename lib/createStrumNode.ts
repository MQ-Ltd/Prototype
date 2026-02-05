export function createStrumNode(audioContext: AudioContext) {
  return new AudioWorkletNode(audioContext, "strum-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1]
  });
}
