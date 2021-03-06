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

const schedule = require('node-schedule');
const suncalc = require('suncalc');

/**
 * Rule Engine.
 */
class RuleEngine {
    /**
     * Default constructor.
     */
    constructor() {
        this.reDebugEnabled = false;
        this.ruleEngineStates = {};
        this.scheduleEngineList = {};
    }

    /**
     * Initialize the rule engine.
     */
    ruleEngine() {
        this.sensorEngine();
        this.scheduleEngine();

        // Evaluate rules every one second.
        setInterval(
            () => this._ruleEngineEvalAll(),
            1000
        );

        this.on(
            'rule-engine-reload',
            () => {
                this.debug('RuleEngine::ruleEngine(rule-engine-reload)');

                this.sensorEngine();
                this.scheduleEngine();
            }
        );
    }

    /**
     * Evaluate all rules.
     *
     * @private
     */
    _ruleEngineEvalAll() {
        const now = new Date();
        const rules = this.dsGetAllRules();
        const sensors = this.dsGetAllSensors();

        //this.debug('RuleEngine::ruleEngineEvalAll(): sensors = ' + JSON.stringify(sensors));
        //this.debug('RuleEngine::ruleEngineEvalAll(): rules = ' + JSON.stringify(rules));

        //
        // iterate by rule then sensor
        //
        for (let ruleId in rules) {
            this.reDebug('RuleEngine::ruleEngineEvalAll(): ruleId = "' + ruleId + '"');

            let match = true;

            for (let conditionIdx in rules[ruleId].conditions) {
                this.reDebug('  RuleEngine::ruleEngineEvalAll(): conditionIdx = "' + conditionIdx + '"');
                this.reDebug('  RuleEngine::ruleEngineEvalAll(): condition    = ' + JSON.stringify(rules[ruleId].conditions[conditionIdx]));

                let sensorValue = null;
                let condValue = null;
                let operator = rules[ruleId].conditions[conditionIdx].operator;

                switch (operator) {
                    case 'eq':
                    case 'lt':
                    case 'gt':
                        sensorValue = this.dsGetSensor(rules[ruleId].conditions[conditionIdx]._sensorid).state[rules[ruleId].conditions[conditionIdx]._key];
                        this.reDebug('RuleEngine::ruleEngineEvalAll(eq): sensorValue  = ' + JSON.stringify(sensorValue));
                        this.reDebug('RuleEngine::ruleEngineEvalAll(eq): typeof       = ' + typeof sensorValue);
                        break;

                    case 'dx':
                    case 'ddx':
                        sensorValue = this.dsGetSensor(rules[ruleId].conditions[conditionIdx]._sensorid).state['lastupdated'];
                        //this.debug('RuleEngine::ruleEngineEvalAll(eq): sensorValue  = ' + JSON.stringify(sensorValue));
                        //this.debug('RuleEngine::ruleEngineEvalAll(eq): typeof       = ' + typeof sensorValue);
                        sensorValue = new Date(sensorValue);
                        this.reDebug('RuleEngine::ruleEngineEvalAll(eq): sensorValue  = ' + sensorValue);
                        this.reDebug('RuleEngine::ruleEngineEvalAll(eq): typeof       = ' + typeof sensorValue);
                        break;
                }

                switch (operator) {
                    case 'eq':          // equal
                        /*
                        ** Used for bool and int.
                        */
                        this.reDebug('RuleEngine::ruleEngineEvalAll(eq): ');
                        condValue = rules[ruleId].conditions[conditionIdx].value;
                        if (condValue == 'true') {
                            condValue = true;
                        } else if (condValue == 'false') {
                            condValue = false;
                        } else {
                            condValue = parseInt(condValue);
                        }
                        this.reDebug('RuleEngine::ruleEngineEvalAll(eq): condValue  = ' + JSON.stringify(condValue));
                        this.reDebug('RuleEngine::ruleEngineEvalAll(eq): typeof     = ' + typeof condValue);

                        if (sensorValue == condValue) {
                            this.debug('RuleEngine::ruleEngineEvalAll(eq): equal; ruleId = "' + ruleId + '"');
                        } else {
                            this.reDebug('RuleEngine::ruleEngineEvalAll(eq): not equal');
                            match = false;
                        }
                        break;

                    case 'lt':          // less than 
                        /*
                        ** Allowed on int values.
                        */
                        this.reDebug('RuleEngine::ruleEngineEvalAll(lt): ');
                        break;

                    case 'gt':          // greater than
                        /*
                        ** Allowed on int values.
                        */
                        this.reDebug('RuleEngine::ruleEngineEvalAll(gt): ');
                        break;

                    case 'dx':          // on change - 'value'
                        /*
                        ** Time (timestamps) int and bool values.
                        */
                        this.reDebug('RuleEngine::ruleEngineEvalAll(dx): ');
                        this.reDebug('RuleEngine::ruleEngineEvalAll(dx): now = ' + now);
                        if (now.getHours() == sensorValue.getHours() && now.getMinutes() == sensorValue.getMinutes() && now.getSeconds() == sensorValue.getSeconds()) {
                            this.debug('RuleEngine::ruleEngineEvalAll(dx): equal; ruleId = "' + ruleId + '"');
                        } else {
                            this.reDebug('RuleEngine::ruleEngineEvalAll(dx): not equal');
                            match = false;
                        }
                        break;

                    case 'ddx':         // on change - 'delayed value'
                        /*
                        ** Time (timestamps) int and bool values.
                        */
                        this.reDebug('RuleEngine::ruleEngineEvalAll(ddx): ');
                        this.reDebug('RuleEngine::ruleEngineEvalAll(ddx): now        = ' + now);

                        condValue = rules[ruleId].conditions[conditionIdx].value;
                        this.reDebug('RuleEngine::ruleEngineEvalAll(ddx): condValue  = ' + JSON.stringify(condValue));
                        this.reDebug('RuleEngine::ruleEngineEvalAll(ddx): typeof     = ' + typeof condValue);

                        // timer, expiring after given time
                        var timer1 = /^PT(\d{2}):(\d{2}):(\d{2})/.exec(condValue);

                        if (timer1) {
                            var h = parseInt(timer1[1]);
                            var m = parseInt(timer1[2]);
                            var s = parseInt(timer1[3]);
                            this.reDebug('RuleEngine::ruleEngineEvalAll(ddx): h = ' + h + ', m = ' + m + ', s = ' + s);
                            this.reDebug('RuleEngine::ruleEngineEvalAll(ddx): sensorValue = ' + sensorValue);

                            // add to 'sensorValue' (which is 'lastupdated' for this sensor)
                            sensorValue.setHours(sensorValue.getHours() + h);
                            sensorValue.setMinutes(sensorValue.getMinutes() + m);
                            sensorValue.setSeconds(sensorValue.getSeconds() + s);
                            this.reDebug('RuleEngine::ruleEngineEvalAll(ddx): sensorValue = ' + sensorValue);

                            if (sensorValue.getHours() == now.getHours() &&
                                sensorValue.getMinutes() == now.getMinutes() &&
                                sensorValue.getSeconds() == now.getSeconds()) {
                                this.debug('RuleEngine::ruleEngineEvalAll(ddx): equal; ruleId = "' + ruleId + '"');
                            } else {
                                this.reDebug('RuleEngine::ruleEngineEvalAll(ddx): not equal');
                                match = false;
                            }
                        } else {
                            throw 'RuleEngine::ruleEngineEvalAll(ddx): not "timer1"';
                        }
                        break;

                    case 'in':          // on change
                        /*
                        ** Current time is in given time interval
                        */
                        this.debug('RuleEngine::ruleEngineEvalAll(in): ');
                        break;

                    case 'not in':      // on change
                        /*
                        ** Current time is not in given time interval
                        */
                        this.debug('RuleEngine::ruleEngineEvalAll(not in): ');
                        break;

                    case 'stable':      // on change
                        /*
                        ** Time (timestamps) int and bool values.  
                        ** An attribute has or has not changed for a given time.  Does not trigger a rule change. 
                        */
                        this.debug('RuleEngine::ruleEngineEvalAll(stable): ');
                        break;

                    case 'not stable':  // on change
                        /*
                        ** Time (timestamps) int and bool values.  
                        ** An attribute has or has not changed for a given time.  Does not trigger a rule change. 
                        */
                        this.debug('RuleEngine:ruleEngineEvalAll(not stable): ');
                        break;
                }
            }

            if (match) {
                rules[ruleId].timestriggered++;
                rules[ruleId].lasttriggered = this.dsDateString();

                this.debug('RuleEngine::ruleEngineEvalAll(): match = true');
                //
                // fire all actions
                //
                for (let actionId in rules[ruleId].actions) {
                    this._ruleEngineFire(rules[ruleId].owner, rules[ruleId].actions[actionId]);
                }
            } else {
                this.reDebug('RuleEngine::ruleEngineEvalAll(): match = false');
                this.reDebug('');
            }
        }
    }

