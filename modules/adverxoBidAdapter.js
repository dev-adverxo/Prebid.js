import * as utils from '../src/utils.js';
import {config} from '../src/config.js';
import {registerBidder} from '../src/adapters/bidderFactory.js';
import {BANNER, VIDEO, NATIVE} from '../src/mediaTypes.js';
import {ortbConverter as OrtbConverter} from '../libraries/ortbConverter/converter.js';
import {Renderer} from '../src/Renderer.js';

/**
 * @typedef {import('../src/adapters/bidderFactory.js').Bid} Bid
 * @typedef {import('../src/adapters/bidderFactory.js').BidRequest} BidRequest
 * @typedef {import('../src/adapters/bidderFactory.js').ServerRequest} ServerRequest
 * @typedef {import('../src/adapters/bidderFactory.js').ServerResponse} ServerResponse
 * @typedef {import('../src/auction.js').BidderRequest} BidderRequest
 * @typedef {import('../src/adapters/bidderFactory.js').SyncOptions} SyncOptions
 * @typedef {import('../src/adapters/bidderFactory.js').UserSync} UserSync
 */

const BIDDER_CODE = 'adverxo';
const GVLID = 0; // TODO, NoCommit, 9/10/24: Ponerlo

const ENDPOINT_URL_AD_UNIT_PLACEHOLDER = '{AD_UNIT}';
const ENDPOINT_URL_AUTH_PLACEHOLDER = '{AUTH}';
const ENDPOINT_URL_HOST_PLACEHOLDER = '{HOST}';
const ENDPOINT_URL = `https://${ENDPOINT_URL_HOST_PLACEHOLDER}/auction?id=${ENDPOINT_URL_AD_UNIT_PLACEHOLDER}&auth=${ENDPOINT_URL_AUTH_PLACEHOLDER}`;

const AVX_SYNC_IFRAME = 1;
const AVX_SYNC_IMAGE = 2;
const PBS_SYNC_TYPES = {
  1: 'iframe',
  2: 'image'
};

const ORTB_MTYPES = {
  1: BANNER,
  2: VIDEO,
  4: NATIVE
};

const DEFAULT_CURRENCY = 'USD';

const ortbConverter = OrtbConverter({
  context: {
    netRevenue: true,
    ttl: 60,
  },
  request: function request(buildRequest, imps, bidderRequest, context) {
    const request = buildRequest(imps, bidderRequest, context);

    utils.deepSetValue(request, 'device.ip', 'caller');
    utils.deepSetValue(request, 'regs', adverxoUtils.buildOrtbRegulations(bidderRequest));
    utils.deepSetValue(request, 'ext.avx_usersync', adverxoUtils.getAllowedUserSyncMethod(bidderRequest));
    utils.deepSetValue(request, 'ext.avx_add_vast_url', 1);

    return request;
  },
  imp(buildImp, bidRequest, context) {
    const imp = buildImp(bidRequest, context);
    const floor = adverxoUtils.getBidFloor(bidRequest);

    if (floor) {
      imp.bidfloor = floor;
      imp.bidfloorcur = DEFAULT_CURRENCY;
    }

    return imp;
  },
  bidResponse: function (buildBidResponse, bid, context) {
    if (FEATURES.NATIVE && ORTB_MTYPES[bid.mtype] === NATIVE) {
      if (typeof bid?.adm === 'string') {
        bid.adm = JSON.parse(bid.adm);
      }

      if (bid?.adm?.native) {
        bid.adm = bid.adm.native;
      }
    }

    const result = buildBidResponse(bid, context)

    if (FEATURES.VIDEO) {
      if (bid?.ext?.avx_vast_url) {
        result.vastUrl = bid.ext.avx_vast_url;
      }

      if (bid?.ext?.avx_video_renderer_url) {
        result.avxVideoRendererUrl = bid.ext.avx_video_renderer_url;
      }
    }

    return result;
  }
});

