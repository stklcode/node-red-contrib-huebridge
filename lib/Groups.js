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

/**
 * Groups handler.
 */
class Groups {
    /**
     * Default constructor.
     */
    constructor() {
    }

    /**
     * Groups dispatcher.
     *
     * @see https://developers.meethue.com/documentation/groups-api
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     * @return {boolean} TRUE, if request has been dispatched.
     */
    groupsDispatcher(response, method, url, urlParts, obj) {
        //this.debug('Groups::groupsDispatcher(): url = ' + url);

        /*
         2.1. Get all groups        - GET,  /api/<username>/groups
         2.2. Create group          - POST, /api/<username>/groups
         2.3. Get group attributes  - GET,  /api/<username>/groups/<id>
         2.4. Set group attributes  - PUT,  /api/<username>/groups/<id>
         2.5. Set group state       - PUT,  /api/<username>/groups/<id>/action
         2.6. Delete Group          - DEL,  /api/<username>/groups/<id>
        */

        var api1 = /^\/api\/(\w+)\/groups$/.exec(url);
        var api2 = /^\/api\/(\w+)\/groups\/(\w+)$/.exec(url);
        var api3 = /^\/api\/(\w+)\/groups\/(\w+)\/action$/.exec(url);

        if (api1 && method === 'get') {              // 2.1
            this.debug('Groups::groupsDispatcher(): Get all groups');
            this.groupsGetAll(response, method, url, urlParts, obj);
        } else if (api1 && method === 'post') {      // 2.2
            this.debug('Groups::groupsDispatcher(): Create group');
            this.groupsCreate(response, method, url, urlParts, obj);
        } else if (api2 && method === 'get') {       // 2.3
            this.debug('Groups::groupsDispatcher(): Get group attributes');
            this.groupsGetAttributes(response, method, url, urlParts, obj);
        } else if (api2 && method === 'put') {       // 2.4
            this.debug('Groups::groupsDispatcher(): Set group attributes');
            this.groupsSetAttributes(response, method, url, urlParts, obj);
        } else if (api3 && method === 'put') {       // 2.5
            this.debug('Groups::groupsDispatcher(): Set group state');
            this.groupsSetState(response, method, url, urlParts, obj);
        } else if (api2 && method === 'delete') {    // 2.7
            this.debug('Groups::groupsDispatcher(): Delete Group');
            this.groupsDelete(response, method, url, urlParts, obj);
        } else {
            //this.debug('Groups::groupsDispatcher(): nothing here ...');
            return false;
        }

        return true;
    }

