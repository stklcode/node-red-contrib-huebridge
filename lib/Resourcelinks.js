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
 * Resource Links handler.
 */
class Resourcelinks {
    /**
     * Default constructor.
     */
    constructor() {
    }

    /**
     * Resource link dispatcher
     *
     * @see https://developers.meethue.com/documentation/resourcelinks-api
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     * @return {boolean} TRUE, if request has been dispatched.
     */
    resourcelinksDispatcher(response, method, url, urlParts, obj) {
        //this.debug('Resourcelinks::resourcelinksDispatcher(): url = ' + url);

        /*
         9.1. Get all resourcelinks - GET,  /api/<username>/resourcelinks
         9.2. Get Resourcelinks     - GET,  /api/<username>/resourcelinks/<id>
         9.3. Create Resourcelinks  - POST, /api/<username>/resourcelinks
         9.4. Update Resourcelinks  - PUT,  /api/<username>/resourcelinks/<id>
         9.5. Delete Resourcelinks  - DEL,  /api/<username>/resourcelinks/<id>
        */

        const api1 = /^\/api\/(\w+)\/resourcelinks$/.exec(url);
        const api2 = /^\/api\/(\w+)\/resourcelinks\/(\w+)$/.exec(url);

        if (api1 && method === 'get') {              // 9.1
            this.debug('Resourcelinks::resourcelinksDispatcher(): Get all resourcelinks');
            this.resourcelinksGetAll(response, method, url, urlParts, obj);
        } else if (api2 && method === 'get') {       // 9.2
            this.debug('Resourcelinks::resourcelinksDispatcher(): Get Resourcelinks');
            this.resourcelinksGet(response, method, url, urlParts, obj);
        } else if (api1 && method === 'post') {      // 9.3
            this.debug('Resourcelinks::resourcelinksDispatcher(): Create Resourcelinks');
            this.resourcelinksCreate(response, method, url, urlParts, obj);
        } else if (api2 && method === 'put') {       // 9.4
            this.debug('Resourcelinks::resourcelinksDispatcher(): Update Resourcelinks');
            this.resourcelinksUpdate(response, method, url, urlParts, obj);
        } else if (api2 && method === 'delete') {    // 9.5
            this.debug('Resourcelinks::resourcelinksDispatcher(): Delete Resourcelinks');
            this.resourcelinksDelete(response, method, url, urlParts, obj);
        } else {
            //this.debug('Resourcelinks::resourcelinksDispatcher(): nothing here ...');
            return false;
        }

        return true;
    }

    /**
     * Get all resource links.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    resourcelinksGetAll(response, method, url, urlParts, obj) {
        this.debug('Resourcelinks::resourcelinksGetAll()');

        if (this.dsIsUsernameValid(urlParts[2])) {
            this.responseJSON(response, this.dsGetAllResourcelinks());
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Get a resource link.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    resourcelinksGet(response, method, url, urlParts, obj) {
        this.debug('Resourcelinks::resourcelinksGet(): obj = ' + JSON.stringify(obj));

        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];
            var o = this.dsGetResourcelinks(id);

            if (o === false) {
                this.responseError(response, 3, '/resourcelinks/' + id);
                return;
            }

            this.responseJSON(response, o);
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Create a resource link.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    resourcelinksCreate(response, method, url, urlParts, obj) {
        this.debug('Resourcelinks::resourcelinksCreate(): obj = ' + JSON.stringify(obj));

        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = this.dsCreateResourcelinks(urlParts[2]);
            var o = this.dsGetResourcelinks(id);

            if (o === false) {
                this.responseError(response, 3, '/resourcelinks/' + id);
                return;
            }

            if (Object.prototype.hasOwnProperty.call(obj,'name')) {
                o.name = obj.name;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'description')) {
                o.description = obj.description;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'classid')) {
                o.classid = obj.classid;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'owner')) {
                o.owner = obj.owner;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'recycle')) {
                o.recycle = obj.recycle;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'links')) {
                o.links = obj.links;
            }

            this.debug('Resourcelinks::resourcelinksCreate(): o = ' + JSON.stringify(o));
            this.dsUpdateResourcelinks(id, o);

            var arr = this.responseMultiBegin();
            this.responseMultiAddSuccess(arr, 'id', id);
            this.responseMultiEnd(arr, response);

            process.nextTick(() => {
                this.emit('resourcelinks-created', id, o);
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Update a resource link.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    resourcelinksUpdate(response, method, url, urlParts, obj) {
        this.debug('Resourcelinks::resourcelinksUpdate(): obj = ' + JSON.stringify(obj));

        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];
            var o = this.dsGetResourcelinks(id);

            this.debug('Resourcelinks::resourcelinksUpdate(): id = ' + id);
            this.debug('Resourcelinks::resourcelinksUpdate(): o = ' + JSON.stringify(o));

            if (o === false) {
                this.responseError(response, 3, '/resourcelinks/' + id);
                return;
            }

            var arr = this.responseMultiBegin();

            if (Object.prototype.hasOwnProperty.call(obj,'name')) {
                o.name = obj.name;
                this.responseMultiAddSuccess(arr, '/resourcelinks/' + id + '/name', o.name);
            }
            if (Object.prototype.hasOwnProperty.call(obj,'description')) {
                o.description = obj.description;
                this.responseMultiAddSuccess(arr, '/resourcelinks/' + id + '/description', o.description);
            }
            if (Object.prototype.hasOwnProperty.call(obj,'classid')) {
                o.classid = obj.classid;
                this.responseMultiAddSuccess(arr, '/resourcelinks/' + id + '/classid', o.classid);
            }
            if (Object.prototype.hasOwnProperty.call(obj,'owner')) {
                o.owner = obj.owner;
                this.responseMultiAddSuccess(arr, '/resourcelinks/' + id + '/owner', o.owner);
            }
            if (Object.prototype.hasOwnProperty.call(obj,'recycle')) {
                o.recycle = obj.recycle;
                this.responseMultiAddSuccess(arr, '/resourcelinks/' + id + '/recycle', o.recycle);
            }
            if (Object.prototype.hasOwnProperty.call(obj,'links')) {
                o.links = obj.links;
                this.responseMultiAddSuccess(arr, '/resourcelinks/' + id + '/links', o.links);
            }

            this.responseMultiEnd(arr, response);

            this.dsUpdateResourcelinks(id, o);

            process.nextTick(() => {
                this.emit('resourcelinks-modified', id, o);
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * delete a resource link.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    resourcelinksDelete(response, method, url, urlParts, obj) {
        this.debug('Resourcelinks::resourcelinksDelete(): obj = ' + JSON.stringify(obj));

        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];

            if (this.dsDeleteResourcelinks(id)) {
                var resp = [{success: '/resourcelinks/' + id + ' deleted.'}];

                this.responseJSON(response, resp);

                process.nextTick(() => {
                    this.emit('resourcelinks-deleted', id);
                });
            } else {
                this.responseError(response, 3, '/resourcelinks/' + id);
            }
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }
}

module.exports = Resourcelinks;
