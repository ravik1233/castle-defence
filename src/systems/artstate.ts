/**
 * Which units have drawn animation frames.
 *
 * The registry knows this once the painted manifest is read, but the profile
 * and the menus must not import the registry - it drags Phaser in with it.
 * So the registry publishes the set here, and anything that needs to know
 * whether a unit is actually drawable reads it from a module that imports
 * nothing.
 *
 * Before the manifest is read the set is empty, which is why `hasFrames`
 * answers false rather than throwing: a unit that needs frames simply is not
 * offered yet.
 */
const framed = new Set<string>();

export function setFramedArt(ids: Iterable<string>): void {
  framed.clear();
  for (const id of ids) framed.add(id);
}

export function hasFrames(artId: string): boolean {
  return framed.has(artId);
}