    /**
     * Fire an action.
     *
     * @param owner  The owner.
     * @param action Action to fire.
     * @private
     */
    _ruleEngineFire(owner, action) {
        this.debug('RuleEngine::_ruleEngineFire(): BEGIN');
        this.debug('RuleEngine::_ruleEngineFire(): owner  = ' + owner);
        this.debug('RuleEngine::_ruleEngineFire(): action = ' + JSON.stringify(action));

        var response = this.getNewHttpResponse();
        var method = action.method.toLowerCase();
        var url = '/api/' + owner + action.address;
        var urlParts = url.split('/');
        var obj = action.body;

        this.debug('RuleEngine::_ruleEngineFire(): url = ' + url);

        this.dispatch(response, method, url, urlParts, obj);

        this.debug('RuleEngine::_ruleEngineFire(): END');
    }

    /**
     * Initialize schedule engine.
     *
     * @see https://github.com/node-schedule/node-schedule
     */
    scheduleEngine() {
        // load schedules
        for (let id in this.dsSchedules.list) {
            const o = this.dsSchedules.list[id];
            const t = this.schedulesParseTime(o.localtime);

            this.debug('RuleEngine::scheduleEngine(): id = "' + id + '"');
            this.debug('RuleEngine::scheduleEngine(): o  = ' + JSON.stringify(o));

            this._scheduleEngineAdd(id, o, t);
        }

        this.debug('RuleEngine::scheduleEngine(): scheduleEngineList = ' + JSON.stringify(this.scheduleEngineList));

        this.on(
            'schedule-created',
            (id, o, t) => {
                this.debug('RuleEngine::scheduleEngine(schedule-created): id = ' + id);
                this.debug('RuleEngine::scheduleEngine(schedule-created): t  = ' + JSON.stringify(t));
                this._scheduleEngineAdd(id, o, t);
            }
        );
        this.on(
            'schedule-modified',
            (id, o, t) => {
                this.debug('RuleEngine::scheduleEngine(schedule-modified): id = ' + id);
                this.debug('RuleEngine::scheduleEngine(schedule-modified): t  = ' + JSON.stringify(t));
                this._scheduleEngineAdd(id, o, t);
            }
        );
        this.on(
            'schedule-deleted',
            (id) => this.debug('RuleEngine::scheduleEngine(schedule-deleted): id = ' + id)
        );
    }

