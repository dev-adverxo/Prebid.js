import * as utils from 'src/utils';
import {config} from 'src/config';
import {registerBidder} from 'src/adapters/bidderFactory';
import {BANNER, VIDEO, NATIVE} from 'src/mediaTypes.js';
import { ortbConverter as OrtbConverter } from '../libraries/ortbConverter/converter.js';

const BIDDER_CODE = 'adverxo';
const GVLID = 0; // TODO, NoCommit, 9/10/24: Ponerlo

const ENDPOINT_URL_AD_UNIT_PLACEHOLDER = '{AD_UNIT}';
const ENDPOINT_URL_AUTH_PLACEHOLDER = '{AUTH}';
const ENDPOINT_URL = `http://localhost:7080/auction?id=${ENDPOINT_URL_AD_UNIT_PLACEHOLDER}&auth=${ENDPOINT_URL_AUTH_PLACEHOLDER}`; // TODO, NoCommit, 9/10/24: Poner el dominio correcto

const AVX_SYNC_IFRAME = 1;
const AVX_SYNC_IMAGE = 2;
const PBS_SYNC_TYPES = {
  1: 'iframe',
  2: 'image'
};

const NATIVE_MTYPE = 4;

const ortbConverter = OrtbConverter({
  context: {
    netRevenue: true,
    ttl: 60,
  },
  request: function request(buildRequest, imps, bidderRequest, context) {
     const request = buildRequest(imps, bidderRequest, context);

     utils.deepSetValue(request, 'device.ip', "caller");
     utils.deepSetValue(request, 'regs', adverxoUtils.buildOrtbRegulations(bidderRequest));
     utils.deepSetValue(request, 'ext.avx_usersync', adverxoUtils.getAllowedUserSyncMethod(bidderRequest));

     return request;
  },
  bidResponse: function(buildBidResponse, bid, context) {
      if(bid.mtype === NATIVE_MTYPE){
        if(typeof bid?.adm === 'string'){
          bid.adm = bid.adm.replaceAll("${AUCTION_PRICE}", "");
          bid.adm = JSON.parse(bid.adm);
        }

        if(bid?.adm?.native) {
          bid.adm = bid.adm.native;
        }
      }

      return buildBidResponse(bid, context);
  }
});

const userSyncUtils = {
  /**
   * Checks if configuration allows specified sync method
   * @param syncRule {Object}
   * @param bidderCode {string}
   * @returns {boolean}
   */
  isSyncAllowed: function (syncRule, bidderCode) {
    if (!syncRule) {
      return false;
    }

    const bidders = utils.isArray(syncRule.bidders) ? syncRule.bidders : [bidderCode];
    const rule = syncRule.filter === 'include';

    return utils.contains(bidders, bidderCode) === rule;
  },

  /**
   * Get preferred user-sync method based on publisher configuration
   * @param bidderCode {string}
   * @returns {number|null}
   */
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
    /**
     * Build auctionUrl for AdUnit
     *
     * @param {number} adUnitId
     * @param {string} adUnitAuth
     * @returns string
     */
    buildAuctionUrl: function(adUnitId, adUnitAuth) {
      return ENDPOINT_URL
          .replace(ENDPOINT_URL_AD_UNIT_PLACEHOLDER, adUnitId)
          .replace(ENDPOINT_URL_AUTH_PLACEHOLDER, adUnitAuth);
    },

    /**
     * Extract userSync from ortb response
     *
     * @param {ServerResponse} serverResponse
     * @return {UserSync[]} The user syncs which should be dropped.
     */
    extractUserSyncFromResponse: function(serverResponse) {
      const userSyncs = (serverResponse?.body?.ext?.avx_usersync || []);
      return userSyncs.map(({url, type}) => ({type: PBS_SYNC_TYPES[type], url: url}))
    },

    /**
     * Create user privacy regulations object
     * @param bidderRequest {BidderRequest}
     * @returns {{regs: Object}} ortb regulations object
     */
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

    /**
     * Build user sync method info
     * @param bidderRequest {BidderRequest}
     * @returns {int|null} userSync method
     */
    getAllowedUserSyncMethod: function (bidderRequest) {
      const {bidderCode} = bidderRequest;
      return userSyncUtils.getAllowedSyncMethod(bidderCode);
    },

    /**
     * Group given array of bidRequests by params.publisher
     *
     * @param {BidRequest[]} bidRequests
     * @returns {Map.<Object, BidRequest[]>}
     */
    groupBidRequestsByAdUnit: function (bidRequests) {
      const groupedBidRequests = new Map();

      bidRequests.forEach(bidRequest => {
        const adUnit = {
          id: bidRequest.params.adUnitId,
          auth: bidRequest.params.auth
        };

        if (!groupedBidRequests.get(adUnit)) {
          groupedBidRequests.set(adUnit, []);
        }

        groupedBidRequests.get(adUnit).push(bidRequest);
      });

      return groupedBidRequests;
    }
};

export const spec = {
    code: BIDDER_CODE,
    gvlid: GVLID,
    supportedMediaTypes: [BANNER, VIDEO, NATIVE],
    aliases: [],

    /**
     * Determines whether or not the given bid request is valid.
     *
     * @param {BidRequest} bid The bid params to validate.
     * @return boolean True if this is a valid bid, and false otherwise.
     */
    isBidRequestValid: function(bid) {
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

        return true;
    },

    /**
     * Make a server request from the list of BidRequests.
     *
     * @param {validBidRequests[]} - an array of bids
     * @return ServerRequest Info describing the request to the server.
     */
    buildRequests: function(validBidRequests, bidderRequest) {
      const result = [];

      const bidRequestsByAdUnit = adverxoUtils.groupBidRequestsByAdUnit(validBidRequests);

      bidRequestsByAdUnit.forEach((adUnitBidRequests, adUnit) => {
        const ortbRequest = ortbConverter.toORTB({
          bidRequests: adUnitBidRequests,
          bidderRequest
        });

        result.push({
           method: 'POST',
           url: adverxoUtils.buildAuctionUrl(adUnit.id, adUnit.auth),
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
     * @return {Bid[]} An array of bids which were nested inside the server.
     */
    interpretResponse: function(serverResponse, bidRequest) {
      if (!serverResponse || !bidRequest) {
        return [];
      }

      return ortbConverter.fromORTB({
        response: serverResponse.body,
        request: bidRequest.data,
      }).bids;
    },

    /**
     * Register the user sync pixels which should be dropped after the auction.
     *
     * @param {SyncOptions} syncOptions Which user syncs are allowed?
     * @param {ServerResponse[]} serverResponses List of server's responses.
     * @return {UserSync[]} The user syncs which should be dropped.
     */
    getUserSyncs: function(syncOptions, serverResponses) {
        if (!serverResponses?.length || (!syncOptions.iframeEnabled && !syncOptions.pixelEnabled)) {
          return [];
        }

        return serverResponses.map(serverResponse => adverxoUtils.extractUserSyncFromResponse(serverResponse))
          .flat();
    }
}

registerBidder(spec);
