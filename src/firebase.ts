import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** Fallback cloud model; Remote Config's `cloud_model` parameter overrides it without a redeploy. */
export const DEFAULT_CLOUD_MODEL: string = env.VITE_CLOUD_MODEL || 'gemini-3.8-flash';

export type AppCheckMode = 'recaptcha-enterprise' | 'debug-token' | 'off';

export interface FirebaseSetup {
  app: FirebaseApp;
  ai: AI;
  appCheck: AppCheckMode;
}

/** Null when the .env.local is not filled in yet; the UI explains what to do. */
export const firebase: FirebaseSetup | null = setup();

function setup(): FirebaseSetup | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) return null;

  const app = initializeApp(firebaseConfig);

  // Firebase AI Logic requires App Check. In development a debug token stands in
  // for reCAPTCHA; it must be registered in the Firebase console.
  const siteKey: string | undefined = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  const debugToken: string | undefined = env.VITE_APPCHECK_DEBUG_TOKEN;
  let appCheck: AppCheckMode = 'off';

  if (env.DEV && debugToken) {
    (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken === 'true' ? true : debugToken;
    appCheck = 'debug-token';
  } else if (siteKey) {
    appCheck = 'recaptcha-enterprise';
  }

  if (appCheck !== 'off') {
    initializeAppCheck(app, {
      // In debug mode the provider is never asked for a token; the key is only a placeholder.
      provider: new ReCaptchaEnterpriseProvider(siteKey || 'debug-mode-placeholder'),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return { app, ai, appCheck };
}

// ---------------- Remote Config ----------------
// Only the model name comes from Remote Config. Nothing about the user is sent:
// Remote Config fetches use an anonymous installation ID.

let cloudModelName = DEFAULT_CLOUD_MODEL;
let cloudModelSource: 'default' | 'remote-config' = 'default';

export const cloudModel = () => cloudModelName;
export const cloudModelFrom = () => cloudModelSource;

/** Resolves once Remote Config has loaded or failed; failures keep the default. Never rejects. */
export const configReady: Promise<void> = firebase ? loadRemoteConfig(firebase.app) : Promise.resolve();

async function loadRemoteConfig(app: FirebaseApp): Promise<void> {
  try {
    const rc = getRemoteConfig(app);
    rc.settings.minimumFetchIntervalMillis = env.DEV ? 60_000 : 60 * 60_000;
    rc.settings.fetchTimeoutMillis = 4_000;
    rc.defaultConfig = { cloud_model: DEFAULT_CLOUD_MODEL };
    await fetchAndActivate(rc);
    const value = getValue(rc, 'cloud_model');
    const name = value.asString().trim();
    if (value.getSource() === 'remote' && /^[\w.-]+$/.test(name)) {
      cloudModelName = name;
      cloudModelSource = 'remote-config';
    }
  } catch {
    // Offline, blocked or not set up: the default model is used.
  }
}
