import { getGenerativeModel, InferenceMode, type GenerativeModel, type OnDeviceParams } from 'firebase/ai';
import { cloudModel, configReady, firebase } from '../firebase';

/**
 * Airlock picks the route explicitly for every call:
 *  - device:        ONLY_ON_DEVICE  — redaction & airlock check. Throws without Nano; never falls back to cloud.
 *  - cloud:         ONLY_IN_CLOUD   — reasoning over already-redacted text.
 *  - prefer-device: PREFER_ON_DEVICE — quick summary; works offline, uses cloud if Nano is missing.
 */
export type Route = 'device' | 'cloud' | 'prefer-device';

const MODE: Record<Route, InferenceMode> = {
  device: InferenceMode.ONLY_ON_DEVICE,
  cloud: InferenceMode.ONLY_IN_CLOUD,
  'prefer-device': InferenceMode.PREFER_ON_DEVICE,
};

export type Where = 'on_device' | 'in_cloud';

export interface RunResult {
  text: string;
  /** Where the SDK says the inference actually ran. */
  where: Where;
  ms: number;
}

const cache = new Map<string, GenerativeModel>();
export const CLOUD_TIMEOUT_MS = 90_000;

export function getModel(route: Route, onDeviceParams?: OnDeviceParams): GenerativeModel {
  if (!firebase) throw new Error('Firebase is not configured. Fill in .env.local (see .env.example).');
  const key = `${route}:${cloudModel()}:${onDeviceParams ? JSON.stringify(onDeviceParams) : ''}`;
  let model = cache.get(key);
  if (!model) {
    model = getGenerativeModel(
      firebase.ai,
      { mode: MODE[route], inCloudParams: { model: cloudModel() }, onDeviceParams },
      // Fail in 90 s rather than the SDK's default 180 s: answers normally take a few seconds,
      // and a stuck request is worse for the user than a clear "try again".
      { timeout: CLOUD_TIMEOUT_MS },
    );
    cache.set(key, model);
  }
  return model;
}

export async function run(route: Route, prompt: string, onDeviceParams?: OnDeviceParams): Promise<RunResult> {
  // Cloud-capable routes wait for Remote Config (at most its 4 s timeout, usually instant from cache).
  if (route !== 'device') await configReady;
  const t0 = performance.now();
  const result = await getModel(route, onDeviceParams).generateContent(prompt);
  const ms = Math.round(performance.now() - t0);
  const where: Where =
    result.response.inferenceSource ?? (route === 'cloud' ? 'in_cloud' : 'on_device');
  return { text: result.response.text(), where, ms };
}

/**
 * Downloads/initialises Gemini Nano. Must be called from a user gesture (click),
 * otherwise Chrome refuses to start the download.
 */
export async function warmUpDeviceModel(
  onProgress?: (fraction: number) => void,
  onDeviceParams?: OnDeviceParams,
): Promise<void> {
  await getModel('device', onDeviceParams).initializeDeviceModel(onProgress);
}
