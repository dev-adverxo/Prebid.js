import {expect} from 'chai';
import {spec} from 'modules/adverxoBidAdapter.js';
import {config} from 'src/config';

describe('Adverxo Bid Adapter', () => {
  const bannerBidRequests = [
    {
      bidId: 'bid-banner',
      bidder: 'adverxo',
      adUnitCode: 'adunit-code',
      mediaTypes: {banner: {sizes: [[300, 250]]}},
      params: {
        adUnitId: 1,
        auth: "authExample"
      },
      bidderRequestId: 'test-bidder-request-id',
    },
  ];

  const bannerBidderRequest = {
    bidderCode: 'adverxo',
    bidderRequestId: 'test-bidder-request-id',
    bids: bannerBidRequests,
    auctionId: 'new-auction-id'
  };

  const nativeOrtbRequest = {
    assets: [
      {
        id: 1,
        required: 1,
        img: {type: 3, w: 150, h: 50,}
      },
      {
        id: 2,
        required: 1,
        title: {len: 80}
      },
      {
        id: 3,
        required: 0,
        data: {type: 1}
      }
    ]
  };

  const nativeBidRequests = [
    {
      bidId: 'bid-native',
      mediaTypes: {
        native: {
          ortb: nativeOrtbRequest
        }
      },
      nativeOrtbRequest,
      params: {
        adUnitId: 1,
        auth: "authExample"
      }
    },
  ];

  const nativeBidderRequest = {
    bidderCode: 'adverxo',
    bidderRequestId: 'test-bidder-request-id',
    bids: nativeBidRequests,
    auctionId: 'new-auction-id'
  };

  const videoBidRequests = [
    {
      bidId: 'bid-video',
      mediaTypes: {
        video: {
          playerSize: [400, 300],
          w: 400,
          h: 300,
          minduration: 5,
          maxduration: 10,
          startdelay: 0,
          skip: 1,
          minbitrate: 200,
          protocols: [1, 2, 4]
        }
      },
      params: {
        adUnitId: 1,
        auth: "authExample"
      }
    }
  ];

  const videoBidderRequest = {
    bidderCode: 'adverxo',
    bidderRequestId: 'test-bidder-request-id',
    bids: videoBidRequests,
    auctionId: 'new-auction-id'
  };


  afterEach(function () {
    config.resetConfig();
  });

  describe('isBidRequestValid', function () {
    it('should validate bid request with valid params', () => {
      const validBid = makeBidRequestWithParams({
        adUnitId: 1,
        auth: "authExample"
      });

      const isValid = spec.isBidRequestValid(validBid);

      expect(isValid).to.be.true;
    });

    it('should not validate bid request with empty params', () => {
      const invalidBid = makeBidRequestWithParams({});

      const isValid = spec.isBidRequestValid(invalidBid);

      expect(isValid).to.be.false;
    });

    it('should not validate bid request with missing param(adUnitId)', () => {
      const invalidBid = makeBidRequestWithParams({
        auth: "authExample"
      });

      const isValid = spec.isBidRequestValid(invalidBid);

      expect(isValid).to.be.false;
    });

    it('should not validate bid request with missing param(auth)', () => {
      const invalidBid = makeBidRequestWithParams({
        adUnitId: 1
      });

      const isValid = spec.isBidRequestValid(invalidBid);

      expect(isValid).to.be.false;
    });
  });

  describe('buildRequests', () => {
    it('should build post request for banner', () => {
      const request = spec.buildRequests(bannerBidRequests, bannerBidderRequest)[0];

      expect(request.method).to.equal('POST');
      expect(request.url).to.equal("http://localhost:7080/auction?id=1&auth=authExample");
      expect(request.data.device.ip).to.equal("caller");
      expect(request.data.ext.avx_add_vast_url).to.equal(1);
    });

    if (FEATURES.NATIVE) {
      it('should build post request for native', () => {
        const request = spec.buildRequests(nativeBidRequests, nativeBidderRequest)[0];

        expect(request.method).to.equal('POST');
        expect(request.url).to.equal("http://localhost:7080/auction?id=1&auth=authExample");

        const nativeRequest = JSON.parse(request.data.imp[0]['native'].request);

        expect(nativeRequest.assets).to.have.lengthOf(3);

        expect(nativeRequest.assets[0]).to.deep.equal({
          id: 1,
          required: 1,
          img: {w: 150, h: 50, type: 3}
        });

        expect(nativeRequest.assets[1]).to.deep.equal({
          id: 2,
          required: 1,
          title: {len: 80}
        });

        expect(nativeRequest.assets[2]).to.deep.equal({
          id: 3,
          required: 0,
          data: {type: 1}
        });
      });
    }

    if (FEATURES.VIDEO) {
      it('should build post request for video', function () {
        const request = spec.buildRequests(videoBidRequests, videoBidderRequest)[0];

        expect(request.method).to.equal('POST');
        expect(request.url).to.equal("http://localhost:7080/auction?id=1&auth=authExample");

        const ortbRequest = request.data;

        expect(ortbRequest.imp).to.have.lengthOf(1);

        expect(ortbRequest.imp[0]).to.deep.equal({
          id: 'bid-video',
          video: {
            w: 400,
            h: 300,
            minduration: 5,
            maxduration: 10,
            startdelay: 0,
            skip: 1,
            minbitrate: 200,
            protocols: [1, 2, 4]
          }
        });
      });
    }
  });

  describe('user sync supported method', function () {
    it('should respect sync disabled', function () {
      config.setConfig({
        userSync: {
          syncEnabled: false,
          filterSettings: {
            all: {
              bidders: '*',
              filter: 'include'
            }
          }
        }
      });

      const bidRequests = spec.buildRequests(bannerBidRequests, bannerBidderRequest);
      expect(bidRequests).to.have.length(1);
      expect(bidRequests[0].data.ext.avx_usersync).to.be.null;
    });

    it('on all config allowed should prioritize iframe', function () {
      config.setConfig({
        userSync: {
          syncEnabled: true,
          filterSettings: {
            all: {
              bidders: '*',
              filter: 'include'
            }
          }
        }
      });

      const bidRequests = spec.buildRequests(bannerBidRequests, bannerBidderRequest);
      expect(bidRequests).to.have.length(1);
      expect(bidRequests[0].data.ext.avx_usersync).to.be.equal(1);
    });

    it('should respect exclude adverxo iframe filter', function () {
      config.setConfig({
        userSync: {
          syncEnabled: true,
          filterSettings: {
            image: {
              bidders: '*',
              filter: 'include'
            },
            iframe: {
              bidders: ['adverxo'],
              filter: 'exclude'
            }
          }
        }
      });

      const bidRequests = spec.buildRequests(bannerBidRequests, bannerBidderRequest);
      expect(bidRequests).to.have.length(1);
      expect(bidRequests[0].data.ext.avx_usersync).to.be.equal(2);
    });

    it('should respect exclude iframe filter', function () {
      config.setConfig({
        userSync: {
          syncEnabled: true,
          filterSettings: {
            image: {
              bidders: '*',
              filter: 'include'
            },
            iframe: {
              bidders: '*',
              filter: 'exclude'
            }
          }
        }
      });

      const bidRequests = spec.buildRequests(bannerBidRequests, bannerBidderRequest);
      expect(bidRequests).to.have.length(1);
      expect(bidRequests[0].data.ext.avx_usersync).to.be.equal(2);
    });

    it('should respect total exclusion', function () {
      config.setConfig({
        userSync: {
          syncEnabled: true,
          filterSettings: {
            image: {
              bidders: ['adverxo'],
              filter: 'exclude'
            },
            iframe: {
              bidders: ['adverxo'],
              filter: 'exclude'
            }
          }
        }
      });

      const bidRequests = spec.buildRequests(bannerBidRequests, bannerBidderRequest);
      expect(bidRequests).to.have.length(1);
      expect(bidRequests[0].data.ext.avx_usersync).to.be.null;
    });
  });

  describe('build user consent data', () => {
    it('shouldn\'t contain gdpr nor ccpa information for default request', function () {
      const requestData = spec.buildRequests(bannerBidRequests, bannerBidderRequest)[0].data;

      expect(requestData.regs.coppa).to.be.equal(0);
      expect(requestData.regs.ext).to.be.deep.equal({});
    });

    it('should contain gdpr-related information if consent is configured', function () {
      const bidderRequestWithConsent = {
        ...bannerBidderRequest,
        gdprConsent: {gdprApplies: true, consentString: 'test-consent-string', vendorData: {}},
        uspConsent: '1YNN',
        gppConsent: {gppString: 'DBACNYA~CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA~1YNN', applicableSections: [2]}
      };

      const requestData = spec.buildRequests(bannerBidRequests, bidderRequestWithConsent)[0].data;

      expect(requestData.regs.ext).to.be.eql({
        gdpr: 1,
        gdpr_consent: 'test-consent-string',
        gpp: 'DBACNYA~CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA~1YNN',
        gpp_sid: [2],
        us_privacy: '1YNN'
      });
    });

    it('should contain coppa if configured', function () {
      config.setConfig({coppa: true});

      const requestData = spec.buildRequests(bannerBidRequests, bannerBidderRequest)[0].data;

      expect(requestData.regs.coppa).to.be.equal(1);
    });
  });

  describe('interpretResponse', () => {
    it('should return empty array if serverResponse is not defined', () => {
      const bidRequest = spec.buildRequests(bannerBidRequests, bannerBidderRequest);
      const bids = spec.interpretResponse(undefined, bidRequest);

      expect(bids.length).to.equal(0);
    });

    it('should interpret banner response', () => {
      const bidResponse = {
        body: {
          id: 'bid-response',
          cur: 'USD',
          seatbid: [
            {
              bid: [
                {
                  impid: 'bid-banner',
                  crid: 'creative-id',
                  cur: 'USD',
                  price: 2,
                  w: 300,
                  h: 250,
                  mtype: 1,
                  adomain: ['test.com'],
                },
              ],
              seat: 'test-seat',
            },
          ],
        },
      };

      const expectedBids = [
        {
          cpm: 2,
          creativeId: 'creative-id',
          creative_id: 'creative-id',
          currency: 'USD',
          height: 250,
          mediaType: 'banner',
          meta: {
            advertiserDomains: ['test.com'],
          },
          netRevenue: true,
          requestId: 'bid-banner',
          ttl: 60,
          width: 300,
        },
      ];

      const request = spec.buildRequests(bannerBidRequests, bannerBidderRequest)[0];
      const bids = spec.interpretResponse(bidResponse, request);

      expect(bids).to.deep.equal(expectedBids);
    });

    if (FEATURES.NATIVE) {
      it('should interpret native response', () => {
        const bidResponse = {
          body: {
            id: 'native-response',
            cur: 'USD',
            seatbid: [
              {
                bid: [
                  {
                    impid: 'bid-native',
                    crid: 'creative-id',
                    cur: 'USD',
                    price: 2,
                    w: 300,
                    h: 250,
                    mtype: 4,
                    adomain: ['test.com'],
                    adm: '{"native":{"assets":[{"id":2,"title":{"text":"Title"}},{"id":3,"data":{"value":"Description"}},{"id":1,"img":{"url":"http://example.com?img","w":150,"h":50}}],"link":{"url":"http://example.com?link"}}}'
                  },
                ],
                seat: 'test-seat',
              },
            ],
          },
        };

        const expectedBids = [
          {
            cpm: 2,
            creativeId: 'creative-id',
            creative_id: 'creative-id',
            currency: 'USD',
            height: 250,
            mediaType: 'native',
            meta: {
              advertiserDomains: ['test.com'],
            },
            netRevenue: true,
            requestId: 'bid-native',
            ttl: 60,
            width: 300,
            native: {
              ortb: {
                assets: [
                  {id: 2, title: {text: "Title"}},
                  {id: 3, data: {value: "Description"}},
                  {id: 1, img: {url: "http://example.com?img", w: 150, h: 50}}
                ],
                link: {url: "http://example.com?link"}
              }
            }
          }
        ];

        const request = spec.buildRequests(nativeBidRequests, nativeBidderRequest)[0];
        const bids = spec.interpretResponse(bidResponse, request);

        expect(bids).to.deep.equal(expectedBids);
      });
    }
  });

  /*
  describe('getUserSyncs', () => {
    const SYNC_URL = 'https://cdn.btloader.com/user_sync.html';

    it('should return an empty array if no sync options are provided', () => {
      const syncs = spec.getUserSyncs({}, [], null, null, null);

      expect(syncs).to.deep.equal([]);
    });

    it('should return an empty array if no server responses are provided', () => {
      const syncs = spec.getUserSyncs(
        {iframeEnabled: true},
        [],
        null,
        null,
        null
      );

      expect(syncs).to.deep.equal([]);
    });

    it('should pass consent parameters and bidder codes in sync URL if they are provided', () => {
      const gdprConsent = {
        gdprApplies: true,
        consentString: 'GDPRConsentString123',
      };
      const gppConsent = {
        gppString: 'GPPString123',
        applicableSections: ['sectionA'],
      };
      const us_privacy = '1YNY';
      const expectedSyncUrl = new URL(SYNC_URL);
      expectedSyncUrl.searchParams.set('bidders', 'pubmatic,ix');
      expectedSyncUrl.searchParams.set('gdpr', 1);
      expectedSyncUrl.searchParams.set(
        'gdpr_consent',
        gdprConsent.consentString
      );
      expectedSyncUrl.searchParams.set('gpp', gppConsent.gppString);
      expectedSyncUrl.searchParams.set('gpp_sid', 'sectionA');
      expectedSyncUrl.searchParams.set('us_privacy', us_privacy);
      const syncs = spec.getUserSyncs(
        {iframeEnabled: true},
        [
          {body: {ext: {responsetimemillis: {pubmatic: 123}}}},
          {body: {ext: {responsetimemillis: {pubmatic: 123, ix: 123}}}},
        ],
        gdprConsent,
        us_privacy,
        gppConsent
      );

      expect(syncs).to.deep.equal([
        {type: 'iframe', url: expectedSyncUrl.href},
      ]);
    });
  });
  */
});

function makeBidRequestWithParams(params) {
  return {
    bidId: '2e9f38ea93bb9e',
    bidder: 'adverxo',
    adUnitCode: 'adunit-code',
    mediaTypes: {banner: {sizes: [[300, 250]]}},
    params: params,
    bidderRequestId: 'test-bidder-request-id'
  };
}
