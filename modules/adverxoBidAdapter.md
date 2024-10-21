# Overview

```
Module Name: Yandex Bidder Adapter
Module Type: Bidder Adapter
Maintainer: prebid@yandex-team.com
```

# Description

Module that connects to Adverxo to fetch bids.
Banner, native and video formats are supported.

# Bid Parameters

| Name       | Required? | Description                                                       | Example                                      | Type      |
|------------|-----------|-------------------------------------------------------------------|----------------------------------------------|-----------|
| `host`     | Yes       | Ad network host.                                                  | `prebidTest.adverxo.com`                             | `String` |
| `adUnitId` | Yes       | Unique identifier for the ad unit in Adverxo platform.            | `41358`                                      | `Integer` |
| `auth`     | Yes       | Authentication token provided by Adverxo platform for the AdUnit. | `'61336e75e414c77c367de5c47c2599ce80a8032b'` | `String`  |

# Test Parameters

```javascript
var adUnits = [
    {
        code: 'banner-ad-div',
        mediaTypes: {
            banner: {
                sizes: [
                    [400, 300],
                    [320, 50]
                ]
            }
        },
        bids: [{
            bidder: 'adverxo',
            params: {
                host: 'prebidTest.adverxo.com',
                adUnitId: 41358,
                auth: '61336e75e414c77c367de5c47c2599ce80a8032b'
            }
        }]
    },
    {
        code: 'native-ad-div',
        mediaTypes: {
            native: {
                image: {
                    required: true,
                    sizes: [400, 300]
                },
                title: {
                    required: true,
                    len: 75
                },
                body: {
                    required: false,
                    len: 200
                },
                cta: {
                    required: false,
                    len: 75
                },
                sponsoredBy: {
                    required: false
                }
            }
        },
        bids: [{
            bidder: 'adverxo',
            params: {
                host: 'prebidTest.adverxo.com',
                adUnitId: 41359,
                auth: '9a640dfccc3381e71f0c29ffd4a72eabd29d9d86'
            }
        }]
    },
    {
        code: 'video-div',
        mediaTypes: {
            video: {
                playerSize: [640, 480],
                context: 'outstream',
                mimes: ['video/mp4'],
                maxduration: 30,
                skip: 1
            }
        },
        bids: [{
            bidder: 'adverxo',
            params: {
                host: 'prebidTest.adverxo.com',
                adUnitId: 41360,
                auth: '1ac23d9621f21da28d9eab6f79bd5fbce4d037c1'
            }
        }]
    }
];

```