    /**
     * Add an element to schedule engine
     *
     * @param {string} id Schedule ID.
     * @param {*}      o
     * @param {*}      t
     * @return {boolean}
     * @private
     */
    _scheduleEngineAdd(id, o, t) {
        this._scheduleEngineDel(id);

        if (false === t) {
            this.debug('RuleEngine::_scheduleEngineAdd(): invalid time');
            return false;
        }

        let rule;
        const dayOfWeek = [];

        switch (t.type) {
            case 'recur':
                this.debug('RuleEngine::_scheduleEngineAdd(recur)');
                this.debug('RuleEngine::_scheduleEngineAdd(recur): id = ' + id + ', o = ' + JSON.stringify(o));

                rule = new schedule.RecurrenceRule();
                if (t.sunday) dayOfWeek.push(0);
                if (t.monday) dayOfWeek.push(1);
                if (t.tuesday) dayOfWeek.push(2);
                if (t.wednesday) dayOfWeek.push(3);
                if (t.thursday) dayOfWeek.push(4);
                if (t.friday) dayOfWeek.push(5);
                if (t.saturday) dayOfWeek.push(6);

                rule.dayOfWeek = dayOfWeek;
                rule.hour = t.h;
                rule.minute = t.m;
                rule.second = t.s;

                this.scheduleEngineList[id] = schedule.scheduleJob(rule, () => {
                    this.debug('RuleEngine::_scheduleEngineAdd(recur): run timer');
                    this.debug('RuleEngine::_scheduleEngineAdd(recur): run timer, id = ' + id + ', o = ' + JSON.stringify(o));

                    this._scheduleEngineFire(o);
                });
                break;

            case 'recurRand':
                this.debug('RuleEngine::_scheduleEngineAdd(recurRand)');
                this.debug('RuleEngine::_scheduleEngineAdd(recurRand): id = ' + id + ', o = ' + JSON.stringify(o));

                rule = new schedule.RecurrenceRule();
                if (t.sunday) dayOfWeek.push(0);
                if (t.monday) dayOfWeek.push(1);
                if (t.tuesday) dayOfWeek.push(2);
                if (t.wednesday) dayOfWeek.push(3);
                if (t.thursday) dayOfWeek.push(4);
                if (t.friday) dayOfWeek.push(5);
                if (t.saturday) dayOfWeek.push(6);

                rule.dayOfWeek = dayOfWeek;

                var rand = (t.a_h * 3600) + (t.a_m * 60) + t.a_s;
                var time = (t.h * 3600) + (t.m * 60) + t.s;

                rand = Math.floor(Math.random() * rand);
                time = time + rand;

                var hours = Math.floor(time / 3600);
                time = time - (hours * 3600);
                var minutes = Math.floor(time / 60);
                var seconds = time - (minutes * 60);

                rule.hour = hours;
                rule.minute = minutes;
                rule.second = seconds;

                this.debug('RuleEngine::_scheduleEngineAdd(recurRand): rule = ' + JSON.stringify(rule));

                this.scheduleEngineList[id] = schedule.scheduleJob(rule, () => {
                    this.debug('RuleEngine::_scheduleEngineAdd(recurRand): run timer');
                    this.debug('RuleEngine::_scheduleEngineAdd(recurRand): run timer, id = ' + id + ', o = ' + JSON.stringify(o));

                    this._scheduleEngineFire(o);
                });
                break;

            case 't1':
                this.debug('RuleEngine::_scheduleEngineAdd(t1)');
                this.debug('RuleEngine::_scheduleEngineAdd(t1): id = ' + id + ', o = ' + JSON.stringify(o));

                var startTime = new Date(Date.now());
                var runTime = new Date(startTime.getTime() + ((t.h * 3600) + (t.m * 60) + t.s) * 1000);

                this.scheduleEngineList[id] = schedule.scheduleJob(runTime, () => {
                    this.debug('RuleEngine::_scheduleEngineAdd(t1): run timer');
                    this.debug('RuleEngine::_scheduleEngineAdd(t1): run timer, id = ' + id + ', o = ' + JSON.stringify(o));

                    this._scheduleEngineFire(o);
                });
                break;

            default:
                throw 'RuleEngine::_scheduleEngineAdd(): unhandled type; ' + t.type;
        }

        return true;
    }

