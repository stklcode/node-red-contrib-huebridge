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
     * ZLL Temperature Sensor Node.
     *
     * @param config Node configuration.
     * @constructor
     */
    function ZLLTemperatureNode(config) {
        RED.nodes.createNode(this, config);

        this.client = config.client;
        this.clientConn = RED.nodes.getNode(this.client);

        if (!this.clientConn) {
            this.error(RED._('zllsensor.errors.missing-config'));
            this.status({fill: 'red', shape: 'dot', text: 'Missing config'});
            return;
        } else if (typeof this.clientConn.register !== 'function') {
            this.error(RED._('zllsensor.errors.missing-bridge'));
            this.status({fill: 'red', shape: 'dot', text: 'Missing bridge'});
            return;
        }

        this.temperatureid = this.clientConn.register(this, 'zll', config.name, 'ZLLTemperature');

        if (this.temperatureid === false) {
            this.error(RED._('zllsensor.errors.create'));
            this.status({fill: 'red', shape: 'dot', text: RED._('zllsensor.errors.create')});
            return;
        }

        /*var fakeClient1 = {
            id: this.id + '.1'
        };

        RED.log.debug('ZLLTemperatureNode(): fakeClient1 = ' + JSON.stringify(fakeClient1));

        var fakeClient2 = {
            id: this.id + '.2'
        };
        var fakeClient3 = {
            id: this.id + '.3'
        };

        this.presenceid    = this.clientConn.register(fakeClient1, 'zll', 'Motion sensor', 'ZLLPresence');
        this.presenceid    = this.clientConn.register(fakeClient3, 'zll', 'Light level sensor', 'ZLLLightlevel');*/
        //this.presenceid    = this.clientConn.register(this, 'zll', 'Motion sensor', 'ZLLPresence');

        //this.sensorid = this.clientConn.register(this, 'zll', config.name, 'CLIPTemperature');

        //this.switch = node.clientConn.bridge.dsCreateSensor('ZGPSwitch', 'xx0', 'Switch');
        //RED.log.debug('ZLLTemperatureNode(): this.switch = ' + this.switch);

        /*var owner = 'Uf0c889b2bdcd4d02a36a833a';

        // virtual motion sensor
        this.clipid = node.clientConn.bridge.dsCreateSensor('CLIPGenericStatus', 'xx1', 'Virtual motion sensor');
        RED.log.debug('ZLLTemperatureNode(): this.clipid = ' + this.clipid);

        this.presenceid = node.clientConn.bridge.dsCreateSensor('ZLLPresence', 'xx2', 'Motion sensor');
        RED.log.debug('ZLLTemperatureNode(): this.presenceid = ' + this.presenceid);

        this.temperatureid = node.clientConn.bridge.dsCreateSensor('ZLLTemperature', 'xx3', 'Temperature sensor');
        RED.log.debug('ZLLTemperatureNode(): this.temperatureid = ' + this.temperatureid);

        //this.lightlevelid = node.clientConn.bridge.dsCreateSensor('ZLLLightlevel', 'xx4', 'Light level sensor');
        //RED.log.debug('ZLLTemperatureNode(): this.lightlevelid = ' + this.lightlevelid);

        //
        // Link the physical motion sensor to the virtual motion sensor
        // https://community.home-assistant.io/t/tutorial-adding-hue-motion-sensor-lux-temp-and-motion/5532
        //
        this.ruleid = node.clientConn.bridge.dsCreateRule(owner);
        RED.log.debug('ZLLTemperatureNode(): this.ruleid = ' + this.ruleid);

        var rule = node.clientConn.bridge.dsGetRule(this.ruleid);

        rule.conditions = [
            {
                address: '/sensors/' + this.presenceid + '/state/presence',
                operator: 'eq',
                value: 'true',
                _sensorid: this.presenceid.toString(),
                _key: 'presence'
            },
            {
                address: '/sensors/' + this.presenceid + '/state/presence',
                operator: 'dx',
                _sensorid: this.presenceid.toString(),
                _key: 'presence'
            }
        ];

        rule.actions = [
            {
                address: '/sensors/' + this.clipid + '/state',
                method: 'PUT',
                body: {
                    status: 1
                }
            }
        ];

        //RED.log.debug('ZLLTemperatureNode(): rule = ' + JSON.stringify(rule));

        node.clientConn.bridge.dsUpdateRule(this.ruleid, rule);

        RED.log.debug('ZLLTemperatureNode(): rules = ' + JSON.stringify(node.clientConn.bridge.dsRules.list));*/

        this.status({fill: 'green', shape: 'dot', text: 'Ready'});

        /*
         * Respond to inputs from NodeRED
         */
        this.on(
            'input',
            (msg) => {
                RED.log.debug('ZLLTemperatureNode(input): msg = ' + JSON.stringify(msg));
                RED.log.debug('ZLLTemperatureNode(input): typeof payload = ' + typeof msg.payload);

                if (typeof msg.payload === 'number') {
                    const temp = Math.round(msg.payload * 100);
                    const obj = this.clientConn.bridge.dsGetSensor(this.temperatureid);
                    RED.log.debug('ZLLTemperatureNode(input): obj = ' + JSON.stringify(obj));

                    obj.state.temperature = temp;
                    this.clientConn.bridge.dsUpdateSensorState(this.temperatureid, obj.state);

                    this.status({fill: 'green', shape: 'dot', text: 'Sensor state changed'});
                    setTimeout(() => this.status({fill: 'green', shape: 'dot', text: temp / 100}), 3000);
                } else {
                    this.status({fill: 'red', shape: 'dot', text: 'Unsupported payload'});
                    setTimeout(() => this.status({}), 3000);
                }
            }
        );

        this.on(
            'close',
            (removed, done) => {
                if (removed) {
                    // This node has been deleted.
                    this.clientConn.remove(this, 'zll');
                } else {
                    // This node is being restarted.
                    this.clientConn.deregister(this, 'manage');
                }

                done();
            }
        );
    }

    RED.nodes.registerType('huebridge-zlltemperature', ZLLTemperatureNode);
};
