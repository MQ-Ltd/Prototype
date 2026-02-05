export async function loadStrumWorklet(audioContext: AudioContext) {
  try {
    await audioContext.audioWorklet.addModule("/worklet-processor.js");
    return true;
  } catch (error) {
    console.error("Failed to load worklet:", error);
    return false;
  }
}
