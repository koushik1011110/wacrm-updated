/**
 * Facebook JavaScript SDK Loader
 *
 * Implements a Promise-based loader to resolve the SDK loading race condition.
 * Reuses the same Promise for concurrent loads, handles timeouts, and supports retry.
 */

let sdkLoadPromise: Promise<void> | null = null;
let fbInitCompleted = false;

export function isFbInitCompleted(): boolean {
  return fbInitCompleted;
}

export function loadFacebookSDK(appId: string, version: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Cannot load Facebook SDK on the server side.'));
  }

  // If already initialized, resolve immediately
  if ((window as any).FB && fbInitCompleted) {
    return Promise.resolve();
  }

  // Reuse existing promise if loading is in progress
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    // 1. Register fbAsyncInit before appending the SDK script
    const originalFbAsyncInit = (window as any).fbAsyncInit;
    (window as any).fbAsyncInit = function () {
      if (originalFbAsyncInit) {
        try {
          originalFbAsyncInit();
        } catch (e) {
          console.error('Error running original fbAsyncInit:', e);
        }
      }

      try {
        (window as any).FB.init({
          appId: appId,
          cookie: true,
          xfbml: false,
          version: version,
        });
        fbInitCompleted = true;
        window.dispatchEvent(new CustomEvent('facebook-sdk-ready'));
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    // If SDK script is already injected but FB.init has not run
    if ((window as any).FB) {
      (window as any).fbAsyncInit();
      return;
    }

    let script = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
    }

    const timeoutId = setTimeout(() => {
      sdkLoadPromise = null; // Clear so retry can be attempted
      reject(new Error('Timeout loading Facebook SDK. Please check your internet connection or disable ad blockers.'));
    }, 15000);

    script.onload = () => {
      clearTimeout(timeoutId);
    };

    script.onerror = () => {
      clearTimeout(timeoutId);
      sdkLoadPromise = null; // Clear so retry can be attempted
      reject(
        new Error(
          'Facebook could not be loaded. Disable any ad blocker or tracking protection for this website, check your connection, and try again.'
        )
      );
    };

    // Inject only if not already present
    if (!document.getElementById('facebook-jssdk')) {
      document.body.appendChild(script);
    }
  });

  return sdkLoadPromise;
}

export function resetFacebookSDK() {
  sdkLoadPromise = null;
  fbInitCompleted = false;
  if (typeof window !== 'undefined') {
    const script = document.getElementById('facebook-jssdk');
    if (script) {
      script.remove();
    }
    delete (window as any).FB;
    delete (window as any).fbAsyncInit;
  }
}
