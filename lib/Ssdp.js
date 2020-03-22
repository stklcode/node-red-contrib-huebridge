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

const ssdp = require('peer-ssdp');

/**
 * Service discovery handler.
 */
class SSDP {
    /**
     * Default constructor.
     */
    constructor() {
    }

    /**
     * Service discovery disaptcher.
     *
     * @see https://developers.meethue.com/documentation/hue-bridge-discovery
     *
     * @param {*}        response HTTP response.
     * @param {string}   method   HTTP request method.
     * @param {string}   url      HTTP request URL.
     * @param {string[]} urlParts Split URL parts.
     * @param {*}        obj      Request payload (body).
     * @return {boolean} TRUE, if request has been dispatched.
     */
    ssdpDispatcher(response, method, url, urlParts, obj) {
        //this.debug('SSDP::ssdpDispatcher(): url = ' + url);

        const api1 = /^\/description.xml$/.exec(url);

        if (api1 && method === 'get') {
            //this.debug('SSDP::ssdpDispatcher(): /description.xml');
            this._ssdpDiscovery(response);
        } else {
            //this.debug('SSDP::ssdpDispatcher(): nothing here ...');
            return false;
        }

        return true;
    }

    /**
     * Start the discovery service.
     *
     * @return {boolean} TRUE ff the service has been started successfully
     */
    ssdpStart() {
        let httpPort = this.dsGetHttpPort();
        let extPort = this.dsGetExternalPort();
        if (httpPort === null || httpPort === undefined || httpPort <= 0 || httpPort >= 65536) {
            this.debug('SSDP::ssdpStart(): invalid port; ' + httpPort);
            return false;
        }

        if (extPort !== null && extPort !== undefined && extPort > 0 && extPort < 65536) {
            this.debug('SSDP::ssdpStart(): external port override; ' + extPort);
            httpPort = extPort;
        }

        const bridgeId = this.dsGetBridgeID();
        const mac = this.dsGetMAC().replace(/:/g, '');
        const uuid1 = 'uuid:2f402f80-da50-11e1-9b23-' + mac + '::upnp:rootdevice';
        const peer = ssdp.createPeer();

        this.ssdpPeer = peer;

        peer.on(
            'ready',
            () => {
                this.debug('SSDP::ssdpStart(peer-ready)');

                // send NOTIFY periodocally - every 30seconds
                setInterval(() => {
                    peer.alive({
                        LOCATION: 'http://{{networkInterfaceAddress}}:' + httpPort + '/description.xml',
                        SERVER: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.20.0',
                        NT: 'upnp:rootdevice',
                        USN: uuid1,
                        'hue-bridgeid': bridgeId,
                        'CACHE-CONTROL': 'max-age=100'
                    });

                    peer.alive({
                        LOCATION: 'http://{{networkInterfaceAddress}}:' + httpPort + '/description.xml',
                        SERVER: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.20.0',
                        NT: 'uuid:2f402f80-da50-11e1-9b23-' + mac,
                        USN: uuid1,
                        'hue-bridgeid': bridgeId,
                        'CACHE-CONTROL': 'max-age=100'
                    });

                    peer.alive({
                        LOCATION: 'http://{{networkInterfaceAddress}}:' + httpPort + '/description.xml',
                        SERVER: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.20.0',
                        NT: 'urn:schemas-upnp-org:device:basic:1',
                        USN: uuid1,
                        'hue-bridgeid': bridgeId,
                        'CACHE-CONTROL': 'max-age=100'
                    });
                }, 30000);
            }
        );

        peer.on('notify', (headers, address) => {
            //myself.node.debug('SSDP::start(peer-notify): address = ' + JSON.stringify(address));
            //myself.node.debug('SSDP::start(peer-notify): headers = ' + JSON.stringify(headers));
        });

        peer.on(
            'search',
            (headers, address) => {
                //myself.node.debug('SSDP::start(peer-search): address = ' + JSON.stringify(address));
                //myself.node.debug('SSDP::start(peer-search): headers = ' + JSON.stringify(headers));
                peer.reply({
                    LOCATION: 'http://{{networkInterfaceAddress}}:' + httpPort + '/description.xml',
                    SERVER: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.20.0',
                    EXT: '',
                    ST: 'upnp:rootdevice',
                    USN: uuid1,
                    'hue-bridgeid': bridgeId,
                    'CACHE-CONTROL': 'max-age=100'
                }, address);

                peer.reply({
                    LOCATION: 'http://{{networkInterfaceAddress}}:' + httpPort + '/description.xml',
                    SERVER: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.20.0',
                    EXT: '',
                    ST: 'uuid:2f402f80-da50-11e1-9b23-' + mac,
                    USN: uuid1,
                    'hue-bridgeid': bridgeId,
                    'CACHE-CONTROL': 'max-age=100'
                }, address);

                peer.reply({
                    LOCATION: 'http://{{networkInterfaceAddress}}:' + httpPort + '/description.xml',
                    SERVER: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.20.0',
                    EXT: '',
                    ST: 'urn:schemas-upnp-org:device:basic:1',
                    USN: uuid1,
                    'hue-bridgeid': bridgeId,
                    'CACHE-CONTROL': 'max-age=100'
                }, address);
            }
        );

        peer.on(
            'found',
            (headers, address) => {
                this.debug('SSDP::ssdpStart(peer-found): address = ' + JSON.stringify(address));
                this.debug('SSDP::ssdpStart(peer-found): headers = ' + JSON.stringify(headers));
            }
        );

        peer.on('close', () => this.debug('SSDP::ssdpStart(peer-close)'));

        peer.start();

        return true;
    }

