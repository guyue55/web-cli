import type { Terminal as XTerm } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { SearchAddon } from '@xterm/addon-search';
import type { Unicode11Addon } from '@xterm/addon-unicode11';
import type { WebLinksAddon } from '@xterm/addon-web-links';
import type { WebglAddon } from '@xterm/addon-webgl';

export interface XTermRuntime {
  Terminal: typeof XTerm;
  FitAddon: typeof FitAddon;
  Unicode11Addon: typeof Unicode11Addon;
  WebLinksAddon: typeof WebLinksAddon;
  SearchAddon: typeof SearchAddon;
}

export async function loadXTermRuntime(): Promise<XTermRuntime> {
  const [
    xtermModule,
    fitAddonModule,
    unicode11AddonModule,
    webLinksAddonModule,
    searchAddonModule,
  ] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-unicode11'),
    import('@xterm/addon-web-links'),
    import('@xterm/addon-search'),
  ]);

  return {
    Terminal: xtermModule.Terminal,
    FitAddon: fitAddonModule.FitAddon,
    Unicode11Addon: unicode11AddonModule.Unicode11Addon,
    WebLinksAddon: webLinksAddonModule.WebLinksAddon,
    SearchAddon: searchAddonModule.SearchAddon,
  };
}

export async function loadWebglAddon(): Promise<typeof WebglAddon | null> {
  try {
    const module = await import('@xterm/addon-webgl');
    return module.WebglAddon;
  } catch {
    return null;
  }
}
