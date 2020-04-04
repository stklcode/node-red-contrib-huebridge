/**
 * NodeRED Hue Bridge
 * Copyright (C) 2020 Stefan Kalscheuer.
 * Copyright (C) 2018-2019 Michael Jacobsen.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 **/

'use strict';

const Emitter = require('events').EventEmitter;
const stoppable = require('stoppable');
const http = require('http');
const https = require('https');

const Aggregation = require('./Aggregation.js');
const Lights = require('./Lights.js');
const Groups = require('./Groups.js');
const Schedules = require('./Schedules.js');
const Scenes = require('./Scenes.js');
const Sensors = require('./Sensors.js');
const Rules = require('./Rules.js');
const Configuration = require('./Configuration.js');
const Resourcelinks = require('./Resourcelinks.js');
const Capabilities = require('./Capabilities');
const Datastore = require('./Datastore.js');
const RuleEngine = require('./RuleEngine.js');
const SSDP = require('./Ssdp.js');
const CA = require('./CA.js');

/**
 * The emulated Bridge class.
 */
class Bridge extends Aggregation(Lights, Groups, Schedules, Scenes, Sensors, Rules, Configuration, Resourcelinks, Capabilities, Datastore, SSDP, RuleEngine, Emitter) {
    /**
     * Bridge constructor.
     *
     * @param {string} address    Network address to lsiten on.
     * @param {string} netmask    Netmask.
     * @param {string} gateway    Network gateway.
     * @param {string} mac        MAC address.
     * @param {number} port       HTTP port to listen on.
     * @param {number} sslPort    HTTPS port to listen on.
     * @param {string} extAddress External address (optional)
     * @param {number} extPort    Externally reported HTTP port (optional).
     */
    constructor(address, netmask, gateway, mac, port, sslPort, extAddress, extPort) {
        super();

        this.dsSetNetwork(address, netmask, gateway, mac);
        this.dsSetHttpPort(port);
        this.dsSetHttpsPort(sslPort);
        this.dsSetExternalAddress(extAddress);
        this.dsSetExternalPort(extPort);

        this.debugFn = this._debug;
        this.warnFn = this._warn;
    }

    /**
     * Start the bridge.
     */
    start() {
        const graceMilliseconds = 500;

        this.httpServer = stoppable(http.createServer((req, res) => this._requestListener(req, res)), graceMilliseconds);

        this.httpServer.on('error', (err) => this._onError(err));

        // start server
        this.httpServer.listen(
            this.dsGetHttpPort(),
            (error) => {
                if (error) {
                    this.warn('Bridge::httpServer(listen): ' + JSON.stringify(error));
                    this.emit('http-error', error);
                    return;
                }

                // extract the actual port number that was used
                const actualPort = this.httpServer.address().port;
                this.debug('Bridge::httpServer(listen): actualPort = ' + actualPort);

                // start discovery service after we know the port number
                this.ssdpStart(actualPort);
            }
        );

        // Is HTTPS configured?
        const httpsPort = this.dsGetHttpsPort();
        if (typeof httpsPort !== 'undefined' && httpsPort > 0) {
            CA.generateKeyPair(this.dsGetMAC()).then(
                (options) => {
                    this.debug('Bridge::start(): Starting HTTPS server');

                    this.httpsServer = stoppable(
                        https.createServer(
                            options,
                            (req, res) => this._requestListener(req, res)
                        ),
                        graceMilliseconds
                    );
                    this.httpsServer.on('error', (err) => this._onError(err));
                    this.httpsServer.listen(
                        httpsPort,
                        (error) => {
                            if (error) {
                                this.warn('Bridge::httpsServer(listen): ' + JSON.stringify(error));
                                this.emit('http-error', error);
                                return;
                            }

                            // extract the actual port number that was used
                            const actualPort = this.httpsServer.address().port;
                            this.debug('Bridge::httpsServer(listen): actualPort = ' + actualPort);

                            // start discovery service after we know the port number
                            this.ssdpStart(actualPort);
                        }
                    );
                },
                (err) => this.warn('Bridge::start(): SSL key pair generation failed, not starting HTTPS server: ' + err)
            )

        }

        this.debug('Bridge::start(): staring engines');
        this.ruleEngine();
    }

