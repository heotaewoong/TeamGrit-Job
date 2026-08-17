// Required preload for the server-only production marker.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(specifier, context, nextResolve) { if (specifier === 'server-only') return { url: 'data:text/javascript,export%20{}', shortCircuit: true }; return nextResolve(specifier, context); }`), import.meta.url);
