import {expect} from 'chai';
import {spec} from 'modules/adverxoBidAdapter.js';
import {config} from 'src/config';

describe('Adverxo Bid Adapter', () => {
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

  const bannerBidRequests = [
    {
      bidId: 'bid-banner',
      bidder: 'adverxo',
      adUnitCode: 'adunit-code',
      mediaTypes: {banner: {sizes: [[300, 250]]}},
      params: {
        host: 'bid.example.com',
        adUnitId: 1,
        auth: 'authExample',
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
        img: {type: 3, w: 150, h: 50}
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
        host: 'bid.example.com',
        adUnitId: 1,
        auth: 'authExample'
      }
    },
  ];

  const nativeBidderRequest = {
    bidderCode: 'adverxo',
    bidderRequestId: 'test-bidder-request-id',
    bids: nativeBidRequests,
    auctionId: 'new-auction-id'
  };

  const videoInstreamBidRequests = [
    {
      bidId: 'bid-video',
      mediaTypes: {
        video: {
          context: 'instream',
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
        host: 'bid.example.com',
        adUnitId: 1,
        auth: 'authExample'
      }
    }
  ];

  const videoInstreamBidderRequest = {
    bidderCode: 'adverxo',
    bidderRequestId: 'test-bidder-request-id',
    bids: videoInstreamBidRequests,
    auctionId: 'new-auction-id'
  };

  const videoOutstreamBidRequests = [
    {
      bidId: 'bid-video',
      mediaTypes: {
        video: {
          context: 'outstream',
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
        host: 'bid.example.com',
        adUnitId: 1,
        auth: 'authExample'
      }
    }
  ];

  const videoOutstreamBidderRequest = {
    bidderCode: 'adverxo',
    bidderRequestId: 'test-bidder-request-id',
    bids: videoOutstreamBidRequests,
    auctionId: 'new-auction-id'
  };

  afterEach(function () {
    config.resetConfig();
  });

  describe('isBidRequestValid', function () {
    it('should validate bid request with valid params', () => {
      const validBid = makeBidRequestWithParams({
        adUnitId: 1,
        auth: 'authExample',
        host: 'www.bidExample.com'
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
        auth: 'authExample',
        host: 'www.bidExample.com'
      });

      const isValid = spec.isBidRequestValid(invalidBid);

      expect(isValid).to.be.false;
    });

    it('should not validate bid request with missing param(auth)', () => {
      const invalidBid = makeBidRequestWithParams({
        adUnitId: 1,
        host: 'www.bidExample.com'
      });

      const isValid = spec.isBidRequestValid(invalidBid);

      expect(isValid).to.be.false;
    });

    it('should not validate bid request with missing param(host)', () => {
      const invalidBid = makeBidRequestWithParams({
        adUnitId: 1,
        auth: 'authExample',
      });

      const isValid = spec.isBidRequestValid(invalidBid);

      expect(isValid).to.be.false;
    });
  });

  describe('buildRequests', () => {
    it('should build post request for banner', () => {
      const request = spec.buildRequests(bannerBidRequests, bannerBidderRequest)[0];

      expect(request.method).to.equal('POST');
      expect(request.url).to.equal('https://bid.example.com/auction?id=1&auth=authExample');
      expect(request.data.device.ip).to.equal('caller');
      expect(request.data.ext.avx_add_vast_url).to.equal(1);
    });

    if (FEATURES.NATIVE) {
      it('should build post request for native', () => {
        const request = spec.buildRequests(nativeBidRequests, nativeBidderRequest)[0];

        expect(request.method).to.equal('POST');
        expect(request.url).to.equal('https://bid.example.com/auction?id=1&auth=authExample');

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
        const request = spec.buildRequests(videoInstreamBidRequests, videoInstreamBidderRequest)[0];

        expect(request.method).to.equal('POST');
        expect(request.url).to.equal('https://bid.example.com/auction?id=1&auth=authExample');

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

    it('should add bid floor to request', function () {
      const bannerBidRequestWithFloor = {
        ...bannerBidRequests[0],
        getFloor: () => ({currency: 'USD', floor: 3})
      };

      const request = spec.buildRequests([bannerBidRequestWithFloor], {})[0].data;

      expect(request.imp[0].bidfloor).to.equal(3);
      expect(request.imp[0].bidfloorcur).to.equal('USD');
    });
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
                  adm: '<div></div>'
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
          ad: '<div></div>'
        },
      ];

      const request = spec.buildRequests(bannerBidRequests, bannerBidderRequest)[0];
      const bids = spec.interpretResponse(bidResponse, request);

      expect(bids).to.deep.equal(expectedBids);
    });

    it('should replace openrtb auction price macro', () => {
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
                  adm: '<a href="https://www.example.com/imp?prc=${AUCTION_PRICE}" target="_blank"><img src="https://www.example.com/click?prc=${AUCTION_PRICE}"</a>'
                },
              ],
              seat: 'test-seat',
            },
          ],
        },
      };

      const request = spec.buildRequests(bannerBidRequests, bannerBidderRequest)[0];
      const bids = spec.interpretResponse(bidResponse, request);

      expect(bids[0].ad).to.equal('<a href="https://www.example.com/imp?prc=2" target="_blank"><img src="https://www.example.com/click?prc=2"</a>');
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
                  {id: 2, title: {text: 'Title'}},
                  {id: 3, data: {value: 'Description'}},
                  {id: 1, img: {url: 'http://example.com?img', w: 150, h: 50}}
                ],
                link: {url: 'http://example.com?link'}
              }
            }
          }
        ];

        const request = spec.buildRequests(nativeBidRequests, nativeBidderRequest)[0];
        const bids = spec.interpretResponse(bidResponse, request);

        expect(bids).to.deep.equal(expectedBids);
      });
    }

    if (FEATURES.VIDEO) {
      it('should interpret video instream response', () => {
        const bidResponse = {
          body: {
            id: 'video-response',
            cur: 'USD',
            seatbid: [
              {
                bid: [
                  {
                    impid: 'bid-video',
                    crid: 'creative-id',
                    cur: 'USD',
                    price: 2,
                    w: 300,
                    h: 250,
                    mtype: 2,
                    adomain: ['test.com'],
                    adm: 'vastXml',
                    ext: {
                      avx_vast_url: 'vastUrl'
                    }
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
            mediaType: 'video',
            meta: {
              advertiserDomains: ['test.com'],
            },
            netRevenue: true,
            playerHeight: 300,
            playerWidth: 400,
            requestId: 'bid-video',
            ttl: 60,
            vastUrl: 'vastUrl',
            vastXml: 'vastXml',
            width: 300
          }
        ];

        const request = spec.buildRequests(videoInstreamBidRequests, videoInstreamBidderRequest)[0];
        const bids = spec.interpretResponse(bidResponse, request);

        expect(bids).to.deep.equal(expectedBids);
      });

      it('should interpret video outstream response', () => {
        const bidResponse = {
          body: {
            id: 'video-response',
            cur: 'USD',
            seatbid: [
              {
                bid: [
                  {
                    impid: 'bid-video',
                    crid: 'creative-id',
                    cur: 'USD',
                    price: 2,
                    w: 300,
                    h: 250,
                    mtype: 2,
                    adomain: ['test.com'],
                    adm: 'vastXml',
                    ext: {
                      avx_vast_url: 'vastUrl',
                      avx_video_renderer_url: 'videoRendererUrl',
                    }
                  },
                ],
                seat: 'test-seat',
              },
            ],
          },
        };

        const expectedBids = [
          {
            avxVideoRendererUrl: 'videoRendererUrl',
            cpm: 2,
            creativeId: 'creative-id',
            creative_id: 'creative-id',
            currency: 'USD',
            height: 250,
            mediaType: 'video',
            meta: {
              advertiserDomains: ['test.com'],
            },
            netRevenue: true,
            playerHeight: 300,
            playerWidth: 400,
            requestId: 'bid-video',
            ttl: 60,
            vastUrl: 'vastUrl',
            vastXml: 'vastXml',
            width: 300
          }
        ];

        const request = spec.buildRequests(videoOutstreamBidRequests, videoOutstreamBidderRequest)[0];
        const bids = spec.interpretResponse(bidResponse, request);

        expect(bids[0].renderer.url).to.equal('videoRendererUrl');

        delete (bids[0].renderer);
        expect(bids).to.deep.equal(expectedBids);
      });
    }
  });

  describe('getUserSyncs', () => {
    it('should return an empty array if no server responses are provided', () => {
      const syncs = spec.getUserSyncs({iframeEnabled: true}, []);
      expect(syncs).to.deep.equal([]);
    });

    it('should return an iframe sync url when server provided it', () => {
      const serverResponse = {
        body: {
          ext: {
            avx_usersync: [
              {
                type: 1,
                url: 'userSyncUrl'
              }
            ]
          }
        }
      };

      const syncs = spec.getUserSyncs({iframeEnabled: true}, [serverResponse]);

      expect(syncs).to.have.lengthOf(1);
      expect(syncs[0]).to.deep.equal({
        type: 'iframe',
        url: 'userSyncUrl'
      });
    });

    it('should return an image sync url when server provided it', () => {
      const serverResponse = {
        body: {
          ext: {
            avx_usersync: [
              {
                type: 2,
                url: 'userSyncUrl'
              }
            ]
          }
        }
      };

      const syncs = spec.getUserSyncs({pixelEnabled: true}, [serverResponse]);

      expect(syncs).to.have.lengthOf(1);
      expect(syncs[0]).to.deep.equal({
        type: 'image',
        url: 'userSyncUrl'
      });
    });
  });
});
