/** Materials and incident light shared by terrain and placed structures. */
import type { BiomeId } from './scenery';

export interface EnvironmentMaterial {
  name: string;
  soil: string;
  grain: string;
  growth: string;
  stone: string;
  shadow: string;
  light: number;
  baseLight: number;
  wet: boolean;
  paving: boolean;
}

export const ENVIRONMENT_MATERIAL: Record<BiomeId, EnvironmentMaterial> = {
  fields: { name: 'trampled soil and meadow grass', soil: '#655d39', grain: '#a99c62', growth: '#71813f', stone: '#827966', shadow: '#242b1b', light: 0xfff8e8, baseLight: 0xdedbc1, wet: false, paving: false },
  barrows: { name: 'damp peat and moss', soil: '#39413b', grain: '#6d8073', growth: '#546d58', stone: '#64716e', shadow: '#152724', light: 0xd8e9e5, baseLight: 0xa8c0b6, wet: true, paving: false },
  woods: { name: 'ash and fallen leaves', soil: '#494037', grain: '#827055', growth: '#69634b', stone: '#6f6561', shadow: '#261f26', light: 0xece0d2, baseLight: 0xbdb0a3, wet: false, paving: false },
  highland: { name: 'weathered gravel and bedrock', soil: '#666452', grain: '#a79e80', growth: '#757963', stone: '#7a7c75', shadow: '#2b3030', light: 0xe8edf0, baseLight: 0xbfc6bf, wet: false, paving: false },
  coast: { name: 'wet sand and salt-worn stone', soil: '#777c70', grain: '#bec5b0', growth: '#5e8275', stone: '#788c8d', shadow: '#203a41', light: 0xd9edf2, baseLight: 0xaac9cd, wet: true, paving: false },
  abyss: { name: 'cooled slag and volcanic dust', soil: '#49383d', grain: '#88604b', growth: '#5d4242', stone: '#615056', shadow: '#21131e', light: 0xf2cfbc, baseLight: 0xba8e88, wet: false, paving: true },
  throne: { name: 'scuffed obsidian paving', soil: '#493544', grain: '#82606d', growth: '#5d3f50', stone: '#62505f', shadow: '#211321', light: 0xe9cbd5, baseLight: 0xb591a5, wet: false, paving: true },
};