    /**
     * Delete element from schedule engine.
     *
     * @param {string} id Schedule ID.
     * @private
     */
    _scheduleEngineDel(id) {
        if (Object.prototype.hasOwnProperty.call(this.scheduleEngineList, id)) {
            this.debug('RuleEngine::_scheduleEngineDel(): existing job found; deleting it');

            this.scheduleEngineList[id].cancel();
            delete this.scheduleEngineList[id];
        }
    }

    /**
     * Fire a scheduled event.
     *
     * @param {*} o Object to fire.
     * @private
     */
    _scheduleEngineFire(o) {
        const response = this.getNewHttpResponse();
        const method = o.command.method.toLowerCase();
        const url = o.command.address;
        const urlParts = url.split('/');
        const obj = o.command.body;

        this.dispatch(response, method, url, urlParts, obj);
    }

    /**
     * Initialize sensor engine.
     */
    sensorEngine() {
        this._sensorEngineSuncalc(1);

        //
        // go thru all sensors and all states for each sensor
        //
        for (let id in this.dsSensors.list) {
            const o = this.dsSensors.list[id];

            this.debug('RuleEngine::sensorEngine(): id = "' + id + '"');
            this.debug('RuleEngine::sensorEngine(): o  = ' + JSON.stringify(o));

            for (var key in o.state) {
                if (Object.prototype.hasOwnProperty.call(o.state, key)) {
                    this.debug('  RuleEngine::sensorEngine(): key = "' + key + '", value = "' + o.state[key] + '"');
                }
            }
        }

        this.on(
            'sensor-modified',
            (id, o) => {
                this.debug('RuleEngine::sensorEngine(sensor-state-modified): id = ' + id);

                if (id == '1') {
                    this.debug('RuleEngine::sensorEngine(sensor-state-modified): daylight');

                    if ('none' !== o.config.long && 'none' !== o.config.lat) {
                        this.debug('RuleEngine::sensorEngine(sensor-state-modified): daylight; long/lat set');
                        o.config.configured = true;
                        this.dsUpdateSensor(id, o);

                        this._sensorEngineSuncalc(id);
                    }
                }
            }
        );

        this.on(
            'sensor-state-modified',
            (id, o) => {
                this.debug('RuleEngine::sensorEngine(sensor-state-modified): id = ' + id);

                this._ruleEngineEvalAll();
            }
        );

        this.on(
            'sensor-config-modified',
            (id, o) => {
                this.debug('RuleEngine::sensorEngine(sensor-config-modified): id = ' + id);
            }
        );
    }

