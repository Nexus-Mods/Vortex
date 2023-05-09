const trim = (str, chars) => {
    if (typeof str === 'string') {
        return str.substring(0, chars)
    } else {
        return str
    }
};
const isFunction = (val) => {
    if (!val) return false
    return (
        Object.prototype.toString.call(val) === '[object Function]' ||
        (typeof val === 'function' &&
            Object.prototype.toString.call(val) !== '[object RegExp]')
    )
};
const isNumber = (val) => 'number' === typeof val && !isNaN(val);
const isString = (val) => val != null && typeof val === 'string';
const randomInt = () =>
    Math.floor(Math.random() * (2147483647 - 0 + 1) + 0);
const timestampInSeconds = () => Math.floor((new Date() * 1) / 1000);
const getEnvironment = () => {
    let env;
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined')
        env = 'browser';
    else if (
        typeof process !== 'undefined' &&
        process.versions != null &&
        process.versions.node != null
    )
        env = 'node';
    return env
};

/**
 * Function to sanitize values based on GA4 Model Limits
 * @param {string} val
 * @param {integer} maxLength
 * @returns
 */

const sanitizeValue = (val, maxLength) => {
    // Trim a key-value pair value based on GA4 limits
    /*eslint-disable */
    try {
        val = val.toString();
    } catch (e) {}
    /*eslint-enable */
    if (!isString(val) || !maxLength || !isNumber(maxLength)) return val
    return trim(val, maxLength)
};

const ga4Schema = {
    _em: 'em',
    event_name: 'en',
    protocol_version: 'v',
    _page_id: '_p',
    _is_debug: '_dbg',
    tracking_id: 'tid',
    hit_count: '_s',
    user_id: 'uid',
    client_id: 'cid',
    page_location: 'dl',
    language: 'ul',
    firebase_id: '_fid',
    traffic_type: 'tt',
    ignore_referrer: 'ir',
    screen_resolution: 'sr',
    global_developer_id_string: 'gdid',
    redact_device_info: '_rdi',
    geo_granularity: '_geo',
    _is_passthrough_cid: 'gtm_up',
    _is_linker_valid: '_glv',
    _user_agent_architecture: 'uaa',
    _user_agent_bitness: 'uab',
    _user_agent_full_version_list: 'uafvl',
    _user_agent_mobile: 'uamb',
    _user_agent_model: 'uam',
    _user_agent_platform: 'uap',
    _user_agent_platform_version: 'uapv',
    _user_agent_wait: 'uaW',
    _user_agent_wow64: 'uaw',
    error_code: 'ec',
    session_id: 'sid',
    session_number: 'sct',
    session_engaged: 'seg',
    page_referrer: 'dr',
    page_title: 'dt',
    currency: 'cu',
    campaign_content: 'cc',
    campaign_id: 'ci',
    campaign_medium: 'cm',
    campaign_name: 'cn',
    campaign_source: 'cs',
    campaign_term: 'ck',
    engagement_time_msec: '_et',
    event_developer_id_string: 'edid',
    is_first_visit: '_fv',
    is_new_to_site: '_nsi',
    is_session_start: '_ss',
    is_conversion: '_c',
    euid_mode_enabled: 'ecid',
    non_personalized_ads: '_npa',
    create_google_join: 'gaz',
    is_consent_update: 'gsu',
    user_ip_address: 'uip',
    google_consent_state: 'gcs',
    google_consent_update: 'gcu',
    us_privacy_string: 'uip',
    document_location: 'dl',
    document_path: 'dp',
    document_title: 'dt',
    document_referrer: 'dr',
    user_language: 'ul',
    document_hostname: 'dh',
    item_id: 'id',
    item_name: 'nm',
    item_brand: 'br',
    item_category: 'ca',
    item_category2: 'c2',
    item_category3: 'c3',
    item_category4: 'c4',
    item_category5: 'c5',
    item_variant: 'va',
    price: 'pr',
    quantity: 'qt',
    coupon: 'cp',
    item_list_name: 'ln',
    index: 'lp',
    item_list_id: 'li',
    discount: 'ds',
    affiliation: 'af',
    promotion_id: 'pi',
    promotion_name: 'pn',
    creative_name: 'cn',
    creative_slot: 'cs',
    location_id: 'lo',
    // legacy ecommerce
    id: 'id',
    name: 'nm',
    brand: 'br',
    variant: 'va',
    list_name: 'ln',
    list_position: 'lp',
    list: 'ln',
    position: 'lp',
    creative: 'cn',
};

