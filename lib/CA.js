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

'use strict';

const openssl = require('openssl-nodejs-promise');

/**
 * The emulated Bridge class.
 */
class CA {
    static get OPENSSL_CONF() {
        return Buffer.from(
            '[ req ]\n' +
            'default_bits            = 1024\n' +
            'default_md              = sha256\n' +
            'distinguished_name      = req_distinguished_name\n' +
            'attributes              = req_attributes\n' +
            'req_extensions  = v3_req\n' +
            'x509_extensions = usr_cert\n' +
            '\n' +
            '\n' +
            '[ usr_cert ]\n' +
            'basicConstraints=critical,CA:FALSE\n' +
            'subjectKeyIdentifier=hash\n' +
            'authorityKeyIdentifier=keyid,issuer\n' +
            'keyUsage = critical, digitalSignature, keyEncipherment\n' +
            'extendedKeyUsage = serverAuth\n' +
            '\n' +
            '[ v3_req ]\n' +
            'extendedKeyUsage = serverAuth, clientAuth, codeSigning, emailProtection\n' +
            'basicConstraints = CA:FALSE\n' +
            'keyUsage = nonRepudiation, digitalSignature, keyEncipherment\n' +
            '\n' +
            '[ req_distinguished_name ]\n' +
            '\n' +
            '[ req_attributes ]\n'
        );
    }

    /**
     * Generate a self-signed key pair.
     *
     * @param {string} mac MAC address of the bridge.
     * @return {Promise<*>} Promise of object containing key and cert.
     */
    static generateKeyPair(mac) {
        return new Promise((resolve, reject) => {
            const m = mac.toLowerCase().split(':');
            const serial = m[0] + m[1] + m[2] + 'fffe' + m[3] + m[4] + m[5];
            const decSerial = BigInt('0x' + serial).toString(10);

            openssl(
                [
                    'req',
                    '-new',
                    '-config', {name: 'huebridge.conf', buffer: CA.OPENSSL_CONF},
                    '-nodes',
                    '-x509',
                    '-newkey', 'ec',
                    '-pkeyopt', 'ec_paramgen_curve:P-256',
                    '-pkeyopt', 'ec_param_enc:named_curve',
                    '-subj', '/C=NL/O=Philips Hue/CN=' + serial,
                    '-set_serial', decSerial
                ],
                {
                    dir: __dirname + '/..'
                }
            ).then(
                (res) => {
                    let key = '';
                    let cert = '';
                    let isKey = false;
                    let isCert = false;
                    for (let l of res.toString().split('\n')) {
                        if (l === '-----BEGIN PRIVATE KEY-----') {
                            key += l + '\n';
                            isKey = true;
                        } else if (isKey && l === '-----END PRIVATE KEY-----') {
                            key += l + '\n';
                            isKey = false;
                        } else if (isKey) {
                            key += l + '\n';
                        } else if (l === '-----BEGIN CERTIFICATE-----') {
                            cert += l + '\n';
                            isCert = true;
                        } else if (isCert && l === '-----END CERTIFICATE----') {
                            cert += l + '\n';
                            isCert = false;
                        } else if (isCert) {
                            cert += l + '\n';
                        }
                    }

                    resolve({
                        key: key,
                        cert: cert
                    });
                },
                (err) => {
                    reject(err);
                }
            ).catch((err) => {
                reject(err);
            });
        });
    }
}

module.exports = CA;
