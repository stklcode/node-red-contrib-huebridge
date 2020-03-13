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
 * Scenes handler.
 */
class Scenes {
    /**
     * Default constructor.
     */
    constructor() {
    }

    /**
     * Scenes dispatcher.
     *
     * @see https://developers.meethue.com/documentation/scenes-api
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     * @return {boolean} TRUE, if request has been dispatched.
     */
    scenesDispatcher(response, method, url, urlParts, obj) {
        //console.log('Scenes::scenesDispatcher(): url = ' + url);

        /*
         4.1. Get all scenes    - GET,  /api/<username>/scenes
         4.2. Create Scene      - POST, /api/<username>/scenes
         4.3. Modify Scene      - PUT,  /api/<username>/scenes/<id>/lightstates/<id>
         4.4. Recall a scene    - done via groups
         4.5. Delete scene      - DEL,  /api/<username>/scenes/<id>
         4.6. Get Scene         - GET,  /api/<username>/scenes/<id>
        */

        var api1 = /^\/api\/(\w+)\/scenes$/.exec(url);
        var api2 = /^\/api\/(\w+)\/scenes\/(\w+)$/.exec(url);
        var api3 = /^\/api\/(\w+)\/scenes\/(\w+)\/lightstates\/(\w+)$/.exec(url);

        if (api1 && method === 'get') {              // 4.1
            this.debug('Scenes::scenesDispatcher(): Get all scenes');
            this.scenesGetAll(response, method, url, urlParts, obj);
        } else if (api1 && method === 'post') {      // 4.2
            this.debug('Scenes::scenesDispatcher(): Create Scene');
            this.scenesCreate(response, method, url, urlParts, obj);
        } else if (api2 && method === 'put') {       // 4.3
            this.debug('Scenes::scenesDispatcher(): Modify Scene');
            this.scenesModify(response, method, url, urlParts, obj);
        } else if (api3 && method === 'put') {       // 4.3
            this.debug('Scenes::scenesDispatcher(): Modify Scene');
            this.scenesModifyLightstate(response, method, url, urlParts, obj);
        } else if (api2 && method === 'delete') {    // 4.5
            this.debug('Scenes::scenesDispatcher(): Delete scene');
            this.scenesDelete(response, method, url, urlParts, obj);
        } else if (api2 && method === 'get') {       // 4.6
            this.debug('Scenes::scenesDispatcher(): Get Scene');
            this.scenesGet(response, method, url, urlParts, obj);
        } else {
            //this.debug('Scenes::scenesDispatcher(): nothing here ...');
            return false;
        }

        return true;
    }

