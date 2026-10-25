import { useEffect, useSyncExternalStore } from "react";
import { Howl } from "howler";

/** A first check-in must not be silent because its sound failed to load. */
const RETRY_MS = 5000;

const sounds = new Map<string, Howl>();
const ready = new Set<string>();
const retryTimers = new Map<string, number>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function prime(src: string) {
  if (sounds.has(src)) return;
  const sound = new Howl({ src: [src], preload: false });
  sounds.set(src, sound);
  sound.once("load", () => {
    ready.add(src);
    notify();
  });
  sound.on("loaderror", (_id, error) => {
    // A browser without the codec will never load this file, so retrying it
    // forever would strand the booth on the loading screen.
    if (
      /codec|No audio support|Decoding audio data failed/i.test(String(error))
    ) {
      ready.add(src);
      notify();
      return;
    }
    if (retryTimers.has(src)) return;
    retryTimers.set(
      src,
      window.setTimeout(() => {
        retryTimers.delete(src);
        sound.load();
      }, RETRY_MS),
    );
  });
  sound.load();
}

function release(src: string) {
  const timer = retryTimers.get(src);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    retryTimers.delete(src);
  }
  const sound = sounds.get(src);
  // unload() does not abort an in-flight request or remove Howl listeners.
  sound?.off();
  sound?.unload();
  sounds.delete(src);
  ready.delete(src);
}

/**
 * Loads the page's sound effects once and reports whether all of them are
 * ready. Dialogs and the battery alert play these same instances through
 * playSound, so the first check-in does not wait on its own download.
 */
export function useSounds(sources: readonly string[]): boolean {
  const loaded = useSyncExternalStore(subscribe, () =>
    sources.every((src) => ready.has(src)),
  );
  useEffect(() => {
    sources.forEach(prime);
    return () => sources.forEach(release);
  }, [sources]);
  return loaded;
}

export function playSound(src: string) {
  sounds.get(src)?.play();
}
