/** Types for strip.mjs, which the importer runs as plain JS and the tests import. */
export type Run = [number, number];
export function splitPoses(filled: number[], width: number): Run[];
export function mergeToCount(runs: Run[], want: number): Run[];
export function frameScales(heights: number[], target: number): number[];
