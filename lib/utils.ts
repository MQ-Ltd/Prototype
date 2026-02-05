import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Encodes a Float32Array audio buffer into a WAV file Blob
 * @param samples - Audio samples as Float32Array (mono, normalized -1 to 1)
 * @param sampleRate - Sample rate in Hz (e.g., 48000)
 * @returns Blob containing WAV file data
 */
export function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const length = samples.length;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const int16Samples = new Int16Array(length);

  // Convert float samples (-1 to 1) to 16-bit integers
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true); // File size - 8
  writeString(8, "WAVE");

  // fmt chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, 1, true); // Number of channels (1 = mono)
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // data chunk
  writeString(36, "data");
  view.setUint32(40, length * 2, true); // Data chunk size

  // Write audio data
  const dataView = new DataView(buffer, 44);
  for (let i = 0; i < length; i++) {
    dataView.setInt16(i * 2, int16Samples[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
