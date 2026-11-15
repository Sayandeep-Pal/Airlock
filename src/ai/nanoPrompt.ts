import type { OnDeviceParams } from 'firebase/ai';
import { ENTITY_SCHEMA } from '../redact/nano';
import { run } from './models';

/** On-device settings for PII detection: Nano must answer in the entity JSON schema. */
export const DETECT_PARAMS: OnDeviceParams = { promptOptions: { responseConstraint: ENTITY_SCHEMA } };

/** Prompt Gemini Nano strictly on-device for entity JSON. Never falls back to the cloud. */
export async function promptNanoForJson(input: string): Promise<string> {
  const result = await run('device', input, DETECT_PARAMS);
  if (result.where !== 'on_device') throw new Error('Refusing: detection did not run on-device.');
  return result.text;
}
