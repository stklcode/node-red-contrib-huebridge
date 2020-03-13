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

module.exports = function (RED) {
    'use strict';

    const os = require('os');
    const Bridge = require('./lib/Bridge.js');

    /**
     * Hue Bridge Node.
     *
     * @param config Node configuration.
     * @constructor
     */
    function HueBridgeNode(config) {
        RED.nodes.createNode(this, config);

        this.config = config;
        this.lights = {};
        this.sensors = {};
        this.linkButtons = {};

        const node = this;

        /*
         * Network info.
         */
        const interfaces = os.networkInterfaces();
        const address = config.address;
        let netmask = config.netmask;
        const gateway = config.gateway;
        let mac = '';

        for (let nic of Object.keys(interfaces)) {
            let done = false;
            for (let details of interfaces[nic]) {
                if (details.internal === false) {
                    if (details.family === 'IPv4' && details.address === address) {
                        netmask = details.netmask;
                        mac = details.mac;
                        done = true;
                        break;
                    }
                }
            }
            if (done) {
                break;
            }
        }

        if (mac === '') {
            node.error('Interface with address ' + address + ' not found');
            return;
        }

        this.bridge = new Bridge(address, netmask, gateway, mac, config.port, config.extAddress, config.extPort);
        this.bridge.debugFn = RED.log.debug;
        this.bridge.warnFn = RED.log.warn;

        this.bridge.start();

        /**
         * Register new devuce.
         *
         * @param client  Client object.
         * @param type    Node type.
         * @param name    Device name.
         * @param typ     Device type.
         * @param modelid Device model ID.
         * @return {boolean|*} ID of light or sensor, TRUE for internal nodes, FALSE on unknown type.
         */
        this.register = function (client, type, name, typ, modelid) {
            RED.log.debug('HueBridgeNode(): register; type = ' + type + ', modelid = ' + modelid);

            switch (type) {
                case 'light':
                    var lightid = node.bridge.dsCreateLight(client.id, name, typ, modelid);

                    RED.log.debug('HueBridgeNode(register-light): name = ' + name + ', typ = ' + typ);
                    RED.log.debug('HueBridgeNode(register-light): lightid = ' + lightid);

                    this.lights[lightid] = client;

                    return lightid;

                case 'link':
                    RED.log.debug('HueBridgeNode(link): client.id = ' + client.id);

                    this.linkButtons[client.id] = client;
                    return true;

                case 'manage':
                    return true;

                case 'zll':
                    var sensorid = node.bridge.dsCreateSensor(typ, client.id, name);

                    RED.log.debug('HueBridgeNode(register-zll): name = ' + name + ', typ = ' + typ);
                    RED.log.debug('HueBridgeNode(register-zll): sensorid = ' + sensorid);

                    this.sensors[sensorid] = client;

                    return sensorid;

                default:
                    return false;
            }
        };

        /**
         * Deregister type.
         *
         * @param client Client object.
         * @param type   Type to remove.
         */
        this.deregister = function (client, type) {
            RED.log.debug('HueBridgeNode(): deregister; type = ' + type);

            // TODO: implement?
        };

        /**
         * Remove a node type.
         *
         * @param client Client object.
         * @param type   Node type.
         */
        this.remove = function (client, type) {
            RED.log.debug('HueBridgeNode(): remove; type = ' + type);

            let idx;

            switch (type) {
                case 'light':
                    for (idx in this.lights) {
                        if (client.id === this.lights[idx].id) {
                            RED.log.debug('HueBridgeNode(remove-light): found light!; idx = ' + idx);
                            node.bridge.dsDeleteLight(idx);

                            delete this.lights[idx];
                            return;
                        }
                    }
                    break;

                case 'manage':
                    // Nothing to to.
                    break;

                case 'zll':
                    for (idx in this.sensors) {
                        if (client.id === this.sensors[idx].id) {
                            RED.log.debug('HueBridgeNode(remove-zll): found sensor!; idx = ' + idx);
                            node.bridge.dsDeleteSensor(idx);

                            delete this.sensors[idx];
                            return;
                        }
                    }
                    break;
            }
        };

        this.on(
            'close',
            (removed, done) => {
                node.bridge.stop(done);

                if (removed) {
                    // this node has been deleted
                } else {
                    // this node is being restarted
                    RED.log.debug('HueBridgeNode(on-close): restarting');
                }
            }
        );

        /*
         * Notifications coming from clients.
         */
        this.on(
            'manage',
            (action, data) => {
                RED.log.debug('HueBridgeNode(on-manage): action = ' + action);

                if (action === 'clearconfig') {
                    node.bridge.dsClearConfiguration();
                    node.bridge.emit('rule-engine-reload');
                }
            }
        );

        this.on(
            'link',
            (state) => {
                RED.log.debug('HueBridgeNode(on-link): action = ' + state);

                node.bridge.dsSetLinkbutton(state);
            }
        );

        /*
         * Notifications coming from the bridge
         */
        this.bridge.on(
            'http-error',
            (errorText) => RED.log.error('HueBridgeNode(http-error): errorText = ' + errorText)
        );

        this.bridge.on(
            'datastore-linkbutton',
            (state) => {
                RED.log.debug('HueBridgeNode(on-datastore-linkbutton): state = ' + state);

                Object.keys(node.linkButtons).forEach((clientid) => node.linkButtons[clientid].emit('datastore-linkbutton', state));
            }
        );

        this.bridge.on(
            'config-user-created',
            (username) => RED.log.debug('HueBridgeNode(config-user-created): username =' + username)
        );

        this.bridge.on(
            'config-user-deleted',
            (username) => RED.log.debug('HueBridgeNode(config-user-deleted): username =' + username)
        );

        this.bridge.on('config-modified', () => RED.log.debug('HueBridgeNode(config-modified'));

        this.bridge.on(
            'light-state-modified',
            (id, o) => {
                RED.log.debug('HueBridgeNode(on-light-state-modified): id = ' + id);

                if (Object.prototype.hasOwnProperty.call(node.lights, id)) {
                    node.lights[id].emit('light-state-modified', id, o);
                }
            }
        );

        this.bridge.on(
            'light-modified',
            (id, o) => {
                RED.log.debug('HueBridgeNode(on-light-modified): id = ' + id);

                if (Object.prototype.hasOwnProperty.call(node.lights, id)) {
                    node.lights[id].emit('light-modified', id, o);
                }
            }
        );

        this.bridge.on('group-created', (id, o) => RED.log.debug('HueBridgeNode(group-created): id =' + id));

        this.bridge.on('group-modified', (id, o) => RED.log.debug('HueBridgeNode(group-modified): id =' + id));

        this.bridge.on('group-deleted', (id) => RED.log.debug('HueBridgeNode(group-deleted): id =' + id));

        this.bridge.on('scene-created', (id, o) => RED.log.debug('HueBridgeNode(scene-created): id =' + id));

        this.bridge.on('scene-modified', (id, o) => RED.log.debug('HueBridgeNode(scene-modified): id =' + id));

        this.bridge.on('scene-lightstate-modified', (id, o) => RED.log.debug('HueBridgeNode(scene-lightstate-modified): id =' + id));

        this.bridge.on('scene-deleted', (id) => RED.log.debug('HueBridgeNode(scene-deleted): id =' + id));

        this.bridge.on('sensor-created', (id, o) => RED.log.debug('HueBridgeNode(sensor-created): id =' + id));

        this.bridge.on('sensor-deleted', (id) => RED.log.debug('HueBridgeNode(sensor-deleted): id =' + id));

        this.bridge.on('sensor-modified', (id, o) => RED.log.debug('HueBridgeNode(sensor-modified): id =' + id));

        this.bridge.on('sensor-config-modified', (id, o) => RED.log.debug('HueBridgeNode(sensor-config-modified): id =' + id));

        this.bridge.on('sensor-state-modified', (id, o) => RED.log.debug('HueBridgeNode(sensor-state-modified): id =' + id));

        this.bridge.on('rule-created', (id, o) => RED.log.debug('HueBridgeNode(rule-created): id =' + id));

        this.bridge.on('rule-deleted', (id) => RED.log.debug('HueBridgeNode(rule-deleted): id =' + id));

        this.bridge.on('rule-modified', (id, o) => RED.log.debug('HueBridgeNode(rule-modified): id =' + id));

        this.bridge.on('resourcelinks-created', (id, o) => RED.log.debug('HueBridgeNode(resourcelinks-created): id =' + id));

        this.bridge.on('resourcelinks-deleted', (id) => RED.log.debug('HueBridgeNode(resourcelinks-deleted): id =' + id));

        this.bridge.on('resourcelinks-modified', (id, o) => RED.log.debug('HueBridgeNode(resourcelinks-modified): id =' + id));

        this.bridge.on('schedule-created', (id, o, t) => RED.log.debug('HueBridgeNode(schedule-created): id =' + id));

        this.bridge.on('schedule-deleted', (id) => RED.log.debug('HueBridgeNode(schedule-deleted): id =' + id));

        this.bridge.on('schedule-modified', (id, o, t) => RED.log.debug('HueBridgeNode(schedule-modified): id =' + id));
    }

    RED.nodes.registerType('huebridge-client', HueBridgeNode);


    /**
     * Link Button Node.
     *
     * @param config Node configuraiton.
     * @constructor
     */
    function LinkButtonNode(config) {
        RED.nodes.createNode(this, config);

        this.timeout = config.timeout;
        this.client = config.client;
        this.clientConn = RED.nodes.getNode(this.client);

        if (!this.clientConn) {
            this.error(RED._('huebridge.errors.missing-config'));
            return;
        } else if (typeof this.clientConn.register !== 'function') {
            this.error(RED._('huebridge.errors.missing-bridge'));
            return;
        }

        this.clientConn.register(this, 'link');

        var node = this;

        node.status({fill: 'yellow', shape: 'ring', text: 'Link disabled'});

        /*
         * Notifications coming from the bridge.
         */
        this.on(
            'datastore-linkbutton',
            (state) => {
                RED.log.debug('LinkButtonNode(datastore-linkbutton)');

                if (state) {
                    node.status({fill: 'green', shape: 'ring', text: 'Link enabled'});
                } else {
                    node.status({fill: 'yellow', shape: 'ring', text: 'Link disabled'});
                }
            }
        );

        /*
         * Respond to inputs from NodeRED.
         */
        this.on(
            'input',
            (msg) => {
                RED.log.debug('LinkButtonNode(input)');

                node.clientConn.emit('link', true);

                setTimeout(function () {
                    node.clientConn.emit('link', false);
                }, this.timeout * 1000);
            }
        );

        this.on(
            'close',
            (removed, done) => {
                if (removed) {
                    // This node has been deleted.
                    node.clientConn.remove(node, 'link');
                } else {
                    // This node is being restarted.
                    node.clientConn.deregister(node, 'link');
                }

                done();
            }
        );
    }

    RED.nodes.registerType('huebridge-link', LinkButtonNode);
};