const ecommerceEvents = [
    'add_payment_info',
    'add_shipping_info',
    'add_to_cart',
    'remove_from_cart',
    'view_cart',
    'begin_checkout',
    'select_item',
    'view_item_list',
    'select_promotion',
    'view_promotion',
    'purchase',
    'refund',
    'view_item',
    'add_to_wishlist',
];

const sendRequest = (endpoint, payload, mode = 'browser', opts = {}) => {
    const qs = new URLSearchParams(
        JSON.parse(JSON.stringify(payload))
    ).toString();
    if (mode === 'browser') {
        navigator?.sendBeacon([endpoint, qs].join('?'));
    } else {
        const scheme = endpoint.split('://')[0];
        const req = require(scheme);
        const options = {
            headers: {
                'User-Agent': opts.user_agent 
            },
            timeout: 1,
        };        
        const request = req
            .get([endpoint, qs].join('?'), options, (resp) => {
                resp.on('data', (chunk) => {
                });
                resp.on('end', () => {
                    // TO-DO Handle Server Side Responses                    
                });
            })
            .on('error', (err) => {
                console.log('Error: ' + err.message);
            });
        request.on('timeout', () => {
            request.destroy();
        });
    }
};

const clientHints = () => { 
    if(window && !('navigator' in window)) {
        return new Promise((resolve) => {
            resolve(null);
        })        
    }
    if (!navigator?.userAgentData?.getHighEntropyValues)
        return new Promise((resolve) => {
            resolve(null);
        })
    return navigator.userAgentData
        .getHighEntropyValues([
            'platform',
            'platformVersion',
            'architecture',
            'model',
            'uaFullVersion',
            'bitness',
            'fullVersionList',
            'wow64',
        ])
        .then((d) => {
            return {                
                _user_agent_architecture: d.architecture,
                _user_agent_bitness: d.bitness,
                _user_agent_full_version_list: encodeURIComponent(
                    (Object.values(d.fullVersionList) || navigator?.userAgentData?.brands)
                        .map((h) => {
                            return [h.brand, h.version].join(';')
                        })
                        .join('|')
                ),
                _user_agent_mobile: d.mobile ? 1 : 0,
                _user_agent_model: d.model || navigator?.userAgentData?.mobile,
                _user_agent_platform: d.platform || navigator?.userAgentData?.platform,
                _user_agent_platform_version: d.platformVersion,
                _user_agent_wow64: d.wow64 ? 1 : 0,
            }
        })
};

/**
 * Populate Page Related Details
 */
const pageDetails = () => {
    return {
        page_location: document.location.href,
        page_referrer: document.referrer,
        page_title: document.title,
        language: (
            (navigator && (navigator.language || navigator.browserLanguage)) ||
            ''
        ).toLowerCase(),
        screen_resolution:
            (window.screen ? window.screen.width : 0) +
            'x' +
            (window.screen ? window.screen.height : 0),
    }
};

const version = '0.0.4';

/**
 * Main Class Function
 * @param {array|string} measurement_ids
 * @param {object} config
 * @returns
 */

