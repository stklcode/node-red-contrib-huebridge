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

    /**
     * ZLL Switch Node.
     *
     * @param config Node configuration.
     * @constructor
     */
    function ZGPSwitchNode(config) {
        RED.nodes.createNode(this, config);

        this.client = config.client;
        this.clientConn = RED.nodes.getNode(this.client);
        this.timer = null;

        if (!this.clientConn) {
            this.error(RED._('zllswitch.errors.missing-config'));
            this.status({fill: 'red', shape: 'dot', text: 'Missing config'});
            return;
        } else if (typeof this.clientConn.register !== 'function') {
            this.error(RED._('zllswitch.errors.missing-bridge'));
            this.status({fill: 'red', shape: 'dot', text: 'Missing bridge'});
            return;
        }

        this.switchid = this.clientConn.register(this, 'zll', config.name, 'ZGPSwitch');

        if (this.switchid === false) {
            this.error(RED._('zllswitch.errors.create'));
            this.status({fill: 'red', shape: 'dot', text: RED._('zllswitch.errors.create')});
            return;
        }

        this.status({fill: 'green', shape: 'dot', text: 'Ready'});

        /*
         * Respond to inputs from NodeRED.
         */
        this.on(
            'input',
            (msg) => {
                RED.log.debug('ZGPSwitchNode(input): msg = ' + JSON.stringify(msg));
                RED.log.debug('ZGPSwitchNode(input): typeof payload = ' + typeof msg.payload);

                let buttonid;

                if (typeof msg.payload === 'number') {
                    switch (msg.payload) {
                        case 1:
                            buttonid = 34;
                            this.status({fill: 'green', shape: 'dot', text: 'Button 1'});
                            setTimeout(() => this.status({}), 5000);
                            break;

                        case 2:
                            buttonid = 16;
                            this.status({fill: 'green', shape: 'dot', text: 'Button 2'});
                            setTimeout(() => this.status({}), 5000);
                            break;

                        case 3:
                            buttonid = 17;
                            this.status({fill: 'green', shape: 'dot', text: 'Button 3'});
                            setTimeout(() => this.status({}), 5000);
                            break;

                        case 4:
                            buttonid = 18;
                            this.status({fill: 'green', shape: 'dot', text: 'Button 4'});
                            setTimeout(() => this.status({}), 5000);
                            break;

                        default:
                            return;
                    }
                }

                const obj = this.clientConn.bridge.dsGetSensor(this.switchid);
                RED.log.debug('ZGPSwitchNode(input): obj = ' + JSON.stringify(obj));

                obj.state.buttonevent = buttonid;

                RED.log.debug('ZGPSwitchNode(input): obj = ' + JSON.stringify(obj));
                this.clientConn.bridge.dsUpdateSensorState(this.switchid, obj.state);

                setTimeout(
                    () => {
                        RED.log.debug('ZGPSwitchNode(timer):');

                        let o = this.clientConn.bridge.dsGetSensor(this.switchid);
                        RED.log.debug('ZGPSwitchNode(timer): obj = ' + JSON.stringify(o));

                        o.state.buttonevent = 0;

                        RED.log.debug('ZGPSwitchNode(timer): obj = ' + JSON.stringify(o));
                        this.clientConn.bridge.dsUpdateSensorState(this.switchid, o.state);
                    },
                    1000
                );
            }
        );

        this.on(
            'close',
            (removed, done) => {
                if (removed) {
                    // This node has been deleted.
                    this.clientConn.remove(node, 'zll');
                } else {
                    // This node is being restarted.
                    this.clientConn.deregister(node, 'zll');
                }

                done();
            }
        );
    }

    RED.nodes.registerType('huebridge-zgpswitch', ZGPSwitchNode);
};
