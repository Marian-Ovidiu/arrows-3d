/** What stands between the player and the game: installing the app, then signing in. */
export type GateStep = 'install' | 'checking' | 'login' | 'offline' | null;

export interface GateContext {
  /** False in development and automated runs, where the game opens directly. */
  enforced: boolean;
  /** The Android app is already an installed app and has no Google sign-in yet. */
  native: boolean;
  /** Running as an installed PWA rather than a browser tab. */
  standalone: boolean;
  /** Accounts exist only when the online service is configured. */
  configured: boolean;
  /** The sign-in state has not been read yet. */
  checking: boolean;
  signedIn: boolean;
  /** The account service answered; offline or failing, the player continues as a guest. */
  reachable: boolean;
  /** The player chose to play as a guest until the service is back. */
  guestForNow: boolean;
}

export function gateStep(context: GateContext): GateStep {
  if (!context.enforced || context.native) return null;
  if (!context.standalone) return 'install';
  if (!context.configured || context.signedIn) return null;
  if (context.checking) return 'checking';
  if (context.reachable) return 'login';
  return context.guestForNow ? null : 'offline';
}

/** How this browser lets the player install: its own dialog, or steps we explain. */
export type InstallHelp = 'prompt' | 'ios' | 'android' | 'desktop' | 'mac-safari' | 'in-app' | 'unsupported';

export function installHelp(userAgent: string, maxTouchPoints: number, canPrompt: boolean): InstallHelp {
  // In-app browsers (social networks, messengers, Android WebViews) cannot install anything.
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|TikTok|musical_ly|Telegram|Snapchat|LinkedInApp|; wv\)/i.test(userAgent)) return 'in-app';
  if (canPrompt) return 'prompt';
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  if (/Firefox\//.test(userAgent)) return 'unsupported';
  if (/Chrome\/|Edg\//.test(userAgent)) return 'desktop';
  if (/Macintosh/.test(userAgent) && /Version\/\d+.*Safari\//.test(userAgent)) return 'mac-safari';
  return 'unsupported';
}
