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

const Datastore = require('../../lib/Datastore.js');
const assert = require('assert');
const rimraf = require('rimraf');

describe('Datastore class', () => {
    before(() => {
        // Ensure we're starting on empty storage.
        rimraf.sync('.node-persist');
    });

    after(() => {
        // Clean up after work has been done.
        rimraf.sync('.node-persist');
    });

    let datastore;

    describe('constructor', () => {
        it('should instantiate object', () => {
            datastore = new Datastore();
            assert.equal(typeof datastore, 'object');
        });
    });

    const address = '192.0.2.100';
    const netmask = '255.255.255.0';
    const gateway = '192.0.2.1';
    const mac = 'aa:bb:cc:dd:ee:ff';

    describe('dsSetNetwork', () => {
        it('should set all parts of network configuration', () => {
            datastore.dsSetNetwork(address, netmask, gateway, mac);

            assert.equal(datastore.dsGetAddress(), address, 'unexpected IP address');
            assert.equal(datastore.dsGetMAC(), mac, 'unexpected MAC address');
            assert.equal(datastore.dsGetBridgeID(), 'AABBCCFFFEDDEEFF', 'unexpected bridge ID');
        });
    });

    describe('dsSetHttpPort', () => {
        it('should set HTTP port', () => {
            const port = 8080;
            datastore.dsSetHttpPort(port);
            assert.equal(datastore.dsGetHttpPort(), port, 'unexpected HTTP port');
            assert.equal(datastore.dsGetExternalURL(), '192.0.2.100:8080', 'external address does not match address and port');
        });
    });

    describe('dsSetExternalAddress and dsSetExternalPort', () => {
        it('should set external IP address and port', () => {
            const address = '192.0.2.101';
            const port = 80;
            datastore.dsSetExternalAddress(address);
            datastore.dsSetExternalPort(80);
            assert.equal(datastore.dsGetExternalAddress(), address, 'unexpected external IP address');
            assert.equal(datastore.dsGetExternalPort(), port, 'unexpected external port');
            assert.equal(datastore.dsGetExternalURL(), '192.0.2.101:80', 'external address not overridden');
        });
    });

    describe('configuration handling', () => {
        let config;
        it('should provide some default flags after initialization,', () => {
            config = datastore.dsGetConfig();
            assert.equal(Object.keys(config).length, 26);
            assert.equal(config.name, 'NodeRED');
            assert.equal(config.bridgeid, 'AABBCCFFFEDDEEFF');
            assert.equal(config.modelid, 'BSB002');
            assert.equal(config.datastoreversion, '70');
            assert.equal(config.mac, mac);
            assert.equal(config.zigbeechannel, 25);
            assert.equal(config.dhcp, false);
            assert.equal(config.ipaddress, address);
            assert.equal(config.netmask, netmask);
            assert.equal(config.gateway, gateway);
            assert.equal(config.proxyaddress, 'none');
            assert.equal(config.proxyport, 0);
            assert.equal(config.timezone, 'Europe/Copenhagen');
            assert.equal(config.apiversion, '1.35.0');
            assert.equal(config.swversion, '1935144020');
            assert.equal(config.linkbutton, false);
            assert.equal(config.portalservices, false);
            assert.equal(config.factorynew, false);
            assert.equal(config.replacesbridgeid, null);
            assert.equal(config.starterkitid, '');
            assert.deepEqual(
                config.swupdate,
                {
                    updatestate: 0,
                    checkforupdate: false,
                    devicetypes: {
                        bridge: false,
                        lights: [],
                        sensors: []
                    },
                    url: '',
                    text: '',
                    notify: false
                }
            );
            assert.deepEqual(
                config.swupdate2,
                {
                    checkforupdate: false,
                    state: 'noupdates',
                    install: false,
                    autoinstall: {
                        updatetime: 'T14:00:00',
                        on: false
                    },
                    bridge: {
                        state: 'noupdates',
                        lastinstall: '2018-02-02T00:00:00'
                    },
                    lastchange: '2018-02-02T00:00:00'
                }
            );
        });

        it('full configuration if requested', () => {
            config = datastore.dsGetFullConfig();

            assert.equal(Object.keys(config).length, 8);
            assert.equal(Object.keys(config.config).length, 26);
            assert.deepEqual(config.lights, {}, 'empty map of lights expected');
            assert.deepEqual(config.groups, {}, 'empty map of groups expected');
            assert.deepEqual(config.schedules, {}, 'empty map of schedules expected');
            assert.deepEqual(config.rules, {}, 'empty map of rules expected');
            assert.deepEqual(config.resourcelinks, {}, 'empty map of resourcelinks expected');
        });

        it('and also minimal configuration if requested', () => {
            config = datastore.dsGetMinimalConfig();

            assert.equal(Object.keys(config).length, 10);
            assert.deepEqual(
                config,
                {
                    name: 'NodeRED',
                    datastoreversion: '70',
                    swversion: '1935144020',
                    apiversion: '1.35.0',
                    mac: mac,
                    bridgeid: 'AABBCCFFFEDDEEFF',
                    factorynew: false,
                    replacesbridgeid: null,
                    modelid: 'BSB002',
                    starterkitid: ''
                }
            );
        });

        it('should handle changes correctly', () => {
            assert.equal(datastore.dsGetLinkbutton(), false, 'linkbutton expected false by default');
            config = datastore.dsGetConfig();
            assert.equal(config.linkbutton, false, 'inconsistent linkbutton state in config object');

            // Capture "emit" hook.
            const emitted = [];
            datastore.emit = (evt, state) => {
                emitted.push({evt: evt, state: state})
            };

            // Change linkbutton state.
            datastore.dsSetLinkbutton(true);
            config = datastore.dsGetConfig();
            assert.equal(datastore.dsGetLinkbutton(), true, 'linkbutton state not set correctly');
            assert.equal(config.linkbutton, true, 'inconsistent linkbutton state in config object');
            assert.equal(emitted.length, 1, 'no event emitted after linkbutton state change');
            assert.deepEqual(
                emitted[0],
                {
                    evt: 'datastore-linkbutton',
                    state: true
                },
                'unexpected event emitted after linkbutton state change'
            );
            // Change bridge name.
            datastore.dsSetName('TestBridge');
            config = datastore.dsGetConfig();
            assert.equal(config.name, 'TestBridge', 'inconsistent name in config object');

            // Change zigbee channel.
            datastore.dsSetZigbeechannel(42);
            config = datastore.dsGetConfig();
            assert.equal(config.zigbeechannel, 42, 'inconsistent zigbee channel in config object');

            // Change timezone.
            datastore.dsSetTimezone('Europe/Berlin');
            config = datastore.dsGetConfig();
            assert.equal(config.timezone, 'Europe/Berlin', 'inconsistent timezone in config object');

            // Change portalservice state.
            datastore.dsSetPortalservice(true);
            config = datastore.dsGetConfig();
            assert.equal(config.portalservices, true, 'inconsistent portalservices state in config object');
        });
    });

    describe('light handling', () => {
        it('should provide empty map after initialization', () => {
            let lights = datastore.dsGetAllLights();
            assert.equal(Object.keys(lights).length, 0);
        });

        it('should create a new light successfully', () => {
            const clientID = 'test-client';
            const name = 'test-light-01';
            const type = '0x0000';
            const type2 = '0x0100';
            const model = 'test-model-onoff';

            // Add empty debug and warn methods.
            datastore.debug = () => {};
            datastore.warn = () => {};

            // Create new light.
            const lightID = datastore.dsCreateLight(clientID, name, type);
            assert.equal(lightID, 1, 'unexpected first light ID');

            // Re-read light.
            const light = datastore.dsGetLight(lightID);
            assert.notEqual(light, false, 'reading newly created light failed');
            assert.equal(light._typ, type);
            assert.equal(light.type, 'On/off Light');
            assert.equal(light.name, name);
            assert.equal(light.modelid, 'NR001');

            // Create again, i.e. save preexisting light node with type and model change.
            const lightID2 = datastore.dsCreateLight(clientID, name, type2, model);
            assert.equal(lightID2, lightID, 'light ID changed on second save');
            const light2 = datastore.dsGetLight(lightID2);
            assert.notEqual(light2, false, 'reading updated light failed');
            assert.equal(light2._typ, type2);
            assert.equal(light2.type, 'Dimmable Light');
            assert.equal(light2.name, name);
            assert.equal(light2.modelid, model);

            // Read all light objects, IDs and nodes.
            const lights = datastore.dsGetAllLights();
            assert.equal(Object.keys(lights).length, 1, 'unexpected number of lights after creation and update');
            assert.deepEqual(lights[1], light2, 'unexpected light object in list');

            const lightIDs = datastore.dsGetAllLightIDs();
            assert.equal(lightIDs.length, 1, 'unexpected number of light IDs after creation and update');
            assert.deepEqual(lightIDs, [1], 'unexpected light ID in list');

            const lightNodes = datastore.dsGetAllLightNodes();
            assert.equal(Object.keys(lightNodes).length, 1, 'unexpected number of light nodes after creation and update');
            assert.equal(lightNodes[1].clientid, clientID, 'unexpected client ID for light node');
            assert.equal(lightNodes[1].type, 'Dimmable Light', 'unexpected readable type for light node');
            assert.equal(lightNodes[1]._typ, type2, 'unexpected numeric type for light node');

            // TODO: light and state updates.
        });
    });
});