const videoUtils = {
  createOutstreamVideoRenderer: function (bid) {
    const renderer = Renderer.install({
      id: bid.bidId,
      url: bid.avxVideoRendererUrl,
      loaded: false,
      adUnitCode: bid.adUnitCode
    })

    try {
      renderer.setRender(this.outstreamRender.bind(this));
    } catch (err) {
      utils.logWarn('Prebid Error calling setRender on renderer', err);
    }

    return renderer;
  },

  outstreamRender: function (bid, doc) {
    bid.renderer.push(() => {
      const win = (doc) ? doc.defaultView : window;

      win.adxVideoRenderer.renderAd({
        targetId: bid.adUnitCode,
        adResponse: {content: bid.vastXml}
      });
    });
  }
};

const userSyncUtils = {
  isSyncAllowed: function (syncRule, bidderCode) {
    if (!syncRule) {
      return false;
    }

    const bidders = utils.isArray(syncRule.bidders) ? syncRule.bidders : [bidderCode];
    const rule = syncRule.filter === 'include';

    return utils.contains(bidders, bidderCode) === rule;
  },

  getAllowedSyncMethod: function (bidderCode) {
    if (!config.getConfig('userSync.syncEnabled')) {
      return null;
    }

    const filterConfig = config.getConfig('userSync.filterSettings');

    if (this.isSyncAllowed(filterConfig.all, bidderCode) || this.isSyncAllowed(filterConfig.iframe, bidderCode)) {
      return AVX_SYNC_IFRAME;
    } else if (this.isSyncAllowed(filterConfig.image, bidderCode)) {
      return AVX_SYNC_IMAGE;
    }

    return null;
  }
};

const adverxoUtils = {
  buildAuctionUrl: function (host, adUnitId, adUnitAuth) {
    return ENDPOINT_URL
      .replace(ENDPOINT_URL_HOST_PLACEHOLDER, host)
      .replace(ENDPOINT_URL_AD_UNIT_PLACEHOLDER, adUnitId)
      .replace(ENDPOINT_URL_AUTH_PLACEHOLDER, adUnitAuth);
  },

  extractUserSyncFromResponse: function (serverResponse) {
    const userSyncs = (serverResponse?.body?.ext?.avx_usersync || []);
    return userSyncs.map(({url, type}) => ({type: PBS_SYNC_TYPES[type], url: url}))
  },

  buildOrtbRegulations: function (bidderRequest) {
    const {gdprConsent, uspConsent, gppConsent} = bidderRequest;
    const ext = {};

    if (gdprConsent) {
      ext.gdpr = Number(gdprConsent.gdprApplies);
      ext.gdpr_consent = gdprConsent.consentString;
    }

    if (gppConsent) {
      ext.gpp = gppConsent.gppString;
      ext.gpp_sid = gppConsent.applicableSections;
    }

    if (uspConsent) {
      ext.us_privacy = uspConsent;
    }

    return {
      coppa: config.getConfig('coppa') ? 1 : 0,
      ext
    };
  },

  getAllowedUserSyncMethod: function (bidderRequest) {
    const {bidderCode} = bidderRequest;
    return userSyncUtils.getAllowedSyncMethod(bidderCode);
  },

  groupBidRequestsByAdUnit: function (bidRequests) {
    const groupedBidRequests = new Map();

    bidRequests.forEach(bidRequest => {
      const adUnit = {
        host: bidRequest.params.host,
        id: bidRequest.params.adUnitId,
        auth: bidRequest.params.auth,
      };

      if (!groupedBidRequests.get(adUnit)) {
        groupedBidRequests.set(adUnit, []);
      }

      groupedBidRequests.get(adUnit).push(bidRequest);
    });

    return groupedBidRequests;
  },

  getBidFloor: function (bid) {
    if (utils.isFn(bid.getFloor)) {
      const floor = bid.getFloor({
        currency: DEFAULT_CURRENCY,
        mediaType: '*',
        size: '*',
      });

      if (utils.isPlainObject(floor) && !isNaN(floor.floor) && floor.currency === DEFAULT_CURRENCY) {
        return floor.floor;
      }
    }

    return null;
  }
};

