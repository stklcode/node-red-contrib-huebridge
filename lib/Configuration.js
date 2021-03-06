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
 * Configuration handler.
 */
class Configuration {
    /**
     * Default constructor.
     */
    constructor() {
        this.configLinkbutton   = false;
    }

    /**
     * Configuration dispatcher.
     *
     * @see https://developers.meethue.com/documentation/configuration-api
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     * @return {boolean} TRUE, if request has been dispatched.
     */
    configurationDispatcher(response, method, url, urlParts, obj) {
        //this.debug('Configuration::configurationDispatcher(): url = ' + url);

        /*
         7.1. Create user                - POST, /api
         7.2. Get configuration          - GET,  /api/<username>/config
         7.3. Modify configuration       - PUT,  /api/<username>/config
         7.4. Delete user from whitelist - DEL,  /api/<username>/config/whitelist/<username2>
         7.5. Get full state (datastore) - GET,  /api/<username>
        */

        const api1 = /^\/api\/?$/.exec(url);
        const api2 = /^\/api\/(\w+)\/config$/.exec(url);
        const api3 = /^\/api\/(\w+)\/config\/whitelist\/(\w+)$/.exec(url);
        const api4 = /\/api\/(\w+)$/.exec(url);
    
        if (api1 && method === 'post') {            // 7.1
            this.debug('Configuration::configurationDispatcher(): Create user');
            this.configUserCreate(response, method, url, urlParts, obj);
        } else if (api2 && method === 'get') {      // 7.2
            this.debug('Configuration::configurationDispatcher(): Get configuration');
            this.configGet(response, method, url, urlParts, obj);
        } else if (api2 && method === 'put') {      // 7.3
            this.debug('Configuration::configurationDispatcher(): Modify configuration');
            this.configModify(response, method, url, urlParts, obj);
        } else if (api3 && method === 'delete') {    // 7.4
            this.debug('Configuration::configurationDispatcher(): Delete user from whitelist');
            this.configUserDelete(response, method, url, urlParts, obj);
        } else if (api4 && method === 'get') {      // 7.5
            this.debug('Configuration::configurationDispatcher(): Get full state (datastore)');
            this.configGetFullState(response, method, url, urlParts, obj);
        } else {
            //this.debug('Configuration::configurationDispatcher(): nothing here ...');
            return false;
        }

        return true;
    }
    /**
     * Create a user.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    configUserCreate(response, method, url, urlParts, obj) {
        this.debug('Configuration::configUserCreate(): obj = ' + JSON.stringify(obj));

        if (this.dsGetLinkbutton()) {
            var username  = this.dsNewUsername(obj.devicetype);

            if (Object.prototype.hasOwnProperty.call(obj, 'generateclientkey') && obj.generateclientkey === true) {
                var clientkey = this.dsNewClientkey(username);

                this.debug('Configuration::configUserCreate(): clientkey = ' + clientkey);

                let arr = this.responseMultiBegin();

                var r = {
                    success:{
                        username: username,
                        clientkey: clientkey
                    }
                };
                arr.push(r);

                this.responseMultiEnd(arr, response);        
            } else {
                let arr = this.responseMultiBegin(); this.responseMultiAddSuccess(arr, 'username', username); this.responseMultiEnd(arr, response);
            }

            process.nextTick(() => {
                this.emit('config-user-created', username);
            });
        } else {
            this.responseError(response, 101, '');
        }
    }

    /**
     * Get configuration.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    configGet(response, method, url, urlParts, obj) {
        this.debug('Configuration::configGet()');
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            this.responseJSON(response, this.dsGetConfig());
        } else {
            if (this.dsGetLinkbutton()) {
                this.responseJSON(response, this.dsGetConfig());
            } else {
                this.responseJSON(response, this.dsGetMinimalConfig());
            }
        }
    }

    /**
     * Modify configuration.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    configModify(response, method, url, urlParts, obj) {
        this.debug('Configuration::configModify(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var arr = this.responseMultiBegin(); 

            if (Object.prototype.hasOwnProperty.call(obj, 'name')) {
                this.dsSetName(obj.portalservices);
                this.responseMultiAddSuccess(arr, '/config/name', obj.name); 
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'linkbutton')) {
                this.dsSetLinkbutton(obj.linkbutton);
                this.responseMultiAddSuccess(arr, '/config/linkbutton', obj.linkbutton); 
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'portalservices')) {
                this.dsSetPortalservice(obj.portalservices);
                this.responseMultiAddSuccess(arr, '/config/portalservices', obj.portalservices); 
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'timezone')) {
                this.dsSetTimezone(obj.timezone);
                this.responseMultiAddSuccess(arr, '/config/timezone', obj.timezone); 
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'zigbeechannel')) {
                this.dsSetZigbeechannel(obj.zigbeechannel);
                this.responseMultiAddSuccess(arr, '/config/zigbeechannel', obj.zigbeechannel); 
            }

            // these we are going to simply fake
            if (Object.prototype.hasOwnProperty.call(obj, 'UTC')) {
                this.responseMultiAddSuccess(arr, '/config/UTC', obj.UTC); 
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'dhcp')) {
                this.responseMultiAddSuccess(arr, '/config/dhcp', obj.dhcp); 
            }
            if (Object.prototype.hasOwnProperty.call(obj, 'touchlink')) {
                this.responseMultiAddSuccess(arr, '/config/touchlink', obj.touchlink); 
            }

            this.responseMultiEnd(arr, response);

            process.nextTick(() => {
                this.emit('config-modified');
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Delete a user.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    configUserDelete(response, method, url, urlParts, obj) {
        this.debug('Configuration::configUserDelete(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            if (this.dsIsUsernameValid(urlParts[5])) {
                var resp = [{success: '/config/whitelist/' + urlParts[5] + ' deleted.'}];

                this.responseJSON(response, resp);

                process.nextTick(() => {
                    this.emit('config-user-deleted', urlParts[5]);
                });
            } else {
                this.responseError(response, 3, '/config/whitelist/' + urlParts[5]);
            }
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Get full state.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    configGetFullState(response, method, url, urlParts, obj) {
        this.debug('Configuration::configGetFullState()');
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            this.responseJSON(response, this.dsGetFullConfig());
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }
}

module.exports = Configuration;
