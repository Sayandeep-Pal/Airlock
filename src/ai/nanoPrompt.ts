import { ENTITY_SCHEMA } from '../redact/nano';
import { run } from './models';

/** Prompt Gemini Nano strictly on-device for entity JSON. Never falls back to the cloud. */
export async function promptNanoForJson(input: string): Promise<string> {
  const result = await run('device', input, { promptOptions: { responseConstraint: ENTITY_SCHEMA } });
  if (result.where !== 'on_device') throw new Error('Refusing: detection did not run on-device.');
  return result.text;
}
