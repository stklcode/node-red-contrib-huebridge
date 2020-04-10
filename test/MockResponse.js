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

/**
 * Mock HTTP response to capture contents.
 *
 * @see http.ServerResponse
 */
class MockResponse {
    constructor() {
        this.status = 0;
        this.headers = {};
        this.body = '';
        this.finalized = false;
    }

    /**
     * Write response head.
     *
     * @param {number} statusCode HTTP status code.
     * @param {*[]}    headers    HTTP headers.
     */
    writeHead(statusCode, headers) {
        this.status = statusCode;
        for (let [k, v] of Object.entries(headers)) {
            this.headers[k] = v;
        }
    }

    /**
     * Finalize response with body content.
     *
     * @param {string} body Response body to append.
     */
    end(body = '') {
        this.body += body;
        this.finalized = true;
    }
}

module.exports = MockResponse;
