/**
 * A tiny SVG document builder.
 *
 * The whole art style lives on top of this: every shape gets a soft vertical
 * gradient (light from the upper-left), a chunky dark outline and an optional
 * rim light. That combination is what gives the units their moulded,
 * illustrated look instead of the flat look you get from plain fills.
 */
import { darken, lighten, tones, withAlpha, type Tones } from '../core/color';

export interface StrokeOpts {
  /** Outline width in art units. 0 disables the outline. */
  width?: number;
  color?: string;
}

export interface FillOpts extends StrokeOpts {
  /** Gradient direction in degrees; 0 = top-to-bottom. */
  angle?: number;
  /** 0 = flat base colour, 1 = full light-to-shadow ramp. */
  depth?: number;
  /** Extra opacity for the whole shape. */
  alpha?: number;
}

/**
 * Gradient ids must be unique per document, and documents get composed into
 * other documents (a character sheet nests every part), so the counter is
 * process-global rather than per-instance.
 */
let idCounter = 0;

export class Svg {
  private readonly defs: string[] = [];
  private readonly body: string[] = [];

  constructor(readonly w: number, readonly h: number) {}

  nextId(prefix = 'd'): string {
    idCounter += 1;
    return `${prefix}${idCounter}`;
  }

  raw(markup: string): this {
    this.body.push(markup);
    return this;
  }

  def(markup: string): this {
    this.defs.push(markup);
    return this;
  }

  /** Linear gradient between arbitrary stops. Returns a `url(#id)` reference. */
  gradient(stops: Array<[offset: number, color: string, opacity?: number]>, angle = 0): string {
    const id = this.nextId('lg');
    const rad = ((angle - 90) * Math.PI) / 180;
    const x1 = 0.5 - Math.cos(rad) * 0.5;
    const y1 = 0.5 - Math.sin(rad) * 0.5;
    const x2 = 0.5 + Math.cos(rad) * 0.5;
    const y2 = 0.5 + Math.sin(rad) * 0.5;
    const inner = stops
      .map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op === undefined ? '' : ` stop-opacity="${op}"`}/>`)
      .join('');
    this.def(
      `<linearGradient id="${id}" x1="${x1.toFixed(4)}" y1="${y1.toFixed(4)}" x2="${x2.toFixed(4)}" y2="${y2.toFixed(4)}">${inner}</linearGradient>`,
    );
    return `url(#${id})`;
  }