    /**
     * Stop the bridge.
     *
     * @param {function} done Callback function.
     */
    stop(done) {
        this.debug('Bridge::stop(): begin');

        this.dsShutdown();
        this.ssdpStop();

        this.httpServer.stop(() => {
            this.debug('Bridge::stop(httpServer-stop): begin');

            if (typeof done === 'function') {
                done();
                this.debug('Bridge::stop(): done ...');
            }

            this.debug('Bridge::stop(httpServer-stop): end');
        });

        setImmediate(() => this.httpServer.emit('close'));

        this.httpsServer.stop(() => {
            this.debug('Bridge::stop(httpsServer-stop): begin');

            if (typeof done === 'function') {
                done();
                this.debug('Bridge::stop(): done ...');
            }

            this.debug('Bridge::stop(httpsServer-stop): end');
        });

        setImmediate(() => this.httpsServer.emit('close'));

        this.debug('Bridge::stop(): end');
    }

    /**
     * Request dispatcher.
     *
     * @see https://developers.meethue.com/philips-hue-api
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    dispatch(response, method, url, urlParts, obj) {
        if (this.lightsDispatcher(response, method, url, urlParts, obj)) {
            return;
        }
        if (this.groupsDispatcher(response, method, url, urlParts, obj)) {
            return;
        }
        if (this.schedulesDispatcher(response, method, url, urlParts, obj)) {
            return;
        }
        if (this.scenesDispatcher(response, method, url, urlParts, obj)) {
            return;
        }
        if (this.sensorsDispatcher(response, method, url, urlParts, obj)) {
            return;
        }
        if (this.rulesDispatcher(response, method, url, urlParts, obj)) {
            return;
        }
        if (this.configurationDispatcher(response, method, url, urlParts, obj)) {
            return;
        }
        if (this.resourcelinksDispatcher(response, method, url, urlParts, obj)) {
            return;
        }
        if (this.capabilitiesDispatcher(response, method, url, urlParts, obj)) {
            return;
        }
        if (this.ssdpDispatcher(response, method, url, urlParts, obj)) {
            return;
        }

        this.debug('Bridge::dispatch(): unsupported API');

        response.writeHead(404);
        response.end();
    }

    /**
     * Generate new HTTP response.
     *
     * @return {FakeResponse}
     */
    getNewHttpResponse() {
        return new FakeResponse();
    }

    /**
     * Start multipart response.
     *
     * @return {*[]} Empty response array.
     */
    responseMultiBegin() {
        return [];
    }

    /**
     * Add success value to multipart response.
     *
     * @param {*[]}    arr   Response array.
     * @param {string} key   Success key.
     * @param {*}      value Success value.
     */
    responseMultiAddSuccess(arr, key, value) {
        const r = {success: {}};

        r.success[key] = value;

        arr.push(r);
    }

    /**
     * Add an error to multipart response.
     *
     * @param {*[]}    arr   Response array.
     * @param {string} key   Error key.
     * @param {*}      value Error value.
     */
    responseMultiAddError(arr, key, value) {
        const r = {error: {}};

        r.error[key] = value;

        arr.push(r);
    }

    /**
     * Finalize multipart response.
     *
     * @param {*[]} arr      Response array-
     * @param {*}   response HTTP response.
     */
    responseMultiEnd(arr, response) {
        const resp = JSON.stringify(arr);

        this.debug('Bridge::responseMultiEnd(): resp = ' + resp);
        this._responseJSON(response, resp);
    }

    /**
     * Generate JSON response with status 200.
     *
     * @param {*} response HTTP response.
     * @param {*} data     Response body.
     */
    responseJSON(response, data) {
        const resp = this.marshalJSON(data);

        this._responseJSON(response, resp);
    }

