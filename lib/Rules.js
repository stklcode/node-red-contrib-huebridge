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
 * Rules handler.
 */
class Rules {
    /**
     * Default constructor.
     */
    constructor() {
    }

    /**
     * Rules dispatcher.
     *
     * @see https://developers.meethue.com/documentation/rules-api
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     * @return {boolean} TRUE, if request has been dispatched.
     */
    rulesDispatcher(response, method, url, urlParts, obj) {
        //this.debug('Rules::rulesDispatcher(): url = ' + url);

        /*
         6.1. Get all rules - GET,  /api/<username>/rules
         6.2. Get Rule      - GET,  /api/<username>/rules/<id>
         6.3. Create Rule   - POST, /api/<username>/rules
         6.4. Update Rule   - PUT,  /api/<username>/rules/<id>
         6.5. Delete Rule   - DEL,  /api/<username>/rules/<id>
        */

        const api1 = /^\/api\/(\w+)\/rules$/.exec(url);
        const api2 = /^\/api\/(\w+)\/rules\/(\w+)$/.exec(url);

        if (api1 && method === 'get') {              // 6.1
            this.debug('Rules::rulesDispatcher(): Get all rules');
            this.rulesGetAll(response, method, url, urlParts, obj);
        } else if (api2 && method === 'get') {       // 6.2
            this.debug('Rules::rulesDispatcher(): Get Rule');
            this.rulesGet(response, method, url, urlParts, obj);
        } else if (api1 && method === 'post') {      // 6.3
            this.debug('Rules::rulesDispatcher(): Create Rule');
            this.rulesCreate(response, method, url, urlParts, obj);
        } else if (api2 && method === 'put') {       // 6.4
            this.debug('Rules::rulesDispatcher(): Update Rule');
            this.rulesUpdate(response, method, url, urlParts, obj);
        } else if (api2 && method === 'delete') {    // 6.5
            this.debug('Rules::rulesDispatcher(): Delete Rule');
            this.rulesDelete(response, method, url, urlParts, obj);
        } else {
            //this.debug('Rules::rulesDispatcher(): nothing here ...');
            return false;
        }

        return true;
    }