    /**
     * Calculate sunrise/-set.
     *
     * @see https://github.com/mourner/suncalc
     *
     * @param {string} id Sensor ID.
     * @return {boolean} TRUE if daylight sensor was initialized.
     * @private
     */
    _sensorEngineSuncalc(id) {
        var o = this.dsGetSensor(id);

        if (false === o) {
            this.warn('RuleEngine::_sensorEngineSuncalc(): no valid daylight sensor found: id = ' + id);
            return false;
        }

        if (true === o.config.configured) {
            const lat = parseFloat(o.config.lat);
            const lon = parseFloat(o.config.long);
            this.debug('RuleEngine::_sensorEngineSuncalc(): lat = ' + lat + ', long = ' + lon);

            const now = new Date();

            // Get sunrise/sunset times for today.
            let times = suncalc.getTimes(now, lat, lon);    // UTC, not localtime!
            this.debug('RuleEngine::_sensorEngineSuncalc(): times = ' + JSON.stringify(times));

            let sunrise = new Date(times.sunrise);
            let sunset = new Date(times.sunset);

            // Adjust with the offsets.
            sunrise.setMinutes(sunrise.getMinutes() - o.config.sunriseoffset);
            sunset.setMinutes(sunset.getMinutes() + o.config.sunsetoffset);

            this.debug('RuleEngine::_sensorEngineSuncalc(): sunrise (adjusted, local time) = ' + sunrise);
            this.debug('RuleEngine::_sensorEngineSuncalc(): sunset (adjusted, local time) = ' + sunset);

            if (now < sunrise) {
                // Sunrise has not yet taken place so next event must be sunrise.
                this.debug('RuleEngine::_sensorEngineSuncalc(now < sunrise): sunrise has not yet taken place');
                //sunrise.setSeconds(sunrise.getSeconds() - 1);
                this._sensorEngineSetDaylightJob(id, sunrise, true);

                o.state.daylight = false;
                this.dsUpdateSensorState(id, o.state);
            } else if (now > sunset) {
                // We have passed sunset so next event must be sunrise tomorrow.
                this.debug('RuleEngine::_sensorEngineSuncalc(now > sunset): we have passed sunset');

                now.setDate(now.getDate() + 1);                 // next day

                times = suncalc.getTimes(now, lat, lon);       // UTC, not localtime!
                this.debug('RuleEngine::_sensorEngineSuncalc(now > sunset): times = ' + JSON.stringify(times));

                sunrise = new Date(times.sunrise);

                // adjust with the offset
                sunrise.setMinutes(sunrise.getMinutes() - o.config.sunriseoffset);

                this.debug('RuleEngine::_sensorEngineSuncalc(now > sunset): sunrise (adjusted, local time) = ' + sunrise);
                //sunrise.setSeconds(sunrise.getSeconds() - 1);
                this._sensorEngineSetDaylightJob(id, sunrise, true);

                o.state.daylight = false;
                this.dsUpdateSensorState(id, o.state);
            } else {
                // sunrise has already taken place so next event must be sunset
                this.debug('RuleEngine::_sensorEngineSuncalc(): sunrise has already taken place so next event must be sunset');
                //sunset.setSeconds(sunset.getSeconds() - 1);
                this._sensorEngineSetDaylightJob(id, sunset, false);

                o.state.daylight = true;
                this.dsUpdateSensorState(id, o.state);
            }

            return true;
        } else {
            this.debug('RuleEngine::_sensorEngineSuncalc(): daylight sensor not configured');
        }

        return false;   // not confgured
    }

    /**
     * Schedule daylight sensor update job.
     *
     * @param {string} id    Sensor ID.
     * @param {Date}   time  Time to schedule daylight job.
     * @param {*}      state Daylight state.
     * @private
     */
    _sensorEngineSetDaylightJob(id, time, state) {
        if (null !== this.sensorDaylightJob) {
            this.sensorDaylightJob.cancel();
        }

        this.sensorDaylightJob = schedule.scheduleJob(time, () => {       // runs at localtime
            this.debug('RuleEngine::_sensorEngineSetDaylightJob(): id = ' + id);

            const o = this.dsGetSensor(id);
            o.state.daylight = state;
            this.dsUpdateSensor(id, o);

            process.nextTick(() => {
                this.emit('sensor-state-modified', id, o, '/sensors/' + id + '/state/daylight', o.state.daylight);
            });

            // prepare for next event
            this.sensorDaylightJob = null;
            this._sensorEngineSuncalc(id);
        });
    }

    /**
     * Debugging function.
     *
     * @param {string} data Debug message.
     * @private
     */
    reDebug(data) {
        if (this.reDebugEnabled) {
            this.debug(data);
        }
    }
}

module.exports = RuleEngine;