    /**
     * Get all groups.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    groupsGetAll(response, method, url, urlParts, obj) {
        this.debug('Groups::groupsGetAll()');

        if (this.dsIsUsernameValid(urlParts[2])) {
            this.responseJSON(response, this.dsGetAllGroups());
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Create a group.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    groupsCreate(response, method, url, urlParts, obj) {
        this.debug('Groups::groupsCreate(): obj = ' + JSON.stringify(obj));

        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = this.dsCreateGroup('');
            var o = this.dsGetGroup(id);

            if (o === false) {
                this.responseError(response, 3, '/groups/' + id);
                return;
            }

            if (Object.prototype.hasOwnProperty.call(obj, 'name')) {
                o.name = obj.name;
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'lights')) {
                o.lights = obj.lights;
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'type')) {
                o.type = obj.type;
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'state')) {
                if (Object.prototype.hasOwnProperty.call(obj.state, 'all_on')) {
                    o.state.all_on = obj.state.all_on;
                }
                if (Object.prototype.hasOwnProperty.call(obj.state, 'any_on')) {
                    o.state.any_on = obj.state.any_on;
                }
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'recycle')) {
                o.recycle = obj.recycle;
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'class')) {
                o.class = obj.class;
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'action')) {
                o.action = obj.action;
            }

            this.dsUpdateGroup(id, o);

            var arr = this.responseMultiBegin();
            this.responseMultiAddSuccess(arr, 'id', id);
            this.responseMultiEnd(arr, response);

            process.nextTick(() => {
                this.emit('group-created', id, o);
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Get group attributes.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    groupsGetAttributes(response, method, url, urlParts, obj) {
        this.debug('Groups::groupsGetAttributes(): obj = ' + JSON.stringify(obj));

        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];
            var o = this.dsGetGroup(id);

            if (o === false) {
                this.responseError(response, 3, '/groups/' + id);
                return;
            }

            this.responseJSON(response, o);
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Set group attributes.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    groupsSetAttributes(response, method, url, urlParts, obj) {
        this.debug('Groups::groupsSetAttributes(): obj = ' + JSON.stringify(obj));

        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];
            var o = this.dsGetGroup(id);

            this.debug('Groups::groupsSetAttributes(): id = ' + id);
            this.debug('Groups::groupsSetState(): o = ' + JSON.stringify(o));

            if (o === false) {
                this.responseError(response, 3, '/groups/' + id);
                return;
            }

            var arr = this.responseMultiBegin();

            if (Object.prototype.hasOwnProperty.call(obj, 'name')) {
                o.name = obj.name;
                this.responseMultiAddSuccess(arr, '/groups/' + id + '/name', o.name);
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'lights')) {
                o.lights = obj.lights;
                this.responseMultiAddSuccess(arr, '/groups/' + id + '/lights', o.lights);
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'type')) {
                o.type = obj.type;
                this.responseMultiAddSuccess(arr, '/groups/' + id + '/type', o.type);
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'state')) {
                if (Object.prototype.hasOwnProperty.call(obj.state, 'all_on')) {
                    o.state.all_on = obj.state.all_on;
                }
                if (Object.prototype.hasOwnProperty.call(obj.state, 'any_on')) {
                    o.state.any_on = obj.state.any_on;
                }
                this.responseMultiAddSuccess(arr, '/groups/' + id + '/state', o.state);
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'recycle')) {
                o.recycle = obj.recycle;
                this.responseMultiAddSuccess(arr, '/groups/' + id + '/recycle', o.recycle);
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'class')) {
                o.class = obj.class;
                this.responseMultiAddSuccess(arr, '/groups/' + id + '/class', o.class);
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'action')) {
                o.action = obj.action;
                this.responseMultiAddSuccess(arr, '/groups/' + id + '/action', o.action);
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'locations')) {
                o.locations = obj.locations;
                this.responseMultiAddSuccess(arr, '/groups/' + id + '/locations', o.locations);
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'stream')) {

                if (!Object.prototype.hasOwnProperty.call(o, 'stream')) {
                    o.stream = {};
                }

                if (Object.prototype.hasOwnProperty.call(obj.stream, 'active')) {
                    o.stream.active = obj.stream.active;
                    this.responseMultiAddSuccess(arr, '/groups/' + id + '/stream/active', o.stream.active);
                }

                if (Object.prototype.hasOwnProperty.call(obj.stream, 'proxymode')) {
                    o.stream.proxymode = obj.stream.proxymode;
                    this.responseMultiAddSuccess(arr, '/groups/' + id + '/stream/proxymode', o.stream.proxymode);
                }
            }

            this.responseMultiEnd(arr, response);

            this.dsUpdateGroup(id, o);

            process.nextTick(() => {
                this.emit('group-modified', id, o);
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Set group state.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    groupsSetState(response, method, url, urlParts, obj) {
        this.debug('Groups::groupsSetState(): obj = ' + JSON.stringify(obj));

        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];

            this.debug('Groups::groupsSetState(): id = ' + id);

            if (Object.prototype.hasOwnProperty.call(obj, 'scene')) {
                this.debug('Groups::groupsSetState(): recall scene; scene = ' + obj.scene);
                this.scenesRecall(response, method, url, urlParts, obj);
            } else if (id === '0') {
                // get all lights
                this.debug('Groups::groupsSetState(): group 0 (aka all lights)');
                var lightlist = this.dsGetAllLightIDs();

                const arr = this.responseMultiBegin();

                lightlist.forEach((lightid, idx) => {
                    this.debug('Groups::groupsSetState(): idx = ' + idx + ', lightid = ' + JSON.stringify(lightid));

                    if (0 === idx) {
                        this._lightsUpdateState(id, lightid, obj, arr);
                    } else {
                        this._lightsUpdateState(id, lightid, obj, null);
                    }
                });

                this.responseMultiEnd(arr, response);
            } else {
                var o = this.dsGetGroup(id);
                this.debug('Groups::groupsSetState(): o = ' + JSON.stringify(o));

                if (o === false) {
                    this.responseError(response, 3, '/groups/' + id);
                    return;
                }

                const arr = this.responseMultiBegin();

                o.lights.forEach((lightid, idx) => {
                    this.debug('Groups::groupsSetState(): idx = ' + idx + ', lightid = ' + lightid);

                    if (0 === idx) {
                        this._lightsUpdateState(id, lightid, obj, arr);
                    } else {
                        this._lightsUpdateState(id, lightid, obj, null);
                    }
                });

                this.responseMultiEnd(arr, response);
            }
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Delete a group.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    groupsDelete(response, method, url, urlParts, obj) {
        this.debug('Groups::groupsDelete(): obj = ' + JSON.stringify(obj));

        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];

            if (this.dsDeleteGroup(id)) {
                var resp = [{success: '/groups/' + id + ' deleted.'}];

                this.responseJSON(response, resp);

                process.nextTick(() => {
                    this.emit('group-deleted', id);
                });
            } else {
                this.responseError(response, 3, '/groups/' + id);
            }
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Update light state.
     *
     * @param {string} id      Group ID.
     * @param {string} lightid Light ID.
     * @param {*}      obj     New light state.
     * @param {*[]}    arr     Response parts.
     * @private
     */
    _lightsUpdateState(id, lightid, obj, arr) {
        var o = this.dsGetLight(lightid);   // get the light

        if (o === false) {
            this.debug('Groups::_lightsUpdateState(): invalid lightid; lightid = ' + lightid);
            if (arr !== null) this.responseError(arr, 3, '/lights/' + lightid);
            return;
        }

        this.debug('Groups::_lightsUpdateState(): obj = ' + JSON.stringify(obj));
        this.debug('Groups::_lightsUpdateState(): o   = ' + JSON.stringify(o));

        if (Object.prototype.hasOwnProperty.call(obj, 'on')) {
            o.state.on = obj.on;
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/on', o.state.on);
        }
        if (Object.prototype.hasOwnProperty.call(obj, 'bri')) {
            o.state.bri = obj.bri;
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/bri', o.state.bri);
        } else if (Object.prototype.hasOwnProperty.call(obj, 'bri_inc')) {
            o.state.bri += obj.bri_inc;
            if (o.state.bri > 254) {
                o.state.bri = 254;
            } else if (o.state.bri < 1) {
                o.state.bri = 1;
            }
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/bri', o.state.bri);
        }
        if (Object.prototype.hasOwnProperty.call(obj, 'hue')) {
            o.state.hue = obj.hue;
            obj.colormode = 'hs';
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/hue', o.state.hue);
        } else if (Object.prototype.hasOwnProperty.call(obj, 'hue_inc')) {
            obj.colormode = 'hs';
            if (o.state.hue + obj.hue_inc < 0) {
                // 0 , -2 = 65534
                o.state.hue = (o.state.hue + 65536) + obj.hue_inc;
            } else if (o.state.hue + obj.hue_inc > 65535) {
                // 65535 , 1 = 0
                o.state.hue = (o.state.hue - 65536) + obj.hue_inc;
            } else {
                o.state.hue = o.state.hue + obj.hue_inc;
            }
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/hue', o.state.hue);
        }
        if (Object.prototype.hasOwnProperty.call(obj, 'sat')) {
            o.state.sat = obj.sat;
            obj.colormode = 'hs';
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/sat', o.state.sat);
        } else if (Object.prototype.hasOwnProperty.call(obj, 'sat_inc')) {
            obj.colormode = 'hs';
            o.state.sat += obj.sat_inc;
            if (o.state.sat > 254) {
                o.state.sat = 254;
            } else if (o.state.sat < 0) {
                o.state.sat = 0;
            }
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/sat', o.state.sat);
        }
        if (Object.prototype.hasOwnProperty.call(obj, 'ct')) {
            o.state.ct = obj.ct;
            obj.colormode = 'ct';
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/ct', o.state.ct);
        } else if (Object.prototype.hasOwnProperty.call(obj, 'ct_inc')) {
            o.state.ct += obj.ct_inc;
            obj.colormode = 'ct';
            if (o.state.ct > 500) {
                o.state.ct = 500;
            } else if (o.state.ct < 153) {
                o.state.ct = 153;
            }
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/ct', o.state.ct);
        }
        if (Object.prototype.hasOwnProperty.call(obj, 'xy')) {
            o.state.xy = obj.xy;
            obj.colormode = 'xy';
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/xy', o.state.xy);
        } else if (Object.prototype.hasOwnProperty.call(obj, 'xy_inc')) {
            var x = o.state.xy[0] + obj.xy_inc[0];
            var y = o.state.xy[1] + obj.xy_inc[1];
            if (x > 1) {
                x = 1;
            } else if (x < 0) {
                x = 0;
            }
            if (y > 1) {
                y = 1;
            } else if (y < 0) {
                y = 0;
            }
            o.state.xy[0] = x;
            o.state.xy[1] = y;
            obj.colormode = 'xy';
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/xy', o.state.xy);
        }
        if (Object.prototype.hasOwnProperty.call(obj, 'colormode')) {
            o.state.colormode = obj.colormode;
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/colormode', o.state.colormode);
        }
        if (Object.prototype.hasOwnProperty.call(obj, 'effect')) {
            o.state.effect = obj.effect;
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/effect', o.state.effect);
        }
        if (Object.prototype.hasOwnProperty.call(obj, 'alert')) {
            o.state.alert = obj.alert;
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/alert', o.state.alert);
        }
        if (Object.prototype.hasOwnProperty.call(obj, 'transitiontime')) {
            o.state.transitiontime = obj.transitiontime;
            if (arr !== null) this.responseMultiAddSuccess(arr, '/groups/' + id + '/action/transitiontime', o.state.transitiontime);
        }

        this.dsUpdateLightState(lightid, o.state);

        process.nextTick(() => {
            this.emit('light-state-modified', lightid, obj);
        });
    }
}

module.exports = Groups;
