import { getGenerativeModel, InferenceMode, type GenerativeModel, type OnDeviceParams } from 'firebase/ai';
import { CLOUD_MODEL, firebase } from '../firebase';

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

export function getModel(route: Route, onDeviceParams?: OnDeviceParams): GenerativeModel {
  if (!firebase) throw new Error('Firebase is not configured. Fill in .env.local (see .env.example).');
  const key = onDeviceParams ? `${route}:${JSON.stringify(onDeviceParams)}` : route;
  let model = cache.get(key);
  if (!model) {
    model = getGenerativeModel(firebase.ai, {
      mode: MODE[route],
      inCloudParams: { model: CLOUD_MODEL },
      onDeviceParams,
    });
    cache.set(key, model);
  }
  return model;
}

export async function run(route: Route, prompt: string, onDeviceParams?: OnDeviceParams): Promise<RunResult> {
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
