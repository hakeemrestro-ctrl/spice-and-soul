// Node-only harness equivalent to Next's react-server server-only resolution.
import Module from 'node:module';

// Intercept CommonJS require
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  if (request === 'server-only') {
    return new URL('../node_modules/next/dist/compiled/server-only/empty.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  }
  return originalResolve.call(this, request, ...args);
};

// Intercept ESM import
if (typeof Module.registerHooks === 'function') {
  Module.registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only') {
        return { url: new URL('../node_modules/next/dist/compiled/server-only/empty.js', import.meta.url).href, shortCircuit: true };
      }
      return next(specifier, context);
    },
  });
} else if (typeof Module.register === 'function') {
  Module.register('./billdesk-server-hook.mjs', import.meta.url);
}