    /**
     * Get all scenes.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    scenesGetAll(response, method, url, urlParts, obj) {
        this.debug('Scenes::scenesGetAll()');
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            this.responseJSON(response, this.dsGetAllScenes());
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Create a scene.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    scenesCreate(response, method, url, urlParts, obj) {
        this.debug('Scenes::scenesCreate(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = this.dsCreateScene(urlParts[2]);
            var o  = this.dsGetScene(id);

            if (o === false) {
                this.responseError(response, 3, '/scenes/' + id);
                return;
            }

            if (Object.prototype.hasOwnProperty.call(obj,'name')) {
                o.name = obj.name;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'lights')) {
                o.lights = obj.lights;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'owner')) {
                o.owner = obj.owner;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'recycle')) {
                o.recycle = obj.recycle;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'appdata')) {
                o.appdata = obj.appdata;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'picture')) {
                o.picture = obj.picture;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'effect')) {
                o.effect = obj.effect;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'transitiontime')) {
                o.transitiontime = obj.transitiontime;
            }
            if (Object.prototype.hasOwnProperty.call(obj,'version')) {
                o.version = obj.version;
            }

            this.dsUpdateScene(id, o);

            var arr = this.responseMultiBegin(); this.responseMultiAddSuccess(arr, 'id', id); this.responseMultiEnd(arr, response);

            process.nextTick(() => {
                this.emit('scene-created', id, o);
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Modify a scene.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    scenesModify(response, method, url, urlParts, obj) {
        this.debug('Scenes::scenesModify(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var id      = urlParts[4];
            var o       = this.dsGetScene(id);

            this.debug('Scenes::scenesModify(): id = ' + id);
            this.debug('Scenes::scenesModify(): o = ' + JSON.stringify(o));

            if (o === false) {
                this.responseError(response, 3, '/scenes/' + id);
                return;
            }

            var arr = this.responseMultiBegin(); 

            if (Object.prototype.hasOwnProperty.call(obj,'name')) {
                o.name = obj.name;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/name', o.name); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'lights')) {
                o.lights = obj.lights;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/lights', o.lights); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'storelightstate')) {
                // get current values from all the lights in this scene and store those values in this scene
                o.lights.forEach((lightid, idx) => {
                    this.debug('Scenes::scenesModify(): idx = ' + idx + ', lightid = ' + lightid);
                    
                    const l = this.dsGetLight(lightid);

                    if (l !== false) {
                        o.lightstate[lightid] = l.state;
                    }
                });

                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/storelightstate', true); 
            }

            this.responseMultiEnd(arr, response);
            
            this.dsUpdateScene(id, o);

            process.nextTick(() => {
                this.emit('scene-modified', id, o);
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Modify light state.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    scenesModifyLightstate(response, method, url, urlParts, obj) {
        this.debug('Scenes::scenesModifyLightstate(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var id      = urlParts[4];
            var lightid = urlParts[6];
            var o       = this.dsGetScene(id);

            this.debug('Scenes::scenesModifyLightstate(): id = ' + id);
            this.debug('Scenes::scenesModifyLightstate(): lightid = ' + lightid);
            this.debug('Scenes::scenesModifyLightstate(): o = ' + JSON.stringify(o));

            if (o === false) {
                this.responseError(response, 3, '/scenes/' + id);
                return;
            }

            if (!Object.prototype.hasOwnProperty.call(o.lightstates,lightid)) {
                this.debug('Scenes::scenesModifyLightstate(): creating lightstate');
                o.lightstates[lightid] = this.dsCreateLightState();
            }

            var arr = this.responseMultiBegin(); 

            if (Object.prototype.hasOwnProperty.call(obj,'on')) {
                o.lightstates[lightid].on = obj.on;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/lightstates/' + lightid + '/on', obj.on); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'bri')) {
                o.lightstates[lightid].bri = obj.bri;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/lightstates/' + lightid + '/bri', obj.bri); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'hue')) {
                o.lightstates[lightid].hue = obj.hue;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/lightstates/' + lightid + '/hue', obj.hue); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'sat')) {
                o.lightstates[lightid].sat = obj.sat;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/lightstates/' + lightid + '/sat', obj.sat); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'xy')) {
                o.lightstates[lightid].xy = obj.xy;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/lightstates/' + lightid + '/xy', obj.xy); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'ct')) {
                o.lightstates[lightid].ct = obj.ct;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/lightstates/' + lightid + '/ct', obj.ct); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'effect')) {
                o.lightstates[lightid].effect = obj.effect;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/lightstates/' + lightid + '/effect', obj.effect); 
            }
            if (Object.prototype.hasOwnProperty.call(obj,'transitiontime')) {
                o.lightstates[lightid].transitiontime = obj.transitiontime;
                this.responseMultiAddSuccess(arr, '/scenes/' + id + '/lightstates/' + lightid + '/transitiontime', obj.transitiontime); 
            }

            this.responseMultiEnd(arr, response);
            
            this.dsUpdateScene(id, o);

            process.nextTick(() => {
                this.emit('scene-lightstate-modified', id, o);
            });
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Delete a scene.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    scenesDelete(response, method, url, urlParts, obj) {
        this.debug('Scenes::scenesDelete()');
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];

            if (this.dsDeleteScene(id)) {
                var resp = [{success: '/scenes/' + id + ' deleted.'}];

                this.responseJSON(response, resp);

                process.nextTick(() => {
                    this.emit('scene-deleted', id);
                });
            } else {
                this.responseError(response, 3, '/scenes/' + id);
            }
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Get a scene.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     */
    scenesGet(response, method, url, urlParts, obj) {
        this.debug('Scenes::scenesGet()');
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            var id = urlParts[4];

            this.responseJSON(response, this.dsGetScene(id));
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }

    /**
     * Recall a scene.
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     * @private
     */
    scenesRecall(response, method, url, urlParts, obj) {
        this.debug('Scenes::scenesRecall(): obj = ' + JSON.stringify(obj));
        
        if (this.dsIsUsernameValid(urlParts[2])) {
            if (!Object.prototype.hasOwnProperty.call(obj,'scene')) {
                this.responseError(response, 2, '/groups/' + groupid + '/action/scene", "value":"scene missing"}]');
                return;
            }

            var groupid = urlParts[4];
            var scene   = this.dsGetScene(obj.scene);

            this.debug('Scenes::scenesRecall(): groupid = ' + groupid);
            this.debug('Scenes::scenesRecall(): o = ' + JSON.stringify(scene));

            if (scene === false) {
                this.responseError(response, 3, '/groups/' + groupid + '/action/scene", "value":"' + obj.scene + '"}]');
                return;
            }

            scene.lights.forEach((lightid, idx) => {
                this.debug('Scenes::scenesRecall(): idx = ' + idx + ', lightid = ' + lightid);
                
                this._lightsUpdateState('n/a', lightid, scene.lightstates[lightid], null);
            });

            var arr = this.responseMultiBegin(); this.responseMultiAddSuccess(arr, '/groups/' + groupid + '/action/scene', obj.scene); this.responseMultiEnd(arr, response);
        } else {
            this.responseError(response, 1, '/config/whitelist/' + urlParts[2]);
        }
    }
}

module.exports = Scenes;
