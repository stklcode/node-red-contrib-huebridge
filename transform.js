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
     * Transform Node.
     *
     * @param config Node configuration.
     * @constructor
     */
    function TransformNode(config) {
        RED.nodes.createNode(this, config);

        this.typ = parseInt(config.typ);
        this.timer = null;
        this.transitiontime = 0;
        this.bri_step = 0;
        this.onoff = false;
        this.bri = 0;
        this.ct = null;
        this.xy = null;
        this.hue = null;
        this.sat = null;

        /*
         * Respond to inputs from NodeRED
         */
        this.on(
            'input',
            (msg) => {
                RED.log.debug('TransformNode(input): payload = ' + JSON.stringify(msg.payload));

                const object = msg.payload;

                if (Object.prototype.hasOwnProperty.call(object, 'on')) {
                    this.onoff = object.on;

                    if (!object.on) {
                        if (this.timer !== null) {
                            clearInterval(this.timer);
                            this.timer = null;
                        }

                        msg.payload = {r: 0, g: 0, b: 0};

                        this.send(msg);
                    }
                }

                if (Object.prototype.hasOwnProperty.call(object, 'colormode')) {
                    if (object.colormode === 'xy' && Object.prototype.hasOwnProperty.call(object, 'xy')) {
                        RED.log.debug('TransformNode(input): colormode "xy"');
                        this.xy = object.xy;
                        this.ct = null;
                        this.hue = null;
                        this.sat = null;
                    } else if (object.colormode === 'ct' && Object.prototype.hasOwnProperty.call(object, 'ct')) {
                        RED.log.debug('TransformNode(input): colormode "ct"');
                        this.xy = null;
                        this.ct = object.ct;
                        this.hue = null;
                        this.sat = null;
                    } else if (object.colormode === 'hs') {
                        RED.log.debug('TransformNode(input): colormode "hs"');
                        this.xy = null;
                        this.ct = null;

                        if (Object.prototype.hasOwnProperty.call(object, 'hue')) {
                            RED.log.debug('TransformNode(input): got hue');
                            this.hue = object.hue;
                        }
                        if (Object.prototype.hasOwnProperty.call(object, 'sat')) {
                            RED.log.debug('TransformNode(input): got sat');
                            this.sat = object.sat;
                        }
                    }
                }

                if (Object.prototype.hasOwnProperty.call(object, 'transitiontime') && this.onoff === true && object.transitiontime > 0) {
                    RED.log.debug('TransformNode(input): transitiontime = ' + object.transitiontime);

                    var target_bri = object.bri * 0.0039370078740157;  // scale from [0 - 254] to [0.0 - 1.0]
                    var bri_steps = (target_bri - this.bri) / object.transitiontime;

                    RED.log.debug('TransformNode(input): target_bri = ' + target_bri);
                    RED.log.debug('TransformNode(input): bri_steps  = ' + bri_steps);

                    this.timer = setInterval(
                        () => {
                            this.bri += bri_steps;

                            //RED.log.debug('TransformNode(transition): this.bri = ' + this.bri);

                            if (this.bri >= target_bri) {
                                // transition completed
                                clearInterval(this.timer);

                                this.timer = null;
                                this.bri = target_bri > 1.0 ? 1.0 : target_bri;

                                RED.log.debug('TransformNode(transition): transition completed');
                            }

                            this.sendValues(node, msg.topic);
                        },
                        100
                    );

                    return;
                }

                if (Object.prototype.hasOwnProperty.call(object, 'bri')) {
                    this.bri = object.bri * 0.0039370078740157;  // scale from [0 - 254] to [0.0 - 1.0]
                }

                if (Object.prototype.hasOwnProperty.call(object, 'effect')) {
                    //changedState.effect = object.effect;
                }

                if (this.onoff === false) {
                    return;
                }

                this.sendValues(node, msg.topic);
            }
        );

        this.on(
            'close',
            (removed, done) => {
                if (removed) {
                    // this node has been deleted
                } else {
                    // this node is being restarted
                }

                done();
            }
        );

        /**
         *
         * @param node
         * @param topic
         */
        this.sendValues = function (node, topic) {
            var rgb = {
                r: 0.0,
                g: 0.0,
                b: 0.0
            };

            if (this.xy !== null) {
                RED.log.debug('TransformNode(sendValues): method xy');
                rgb = this.transformXYZSimple(this.xy[0], this.xy[1]);

                // adjust brightness
                rgb.r = rgb.r * this.bri;
                rgb.g = rgb.g * this.bri;
                rgb.b = rgb.b * this.bri;
            } else if (this.ct !== null) {
                RED.log.debug('TransformNode(sendValues): method ct');
                rgb = this.temperatureToRGB(this.ct);

                // adjust brightness
                rgb.r = rgb.r * this.bri;
                rgb.g = rgb.g * this.bri;
                rgb.b = rgb.b * this.bri;
            } else if (this.hue !== null && this.sat !== null) {
                RED.log.debug('TransformNode(sendValues): method hs');
                rgb = this.hsv2rgb(this.hue / 65535, this.sat / 254, this.bri);
            } else {
                RED.log.debug('TransformNode(sendValues): no transform method available');
                return;
            }

            if (this.typ === 1) {   // scale output
                rgb.r = Math.round(rgb.r * 255);
                rgb.g = Math.round(rgb.g * 255);
                rgb.b = Math.round(rgb.b * 255);
            }

            var msg = {
                topic: topic,
                payload: rgb
            };

            this.send(msg);
        };


        /**
         * @see https://developers.meethue.com/documentation/color-conversions-rgb-xy
         *
         * @param x
         * @param y
         * @return {{r: number, b: number, g: number}}
         */
        this.transformXYZSimple = function (x, y) {
            var z = 1.0 - x - y;

            var Y = 1.0;
            var X = (Y / y) * x;
            var Z = (Y / y) * z;

            // sRGB D65 conversion
            var r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
            var g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
            var b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

            if (r > b && r > g && r > 1.0) {
                // red is too big
                g = g / r;
                b = b / r;
                r = 1.0;
            } else if (g > b && g > r && g > 1.0) {
                // green is too big
                r = r / g;
                b = b / g;
                g = 1.0;
            } else if (b > r && b > g && b > 1.0) {
                // blue is too big
                r = r / b;
                g = g / b;
                b = 1.0;
            }

            // Apply gamma correction
            r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, (1.0 / 2.4)) - 0.055;
            g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, (1.0 / 2.4)) - 0.055;
            b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, (1.0 / 2.4)) - 0.055;

            if (r > b && r > g) {
                // red is biggest
                if (r > 1.0) {
                    g = g / r;
                    b = b / r;
                    r = 1.0;
                }
            } else if (g > b && g > r) {
                // green is biggest
                if (g > 1.0) {
                    r = r / g;
                    b = b / g;
                    g = 1.0;
                }
            } else if (b > r && b > g) {
                // blue is biggest
                if (b > 1.0) {
                    r = r / b;
                    g = g / b;
                    b = 1.0;
                }
            }

            return {r: r, g: g, b: b};
        };
        //
        this.ctToKelvin = function (ct) {
            // Mirek = 1,000,000 / (color temperature in Kelvin).
            // (color temperature in Kelvin) = 1,000,000 / Mirek
            return 1000000 / ct;
        };

        /**
         *
         * @param ct
         * @return {{r: number, b: number, g: number}}
         */
        this.temperatureToRGB = function (ct) {
            //RED.log.debug('TemperatureToRGB(): ct = ' + ct);

            const XYZ_to_RGB = [
                [3.24071, -0.969258, 0.0556352],
                [-1.53726, 1.87599, -0.203996],
                [-0.498571, 0.0415557, 1.05707]
            ];

            var T = this.ctToKelvin(ct);
            //RED.log.debug('TemperatureToRGB(): T = ' + T);

            var RGB = [0.0, 0.0, 0.0];
            var c;
            var xD, yD, X, Y, Z, max;

            // Fit for CIE Daylight illuminant
            if (T <= 4000) {
                xD = 0.27475e9 / (T * T * T) - 0.98598e6 / (T * T) + 1.17444e3 / T + 0.145986;
            } else if (T <= 7000) {
                xD = -4.6070e9 / (T * T * T) + 2.9678e6 / (T * T) + 0.09911e3 / T + 0.244063;
            } else {
                xD = -2.0064e9 / (T * T * T) + 1.9018e6 / (T * T) + 0.24748e3 / T + 0.237040;
            }

            yD = -3 * xD * xD + 2.87 * xD - 0.275;

            // Fit for Blackbody using CIE standard observer function at 2 degrees
            //xD = -1.8596e9/(T*T*T) + 1.37686e6/(T*T) + 0.360496e3/T + 0.232632;
            //yD = -2.6046*xD*xD + 2.6106*xD - 0.239156;

            // Fit for Blackbody using CIE standard observer function at 10 degrees
            //xD = -1.98883e9/(T*T*T) + 1.45155e6/(T*T) + 0.364774e3/T + 0.231136;
            //yD = -2.35563*xD*xD + 2.39688*xD - 0.196035;

            X = xD / yD;
            Y = 1;
            Z = (1 - xD - yD) / yD;

            max = 0;
            for (c = 0; c < 3; c++) {
                RGB[c] = X * XYZ_to_RGB[0][c] + Y * XYZ_to_RGB[1][c] + Z * XYZ_to_RGB[2][c];
                if (RGB[c] > max) {
                    max = RGB[c];
                }
            }

            for (c = 0; c < 3; c++) {
                RGB[c] = RGB[c] / max;
            }

            return {
                r: RGB[0],
                g: RGB[1],
                b: RGB[2]
            };
        };

        /**
         * https://stackoverflow.com/questions/3018313/algorithm-to-convert-rgb-to-hsv-and-hsv-to-rgb-in-range-0-255-for-both
         * Mar 24 '16 at 19:57, Geremia
         *
         * @param h
         * @param s
         * @param v
         * @return {{r: number, b: number, g: number}}
         */
        this.hsv2rgb = function (h, s, v) {
            var r, g, b;

            h = h * 360;

            var P, Q, T, fract;

            (h == 360.0) ? (h = 0.0) : (h /= 60.0);
            fract = h - Math.floor(h);

            P = v * (1. - s);
            Q = v * (1. - s * fract);
            T = v * (1. - s * (1. - fract));

            if (0. <= h && h < 1.) {
                r = v;
                g = T;
                b = P;
            } else if (1. <= h && h < 2.) {
                r = Q;
                g = v;
                b = P;
            } else if (2. <= h && h < 3.) {
                r = P;
                g = v;
                b = T;
            } else if (3. <= h && h < 4.) {
                r = P;
                g = Q;
                b = v;
            } else if (4. <= h && h < 5.) {
                r = T;
                g = P;
                b = v;
            } else if (5. <= h && h < 6.) {
                r = v;
                g = P;
                b = Q;
            } else {
                r = 0.0;
                g = 0.0;
                b = 0.0;
            }

            return {
                r: r,
                g: g,
                b: b
            };
        };

        /**
         * Converts an HSL color value to RGB. Conversion formula
         * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
         * Assumes h, s, and l are contained in the set [0, 1] and
         * returns r, g, and b in the set [0, 1].
         *
         * @param   {number}  h       The hue
         * @param   {number}  s       The saturation
         * @param   {number}  l       The lightness
         * @return  {Object}          The RGB representation
         */
        this.hslToRgb = function (h, s, l) {
            RED.log.debug('TransformNode(hslToRgb): h = ' + h);
            RED.log.debug('TransformNode(hslToRgb): s = ' + s);
            RED.log.debug('TransformNode(hslToRgb): l = ' + l);

            var r, g, b;

            if (s == 0) {
                r = g = b = l; // achromatic
            } else {
                const hue2rgb = function (p, q, t) {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };

                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;

                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }

            RED.log.debug('TransformNode(hslToRgb): r = ' + r);
            RED.log.debug('TransformNode(hslToRgb): g = ' + g);
            RED.log.debug('TransformNode(hslToRgb): b = ' + b);

            return {
                r: r,
                g: g,
                b: b
            };

            //return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        };
    }

    RED.nodes.registerType('huebridge-transform', TransformNode);

    /**
     * Scale hue value from 0-65535 to 0-360°.
     *
     * @param {number} hue Hue value (0-65535).
     * @return {number} Hue value in degrees.
     */
    const scaleHue = function (hue) {
        const v = hue / 182.04166;
        return v > 360.0 ? 360.0 : v;
    };

    /**
     * Scale saturation value from 0-254 to 0-100
     * @param {number} sat Saturation value (0-254).
     * @return {number} Saturation value (0-100).
     */
    const scaleSaturation = function (sat) {
        const v = sat / 2.54;
        return v > 100 ? 100 : v;
    };

    /**
     * Scale brightness 1-254 to 0-100%.
     *
     * @param {number} bri Brightness value (1-254)
     * @return {number} Brightness value in percent.
     */
    const scaleBrightness = function (bri) {
        const v = Math.round(bri / 2.54);
        return v > 100 ? 100 : v;
    };
};
