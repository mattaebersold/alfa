/**
 * `Error.captureStackTrace` is V8-only and typed by @types/node, which this
 * app doesn't pull in. @shopify/checkout-sheet-kit ships its types as source
 * (`src/index.ts`) and calls it, so the project typecheck needs the name to
 * exist. Declared here, optional, so nothing else starts relying on it.
 */
interface ErrorConstructor {
  captureStackTrace?(targetObject: object, constructorOpt?: Function): void;
}
