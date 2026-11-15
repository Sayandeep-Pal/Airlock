import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const CLOUD_MODEL: string = env.VITE_CLOUD_MODEL || 'gemini-3.8-flash';

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
