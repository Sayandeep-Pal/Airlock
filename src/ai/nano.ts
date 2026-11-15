/** Checks Chrome's built-in Prompt API (Gemini Nano) directly, without calling a model. */

export type NanoStatus = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LanguageModelStatic {
  availability(options?: unknown): Promise<Exclude<NanoStatus, 'unsupported'>>;
}

export async function nanoStatus(): Promise<NanoStatus> {
  const lm = (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel;
  if (!lm) return 'unsupported';
  try {
    return await lm.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
  } catch {
    return 'unavailable';
  }
}

export const NANO_HELP: Record<NanoStatus, string> = {
  unsupported:
    'This browser has no built-in Prompt API. Use desktop Chrome and enable chrome://flags/#prompt-api-for-gemini-nano.',
  unavailable: 'Chrome reports Gemini Nano cannot run on this device (hardware or storage requirements not met).',
  downloadable: 'Gemini Nano can run here but is not downloaded yet. Click "Warm up Nano" to start the download.',
  downloading: 'Gemini Nano is downloading. On-device calls will work once it finishes.',
  available: 'Gemini Nano is ready on this device.',
};