    /**
     * Write JSON body to response.
     *
     * @param {*}      response HTTP response.
     * @param {string} body     Response Body.
     * @private
     */
    _responseJSON(response, body) {
        response.writeHead(
            200,
            {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        );
        response.end(body);
    }

    /**
     * Generate error response.
     *
     * @param {*}      response HTTP response.
     * @param {number} type     Error type.
     * @param {*}      address  Error address.
     */
    responseError(response, type, address) {
        const err = {
            error: {
                type: type,
                description: '',
                address: address
            }
        };

        switch (type) {
            case 1:
                err.error.description = 'unauthorized user';
                break;

            case 2:
                err.error.description = 'body contains invalid JSON';
                break;

            case 3:
                err.error.description = 'resource not available';
                break;

            case 101:
                err.error.description = 'link button not pressed';
                break;

            case 608:
                err.error.description = 'action error';
                break;

            case 901:
                err.error.description = 'internal error';
                break;
        }

        const resp = JSON.stringify([
            err
        ]);

        this._responseJSON(response, resp);

        this.debug('Bridge::responseError(): resp = ' + resp);
    }

    /**
     * Marshal object to JSON.
     *
     * @param {*} value Value to marshal.
     * @return {string} JSON string for given value.
     */
    marshalJSON(value) {
        return JSON.stringify(
            value,
            (k, v) => {
                if (k.charAt(0) === '_') {
                    // Omit internal values.
                    return undefined;
                } else {
                    return v;
                }
            });
    }

    /**
     * HTTP(S) request listener.
     *
     * @param {*} request  HTTP request.
     * @param {*} response HTTP response.
     * @private
     */
    _requestListener(request, response) {
        var obj = {};
        var urlParts = request.url.split('/');
        var method = request.method.toLowerCase();

        this.debug('Bridge::httpServer(request): method = ' + method);
        this.debug('Bridge::httpServer(request): url    = ' + request.url);

        if (method === 'post' || method === 'put') {
            var body = [];
            request.on('data', (chunk) => {
                body.push(chunk);
            }).on('end', () => {
                body = Buffer.concat(body).toString();
                this.debug('Bridge::httpServer(request): body = ' + body);

                if (body.length > 1) {
                    try {
                        obj = JSON.parse(body);
                    } catch (err) {
                        this.debug('Bridge::httpServer(request): JSON error = ' + err);
                    }
                }

                this.dispatch(response, method, request.url, urlParts, obj);
            });
        } else if (method === 'get') {
            this.dispatch(response, method, request.url, urlParts, obj);
        } else if (method === 'delete') {
            this.dispatch(response, method, request.url, urlParts, obj);
        } else {
            this.debug('Bridge::httpServer(request): unsupported method');

            response.writeHead(404);
            response.end();
        }
    }

    /**
     * HTTP(S) error listener.
     *
     * @param {*} error Error object.
     * @private
     */
    _onError(error) {
        if (!error) {
            this.warn('Bridge::httpServer(on-error): unable to start');
            this.emit('http-error', 'unable to start; no error message');
            return;
        }

        var errorCode = null;
        if (error.code) {
            errorCode = error.code;
        } else if (error.errno) {
            errorCode = error.errno;
        }

        var errorText = '';
        if (errorCode) {
            errorText += errorCode;
        } else {
            errorText += 'unable to start [1]';
        }
        errorText += ' (p:' + this.dsGetHttpPort() + ')';

        this.warn('Bridge::httpServer(on-error): ' + errorText);
        this.emit('http-error', errorText);
    }

    /**
     * Debug handler.
     *
     * @param {string} data Debug message.
     */
    debug(data) {
        this.debugFn(data);
    }

    /**
     * Actual debug handler.
     *
     * @param {string} data Debug message.
     * @private
     */
    _debug(data) {
        console.log('D' + this.dsDateString() + ': ' + data);
    }

    /**
     * Actual handler.
     *
     * @param {string} data Warning message.
     */
    warn(data) {
        this.warnFn(data);
    }

    /**
     * Actual warning handler.
     *
     * @param {string} data Warning message.
     * @private
     */
    _warn(data) {
        console.log('W' + this.dsDateString() + ': ' + data);
    }
}

/**
 * A fake http.ServerResponse used internally - doesn't do anything.
 *
 * @internal
 */
class FakeResponse {
    writeHead() {
    }

    end() {
    }
}

module.exports = Bridge;
