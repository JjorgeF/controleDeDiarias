import React, { lazy } from 'react';

/**
 * Enhanced lazy component loader with retry capability.
 * Prevents "Failed to fetch dynamically imported module" crashes
 * caused by network blips, new deployments, or dev server restarts.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retriesLeft = 2,
  interval = 600
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (retries: number) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            if (retries > 0) {
              setTimeout(() => {
                attempt(retries - 1);
              }, interval);
            } else {
              // If it's a dynamic module import failure (chunk mismatch), reload window once to fetch fresh assets
              const isModuleError = 
                error?.message?.includes('Failed to fetch dynamically imported module') ||
                error?.message?.includes('Importing a module script failed') ||
                error?.name === 'ChunkLoadError';

              if (isModuleError && typeof window !== 'undefined') {
                const reloadKey = 'chunk_reload_' + (window.location.pathname || 'app');
                const hasReloaded = sessionStorage.getItem(reloadKey);
                if (!hasReloaded) {
                  sessionStorage.setItem(reloadKey, 'true');
                  window.location.reload();
                  return;
                }
              }
              reject(error);
            }
          });
      };
      attempt(retriesLeft);
    })
  );
}