  /** Straight top-to-bottom gradient; offset 0 is the top edge. */
  vGradient(stops: Array<[offset: number, color: string, opacity?: number]>): string {
    const id = this.nextId('vg');
    const inner = stops
      .map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op === undefined ? '' : ` stop-opacity="${op}"`}/>`)
      .join('');
    this.def(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${inner}</linearGradient>`);
    return `url(#${id})`;
  }

  radial(
    stops: Array<[offset: number, color: string, opacity?: number]>,
    cx = 0.5,
    cy = 0.5,
    r = 0.5,
  ): string {
    const id = this.nextId('rg');
    const inner = stops
      .map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op === undefined ? '' : ` stop-opacity="${op}"`}/>`)
      .join('');
    this.def(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${inner}</radialGradient>`);
    return `url(#${id})`;
  }

  /**
   * The house body-fill: highlight at the top, base in the middle, shadow at
   * the bottom - a single key light from above, applied to every shape in the
   * game. Pass an angle to shade across a rotated shape instead (limbs do).
   */
  bodyFill(color: string, opts: FillOpts = {}): string {
    const t = tones(color);
    const depth = opts.depth ?? 1;
    const stops: Array<[number, string]> = [
      [0, lighten(t.base, 0.42 * depth)],
      [0.42, t.base],
      [1, darken(t.base, 0.3 * depth)],
    ];
    return opts.angle ? this.gradient(stops, opts.angle) : this.vGradient(stops);
  }

  private strokeAttrs(color: string, opts: StrokeOpts): string {
    const w = opts.width ?? 0;
    if (w <= 0) return 'stroke="none"';
    const c = opts.color ?? darken(color, 0.62);
    return `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  }

  path(d: string, color: string, opts: FillOpts = {}): this {
    const fill = opts.depth === 0 ? color : this.bodyFill(color, opts);
    const alpha = opts.alpha === undefined ? '' : ` opacity="${opts.alpha}"`;
    return this.raw(`<path d="${d}" fill="${fill}" ${this.strokeAttrs(color, opts)}${alpha}/>`);
  }

  /** Flat-filled path — used for details that must not pick up a gradient. */
  flat(d: string, fill: string, opts: StrokeOpts & { alpha?: number } = {}): this {
    const alpha = opts.alpha === undefined ? '' : ` opacity="${opts.alpha}"`;
    return this.raw(`<path d="${d}" fill="${fill}" ${this.strokeAttrs(fill, opts)}${alpha}/>`);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, opts: FillOpts = {}): this {
    const fill = opts.depth === 0 ? color : this.bodyFill(color, opts);
    const alpha = opts.alpha === undefined ? '' : ` opacity="${opts.alpha}"`;
    return this.raw(
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${this.strokeAttrs(color, opts)}${alpha}/>`,
    );
  }

  circle(cx: number, cy: number, r: number, color: string, opts: FillOpts = {}): this {
    return this.ellipse(cx, cy, r, r, color, opts);
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string,
    opts: FillOpts = {},
  ): this {
    const fill = opts.depth === 0 ? color : this.bodyFill(color, opts);
    const alpha = opts.alpha === undefined ? '' : ` opacity="${opts.alpha}"`;
    return this.raw(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" ${this.strokeAttrs(color, opts)}${alpha}/>`,
    );
  }

  /** A rounded capsule between two points — the workhorse for limbs. */
  capsule(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    color: string,
    opts: FillOpts = {},
  ): this {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 0.0001;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
    const r = thickness / 2;
    const fill = opts.depth === 0 ? color : this.bodyFill(color, { ...opts, angle: 90 });
    const alpha = opts.alpha === undefined ? '' : ` opacity="${opts.alpha}"`;
    return this.raw(
      `<g transform="translate(${x1} ${y1}) rotate(${angle.toFixed(3)})">` +
        `<rect x="${-r}" y="${-r}" width="${thickness}" height="${len + thickness}" rx="${r}" ry="${r}" ` +
        `fill="${fill}" ${this.strokeAttrs(color, opts)}${alpha}/></g>`,
    );
  }

  /** A soft white sheen laid over a shape to fake a specular highlight. */
  sheen(d: string, strength = 0.4): this {
    return this.raw(`<path d="${d}" fill="#ffffff" opacity="${strength}"/>`);
  }

  /** A soft drop shadow ellipse — every unit stands on one. */
  groundShadow(cx: number, cy: number, rx: number, ry: number, strength = 0.34): this {
    const g = this.radial([
      [0, `rgba(15,10,25,${strength})`],
      [0.62, `rgba(15,10,25,${strength * 0.55})`],
      [1, 'rgba(15,10,25,0)'],
    ]);
    return this.raw(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${g}"/>`);
  }

  /** An outer glow blob, used for magic, embers and eyes. */
  glow(cx: number, cy: number, r: number, color: string, strength = 0.85): this {
    const g = this.radial([
      [0, withAlpha(color, strength)],
      [0.35, withAlpha(color, strength * 0.55)],
      [1, withAlpha(color, 0)],
    ]);
    return this.raw(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${g}"/>`);
  }

  group(attrs: string, build: (svg: Svg) => void): this {
    const inner = new Svg(this.w, this.h);
    build(inner);
    for (const d of inner.defs) this.def(d);
    return this.raw(`<g ${attrs}>${inner.body.join('')}</g>`);
  }

  /**
   * @param scale renders the document at a multiple of its authored size.
   *   The viewBox is unchanged, so the drawing is identical - only the
   *   intrinsic pixel size grows, which is how textures are supersampled.
   */
  toString(scale = 1): string {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w * scale}" height="${this.h * scale}" ` +
      `viewBox="0 0 ${this.w} ${this.h}">` +
      (this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '') +
      this.body.join('') +
      '</svg>'
    );
  }

  toDataUri(scale = 1): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.toString(scale))}`;
  }
}

export type { Tones };

/** Convenience: build a document without keeping a local variable around. */
export function draw(w: number, h: number, build: (svg: Svg) => void): Svg {
  const svg = new Svg(w, h);
  build(svg);
  return svg;
}
