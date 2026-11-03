// @radiance/core targets ES2023 with no DOM/Node typings so platform APIs can't leak in.
// structuredClone is the one host API it relies on (available in all browsers, Node 17+,
// Deno, Bun and workers).
declare function structuredClone<T>(value: T): T;