const ga4mp = function (measurement_ids, config = {}) {
    if (!measurement_ids)
        throw 'Tracker initialization aborted: missing tracking ids'
    const internalModel = Object.assign(
        {
            version,
            debug: false,
            mode: getEnvironment() || 'browser',
            measurement_ids: null,
            queueDispatchTime: 5000,
            queueDispatchMaxEvents: 10,
            queue: [],
            eventParameters: {},
            persistentEventParameters: {},
            userProperties: {},
            user_agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 [GA4MP/${version}]`,
            user_ip_address: null,
            hooks: {
                beforeLoad: () => {},
                beforeRequestSend: () => {},
            },
            endpoint: 'https://www.google-analytics.com/g/collect',
            payloadData: {},
        },
        config
    );

    // Initialize Tracker Data
    internalModel.payloadData.protocol_version = 2;
    internalModel.payloadData.tracking_id = Array.isArray(measurement_ids)
        ? measurement_ids
        : [measurement_ids];
    internalModel.payloadData.client_id = config.client_id
        ? config.client_id
        : [randomInt(), timestampInSeconds()].join('.');
    internalModel.payloadData._is_debug = config.debug ? 1 : undefined;
    internalModel.payloadData.non_personalized_ads = config.non_personalized_ads
        ? 1
        : undefined;
    internalModel.payloadData.hit_count = 1;

    // Initialize Session Data
    internalModel.payloadData.session_id = config.session_id
        ? config.session_id
        : timestampInSeconds();
    internalModel.payloadData.session_number = config.session_number
        ? config.session_number
        : 1;

    // Initialize User Data
    internalModel.payloadData.user_id = config.user_id
        ? trim(config.user_id, 256)
        : undefined;
    internalModel.payloadData.user_ip_address = config.user_ip_address
        ? config.user_ip_address
        : undefined;
    internalModel.userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 [GA4MP/${version}]`;

    // Initialize Tracker Data
    if (internalModel === 'node' && config.user_agent) {
        internalModel.user_agent = config.user_agent;
    }
    // Grab data only browser data
    if (internalModel.mode === 'browser') {
        const pageData = pageDetails();
        if (pageData) {
            internalModel.payloadData = Object.assign(
                internalModel.payloadData,
                pageData
            );
        }
    }
    /**
     * Dispatching Queue
     * TO-DO
     */
    const dispatchQueue = () => {
        internalModel.queue = [];
    };

    /**
     * Grab current ClientId
     * @returns string
     */
    const getClientId = () => {
        return internalModel.payloadData.client_id
    };

    /**
     * Grab current Session ID
     * @returns string
     */
    const getSessionId = () => {
        return internalModel.payloadData.session_id
    };

    /**
     * Set an Sticky Event Parameter, it wil be attached to all events
     * @param {string} key
     * @param {string|number|Fn} value
     * @returns
     */
    const setEventsParameter = (key, value) => {
        if (isFunction(value)) {
            try {
                value = value();
            } catch (e) {}
        }
        key = sanitizeValue(key, 40);
        value = sanitizeValue(value, 100);
        internalModel['persistentEventParameters'][key] = value;
    };

    /**
     * setUserProperty
     * @param {*} key
     * @param {*} value
     * @returns
     */
    const setUserProperty = (key, value) => {
        key = sanitizeValue(key, 24);
        value = sanitizeValue(value, 36);
        internalModel['userProperties'][key] = value;
    };

    /**
     * Generate Payload
     * @param {object} customEventParameters
     */
    const buildPayload = (eventName, customEventParameters) => {
        const payload = {};
        if (internalModel.payloadData.hit_count === 1)
            internalModel.payloadData.session_engaged = 1;

        Object.entries(internalModel.payloadData).forEach((pair) => {
            const key = pair[0];
            const value = pair[1];
            if (ga4Schema[key]) {
                payload[ga4Schema[key]] =
                    typeof value === 'boolean' ? +value : value;
            }
        });
        // GA4 Will have different Limits based on "unknown" rules
        // const itemsLimit = isP ? 27 : 10
        const eventParameters = Object.assign(
            JSON.parse(JSON.stringify(internalModel.persistentEventParameters)),
            JSON.parse(JSON.stringify(customEventParameters))
        );
        eventParameters.event_name = eventName;
        Object.entries(eventParameters).forEach((pair) => {
            const key = pair[0];
            const value = pair[1];
            if (
                key === 'items' &&
                ecommerceEvents.indexOf(eventName) > -1 &&
                Array.isArray(value)
            ) {
                // only 200 items per event
                let items = value.slice(0, 200);
                for (let i = 0; i < items.length; i++) {
                    if (items[i]) {
                        const item = {
                            core: {},
                            custom: {},
                        };
                        Object.entries(items[i]).forEach((pair) => {
                            if (ga4Schema[pair[0]]) {
                                if (typeof pair[1] !== 'undefined')
                                    item.core[ga4Schema[pair[0]]] = pair[1];
                            } else item.custom[pair[0]] = pair[1];
                        });
                        let productString =
                            Object.entries(item.core)
                                .map((v) => {
                                    return v[0] + v[1]
                                })
                                .join('~') +
                            '~' +
                            Object.entries(item.custom)
                                .map((v, i) => {
                                    var customItemParamIndex =
                                        10 > i
                                            ? '' + i
                                            : String.fromCharCode(65 + i - 10);
                                    return `k${customItemParamIndex}${v[0]}~v${customItemParamIndex}${v[1]}`
                                })
                                .join('~');
                        payload[`pr${i + 1}`] = productString;
                    }
                }
            } else {
                if (ga4Schema[key]) {
                    payload[ga4Schema[key]] =
                        typeof value === 'boolean' ? +value : value;
                } else {
                    payload[(isNumber(value) ? 'epn.' : 'ep.') + key] = value;
                }
            }
        });
        Object.entries(internalModel.userProperties).forEach((pair) => {
            const key = pair[0];
            const value = pair[1];
            if (ga4Schema[key]) {
                payload[ga4Schema[key]] =
                    typeof value === 'boolean' ? +value : value;
            } else {
                payload[(isNumber(value) ? 'upn.' : 'up.') + key] = value;
            }
        });
        return payload
    };

    /**
     * setUserId
     * @param {string} value
     * @returns
     */
    const setUserId = (value) => {
        internalModel.payloadData.user_id = sanitizeValue(value, 256);
    };

    /**
     * Track Event
     * @param {string} eventName
     * @param {object} eventParameters
     * @param {boolean} forceDispatch
     */
    const getHitIndex = () => {
        return internalModel.payloadData.hit_count
    };
    const trackEvent = (
        eventName,
        eventParameters = {},
        sessionControl = {},
        forceDispatch = true
    ) => {
        // We want to wait for the CH Promise to fullfill
        clientHints(internalModel?.mode).then((ch) => {            
            if (ch) {                
                internalModel.payloadData = Object.assign(
                    internalModel.payloadData,
                    ch
                );                
            }
            const payload = buildPayload(eventName, eventParameters);
            if (payload && forceDispatch) {
                for (let i = 0; i < payload.tid.length; i++) {
                    let r = JSON.parse(JSON.stringify(payload));
                    r.tid = payload.tid[i];               
                    sendRequest(internalModel.endpoint, r, internalModel.mode, {
                        user_agent: internalModel?.user_agent,
                    });
                }
                internalModel.payloadData.hit_count++;
            } else {
                const eventsCount = internalModel.queue.push(event);
                if (eventsCount >= internalModel.queueDispatchMaxEvents) {
                    dispatchQueue();
                }
            }            
        });             
    };
    return {
        version: internalModel.version,
        mode: internalModel.mode,
        getHitIndex,
        getSessionId,
        getClientId,
        setUserProperty,
        setEventsParameter,
        setUserId,
        trackEvent,
    }
};

export { ga4mp as default };