export const spec = {
  code: BIDDER_CODE,
  gvlid: GVLID,
  supportedMediaTypes: [BANNER, NATIVE, VIDEO],
  aliases: [],

  /**
   * Determines whether the given bid request is valid.
   *
   * @param {BidRequest} bid The bid params to validate.
   * @return {boolean} True if this is a valid bid, and false otherwise.
   */
  isBidRequestValid: function (bid) {
    if (!utils.isPlainObject(bid.params) || !Object.keys(bid.params).length) {
      utils.logWarn('Adverxo Bid Adapter: bid params must be provided.');
      return false;
    }

    if (!bid.params.adUnitId || typeof bid.params.adUnitId !== 'number') {
      utils.logWarn('Adverxo Bid Adapter: adUnitId bid param is required and must be a number');
      return false;
    }

    if (!bid.params.adUnitId || typeof bid.params.auth !== 'string') {
      utils.logWarn('Adverxo Bid Adapter: auth bid param is required and must be a string');
      return false;
    }

    if (!bid.params.host || typeof bid.params.host !== 'string') {
      utils.logWarn('Adverxo Bid Adapter: host bid param is required and must be a string');
      return false;
    }

    return true;
  },

  /**
   * Make a server request from the list of BidRequests.
   *
   * @param {BidRequest[]} validBidRequests an array of bids
   * @param {BidderRequest} bidderRequest an array of bids
   * @return {ServerRequest} Info describing the request to the server.
   */
  buildRequests: function (validBidRequests, bidderRequest) {
    const result = [];

    const bidRequestsByAdUnit = adverxoUtils.groupBidRequestsByAdUnit(validBidRequests);

    bidRequestsByAdUnit.forEach((adUnitBidRequests, adUnit) => {
      const ortbRequest = ortbConverter.toORTB({
        bidRequests: adUnitBidRequests,
        bidderRequest
      });

      result.push({
        method: 'POST',
        url: adverxoUtils.buildAuctionUrl(adUnit.host, adUnit.id, adUnit.auth),
        data: ortbRequest,
        bids: adUnitBidRequests
      });
    });

    return result;
  },

  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {ServerResponse} serverResponse A successful response from the server.
   * @param {BidRequest} bidRequest Adverxo bidRequest
   * @return {Bid[]} An array of bids which were nested inside the server.
   */
  interpretResponse: function (serverResponse, bidRequest) {
    if (!serverResponse || !bidRequest) {
      return [];
    }

    const bids = ortbConverter.fromORTB({
      response: serverResponse.body,
      request: bidRequest.data,
    }).bids;

    return bids.map((bid) => {
      const thisRequest = utils.getBidRequest(bid.requestId, [bidRequest]);
      const context = utils.deepAccess(thisRequest, 'mediaTypes.video.context');

      if (FEATURES.VIDEO && bid.mediaType === 'video' && context === 'outstream') {
        bid.renderer = videoUtils.createOutstreamVideoRenderer(bid);
      }

      return bid;
    });
  },

  /**
   * Register the user sync pixels which should be dropped after the auction.
   *
   * @param {SyncOptions} syncOptions Which user syncs are allowed?
   * @param {ServerResponse[]} serverResponses List of server's responses.
   * @return {UserSync[]} The user syncs which should be dropped.
   */
  getUserSyncs: function (syncOptions, serverResponses) {
    if (!serverResponses?.length || (!syncOptions.iframeEnabled && !syncOptions.pixelEnabled)) {
      return [];
    }

    return serverResponses.map(serverResponse => adverxoUtils.extractUserSyncFromResponse(serverResponse))
      .flat();
  }
}

registerBidder(spec);