    /**
     * Get all rules.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    rulesGetAll(response, method, url, urlParts, obj) {
        this.debug('Rules::rulesGetAll()');
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            this.responseJSON(response, this.dsGetAllRules());
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Get a rule.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    rulesGet(response, method, url, urlParts, obj) {
        this.debug('Rules::rulesGet(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];
            var o  = this.dsGetRule(id);

            if (o === false) {
                this.responseError(response, 3, '/rules/' + id);
                return;
            }

            this.responseJSON(response, o);
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Create a rule.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    rulesCreate(response, method, url, urlParts, obj) {
        this.debug('Rules::rulesCreate(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = this.dsCreateRule(urlParts[2]);
            var o  = this.dsGetRule(id);

            if (o === false) {
                this.responseError(response, 3, '/rules/' + id);
                return;
            }

            if (Object.prototype.hasOwnProperty.call(obj,'name')) {
                o.name = obj.name;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'recycle')) {
                o.recycle = obj.recycle;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'status')) {
                o.status = obj.status;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'conditions')) {
                obj.conditions.forEach((condition, idx) => {
                    this.debug('Rules::rulesCreate(): idx = ' + idx + ', condition = ' + JSON.stringify(condition));
                    
                    var c = {
                        address: '',
                        operator: '',
                        value: '',
                        _sensorid: 0,       // make life easier for the rule engine
                        _key: ''            // do.
                    };

                    if (Object.prototype.hasOwnProperty.call(condition,'address')) {
                        c.address = condition.address;

                        var path    = condition.address.split('/');
                        c._sensorid = path[2];
                        c._key      = path[4];

                        if ('sensors' !== path[1] || 'state' !== path[3]) {
                            throw 'Rules::rulesCreate(): not "sensors" or not "state"';
                        }
                    }
                    if (Object.prototype.hasOwnProperty.call(condition,'operator')) {
                        c.operator = condition.operator;
                    }
                    if (Object.prototype.hasOwnProperty.call(condition,'value')) {
                        c.value = condition.value;
                    }

                    o.conditions.push(c);
                });
            }
            if (Object.prototype.hasOwnProperty.call(obj,'actions')) {
                obj.actions.forEach((action, idx) => {
                    this.debug('Rules::rulesCreate(): idx = ' + idx + ', action = ' + JSON.stringify(action));
                    
                    var a = {
                        address: '',
                        method: '',
                        body: {}
                    };

                    if (Object.prototype.hasOwnProperty.call(action,'address')) {
                        a.address = action.address;
                    }
                    if (Object.prototype.hasOwnProperty.call(action,'method')) {
                        a.method = action.method;
                    }
                    if (Object.prototype.hasOwnProperty.call(action,'body')) {
                        a.body = action.body;               // JSON object
                    }

                    o.actions.push(a);
                });
            }

            this.debug('Rules::rulesCreate(): o = ' + JSON.stringify(o));
            this.dsUpdateRule(id, o);

            var arr = this.responseMultiBegin(); this.responseMultiAddSuccess(arr, 'id', id); this.responseMultiEnd(arr, response);

            process.nextTick(() => {
                this.emit('rule-created', id, o);
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Update a rule.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    rulesUpdate(response, method, url, urlParts, obj) {
        this.debug('Rules::rulesUpdate(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];
            var o  = this.dsGetRule(id);

            this.debug('Rules::rulesUpdate(): id = ' + id);
            this.debug('Rules::rulesUpdate(): o = ' + JSON.stringify(o));

            if (o === false) {
                this.responseError(response, 3, '/rules/' + id);
                return;
            }

            var arr = this.responseMultiBegin(); 

            if (Object.prototype.hasOwnProperty.call(obj,'name')) {
                o.name = obj.name;
                this.responseMultiAddSuccess(arr, '/rules/' + id + '/name', o.name); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'recycle')) {
                o.recycle = obj.recycle;
                this.responseMultiAddSuccess(arr, '/rules/' + id + '/recycle', o.recycle); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'status')) {
                o.status = obj.status;
                this.responseMultiAddSuccess(arr, '/rules/' + id + '/status', o.status); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'conditions')) {
                o.conditions = [];

                obj.conditions.forEach((condition, idx) => {
                    this.debug('Rules::rulesUpdate(): idx = ' + idx + ', condition = ' + JSON.stringify(condition));
                    
                    var c = {
                        address: '',
                        operator: '',
                        value: ''
                    };

                    if (Object.prototype.hasOwnProperty.call(condition,'address')) {
                        c.address = condition.address;

                        var path    = condition.address.split('/');
                        c._sensorid = path[2];
                        c._key      = path[4];

                        if ('sensors' !== path[1] || 'state' !== path[3]) {
                            throw 'Rules::rulesUpdate(): not "sensors" or not "state"';
                        }
                    }
                    if (Object.prototype.hasOwnProperty.call(condition,'operator')) {
                        c.operator = condition.operator;
                    }
                    if (Object.prototype.hasOwnProperty.call(condition,'value')) {
                        c.value = condition.value;
                    }

                    o.conditions.push(c);
                });

                this.responseMultiAddSuccess(arr, '/rules/' + id + '/conditions', o.conditions); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'actions')) {
                o.actions = [];
                obj.actions.forEach((action, idx) => {
                    this.debug('Rules::rulesUpdate(): idx = ' + idx + ', action = ' + JSON.stringify(action));
                    
                    var a = {
                        address: '',
                        method: '',
                        body: {}
                    };

                    if (Object.prototype.hasOwnProperty.call(action,'address')) {
                        a.address = action.address;
                    }
                    if (Object.prototype.hasOwnProperty.call(action,'method')) {
                        a.method = action.method;
                    }
                    if (Object.prototype.hasOwnProperty.call(action,'body')) {
                        a.body = action.body;               // JSON object
                    }

                    o.actions.push(a);
                });

                this.responseMultiAddSuccess(arr, '/rules/' + id + '/actions', o.actions); 
            }

            this.responseMultiEnd(arr, response);
            
            this.dsUpdateRule(id, o);

            process.nextTick(() => {
                this.emit('rule-modified', id, o);
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Delete a rule.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    rulesDelete(response, method, url, urlParts, obj) {
        this.debug('Rules::rulesDelete(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];

            if (this.dsDeleteRule(id)) {
                var resp = [{success: '/rules/' + id + ' deleted.'}];

                this.responseJSON(response, resp);

                process.nextTick(() => {
                    this.emit('rule-deleted', id);
                });
            } else {
                this.responseError(response, 3, '/rules/' + id);
            }
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }
}

module.exports = Rules;
