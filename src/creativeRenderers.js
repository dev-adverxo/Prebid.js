import {PbPromise} from './utils/promise.js';
import {createInvisibleIframe} from './utils.js';
import {RENDERER} from '../libraries/creative-renderer-display/renderer.js';
import {hook} from './hook.js';

// the minimum rendererVersion that will be used by PUC
export const PUC_MIN_VERSION = 3;

export const getCreativeRendererSource = hook('sync', function (bidResponse) {
  return RENDERER;
})

export const getCreativeRenderer = (function() {
  const renderers = {};
  return function (bidResponse) {
    const src = getCreativeRendererSource(bidResponse);
    if (!renderers.hasOwnProperty(src)) {
      renderers[src] = new PbPromise((resolve) => {
        const iframe = createInvisibleIframe();
        iframe.srcdoc = `<script>${src}</script>`;
        iframe.onload = () => resolve(iframe.contentWindow.render);
        document.body.appendChild(iframe);
      })
    }
    return renderers[src];
  }
})();
