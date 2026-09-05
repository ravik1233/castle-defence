/// <reference types="vite/client" />

/**
 * Compile-time flag injected by vite.config.ts. True only in QA builds, which
 * keep the battle test hooks so the smoke test can drive a production bundle.
 */
declare const __QA_BUILD__: boolean;
