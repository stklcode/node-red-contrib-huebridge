/**
 * NodeRED Hue Bridge
 * Copyright (C) 2020 Stefan Kalscheuer.
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

const Aggregation = require('../../lib/Aggregation.js');
const Configuration = require('../../lib/Configuration.js');
const Datastore = require('../../lib/Datastore.js');
const MockResponse = require('../MockResponse.js');
const assert = require('assert');
const rimraf = require('rimraf');

describe('Configuration class', () => {
    let config;

    before(() => {
        // Ensure we're starting on empty storage.
        rimraf.sync('.node-persist');
    });

    after(() => {
        // Clean up after work has been done.
        rimraf.sync('.node-persist');
    });

    describe('constructor', () => {
        config = new Configuration();
        it('should instantiate object', () => {
            assert.equal(typeof config, 'object');
        });

        it('should initialize with disabled link button', () => {
            assert.equal(config.configLinkbutton, false);
        });
    });


    describe('configurationDispatcher', () => {
        // Re-initialize with Datastore mixin (tested separately).
        const configClass = class extends Aggregation(Configuration, Datastore) {
            constructor() {
                super();
            }

            debug() {
            }

            warn() {
            }

            responseJSON(response, data) {
                const body = this.marshalJSON(data);
                response.writeHead(
                    200,
                    {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    }
                );
                response.end(body);
            }

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
        };
        // config = new (Aggregation(Configuration, Datastore)) ();
        config = new configClass();


        it('should do nothing on empty request', () => {
            assert.equal(config.configurationDispatcher(), false);
        });

        it('should provide minimal config if "nouser" is requested', () => {

            let res = new MockResponse();
            assert.equal(config.configurationDispatcher(res, 'get', '/api/nouser/config', ['api', 'nouser', 'config']), true);
            assert.equal(res.status, 200);
            assert.equal(res.headers['Content-Type'], 'application/json');
            assert.equal(
                res.body,
                '{"name":"NodeRED","datastoreversion":"70","swversion":"1935144020","apiversion":"1.35.0","factorynew":false,"replacesbridgeid":null,"modelid":"BSB002","starterkitid":""}'
            );
            assert.equal(res.finalized, true);
        });
    });
});