    /**
     * Stop the discovery service.
     */
    ssdpStop() {
        this.ssdpPeer.close();
    }

    /**
     * Acutla discovery handler.
     *
     * @param {*} response HTTP response.
     * @private
     */
    _ssdpDiscovery(response) {
        //this.debug('SSDP::_ssdpDiscovery');

        let resp = `
                <root xmlns='urn:schemas-upnp-org:device-1-0'>
                <specVersion>
                    <major>1</major>
                    <minor>0</minor>
                </specVersion>
                <URLBase>http://{{URL}}/</URLBase>
                <device>
                    <deviceType>urn:schemas-upnp-org:device:Basic:1</deviceType>
                    <friendlyName>Philips hue ({{ADDRESS}})</friendlyName>
                    <manufacturer>Royal Philips Electronics</manufacturer>
                    <manufacturerURL>http://www.philips.com</manufacturerURL>
                    <modelDescription>Philips hue Personal Wireless Lighting</modelDescription>
                    <modelName>Philips hue bridge 2015</modelName>
                    <modelNumber>BSB002</modelNumber>
                    <modelURL>http://www.meethue.com</modelURL>
                    <serialNumber>{{SERIAL}}</serialNumber>
                    <UDN>uuid:2f402f80-da50-11e1-9b23-{{UUID}}</UDN>
                    <presentationURL>index.html</presentationURL>
                    <iconList>
                        <icon>
                            <mimetype>image/png</mimetype>
                            <height>48</height>
                            <width>48</width>
                            <depth>24</depth>
                            <url>hue_logo_0.png</url>
                        </icon>
                        <icon>
                            <mimetype>image/png</mimetype>
                            <height>120</height>
                            <width>120</width>
                            <depth>24</depth>
                            <url>hue_logo_3.png</url>
                        </icon>
                    </iconList>
                </device>
            </root>`;

        resp = resp.replace('{{URL}}', this.dsGetExternalURL());
        resp = resp.replace('{{ADDRESS}}', this.dsGetAddress());
        resp = resp.replace('{{SERIAL}}', this.dsGetMAC().replace(/:/g, ''));
        resp = resp.replace('{{UUID}}', this.dsGetMAC().replace(/:/g, ''));

        response.writeHead(200, {'Content-Type': 'application/xml'});
        response.end(resp);
    }
}

module.exports = SSDP;
