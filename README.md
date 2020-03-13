# node-red-contrib-huebridge

A Philips Hue Bridge *emulator* to control any kind of lights (or other things for that matter).

> This is a work in progress!

## Installation
To install - change to your Node-RED user directory.

        cd ~/.node-red
        npm install node-red-contrib-huebridge

## Nodes in this package

### On/Off Light

Supports switching light on and off.

### Dimmable Light

Supports switching on/off and adjusting brightness.

### Color Light

Supports RGB color with colormodes `hs` (Hue, Saturation) and `xy` (CIE 1931 Chromacity).

### Color Temperature Light

Support color temperature setting with colormode `ct`.

### Extended Color Light

Support both RGB and color temperature setting with colormodes `hs` (Hue, Saturation), `xy` (CIE 1931 Chromacity) and 
`ct` (color temperature).

### Link Button
Enables pairing.

`topic` and `payload` can be arbitrary values (i.e. the node does not use it).

### Manage

Management node allows bridge configuration handling.

Supported `topic` values:
* `clearconfig` - Clear the bridge configuration if `payload` is `true`
* `getconfig` - Get complete configuration (backup)
* `setconfig` - Update the configuration with `payload` value (restore)
* `getlightids` - Get information about all lights

### Sensors

##### ZGP Switch (Hue Tap)
Emulate a Hue Tap with it's four buttons.

`topic` can be anything (i.e. the node does not use it).
`payload` must be a number.
Valid payload numbers: `1, 2, 3, 4`.

##### ZLL Temperature
Emulate a ZLL temperature sensor.

`topic` can be anything (i.e. the node does not use it).
`payload` must be a number representing the current value in degrees celsius (e.g. `17.50`, `21.25`).

##### ZLL Switch (Hue Wireless Dimmer Switch)
Not implemented.

##### ZLL Presence (Hue Motion Sensor)
Not implemented.

##### ZLL Lightlevel
Not implemented.

##### CLIP Switch
Not implemented as a node.

##### CLIP OpenClose
Not implemented as a node.

##### CLIP Presence
Not implemented as a node.

##### CLIP Temperature
Not implemented as a node.

##### CLIP Humidity
Not implemented as a node.

##### CLIP Lightlevel
Not implemented as a node.

##### CLIP Generic Flag Sensor
Not implemented as a node.

## Notes

1. For interoperabilits with most devices the bridge must be exposed on port 80.
   Either bind it directly to that port or adjust _external_ address and port values for reverse proxy setups.

2. The timezone can be set using the Hue App but these nodes will always use the timezone setup on the server running Node-RED.

3. HomeKit interface is not implemented.

4. None of the remote access features will work.

5. The transfom node will handle transitions but it might not work very well. It does a transition calculation once every 100ms and that might simply be too much depending on your setup.

## Examples

1. Red at 100% brightness (using hue, saturation - colormode 'hs')

```
topic = setstate
payload (JSON) = {"transitiontime":4,"on":true,"bri":254,"colormode":"hs","hue":0,"sat":254}
```

2. Green at 100% brightness (using hue, saturation - colormode 'hs')

```
topic = setstate
payload (JSON) = {"transitiontime":4,"on":true,"bri":254,"colormode":"hs","hue":21845,"sat":254}
```

3. Blue at 100% brightness (using hue, saturation - colormode 'hs')

```
topic = setstate
payload (JSON) = {"transitiontime":4,"on":true,"bri":254,"colormode":"hs","hue":43690,"sat":254}
```

4. White at 100% brightness (using hue, saturation - colormode 'hs')

```
topic = setstate
payload (JSON) = {"transitiontime":4,"on":true,"bri":254,"colormode":"hs","hue":0,"sat":0}
```

5. Off

```
topic = setstate
payload (JSON) = {"on":false,"bri":0}
```

6. On at 100% brightness

```
topic = setstate
payload (JSON) = {"on":true,"bri":254}
```

## Copyright and License

Copyright

2020 Stefan Kalscheuer

2018-2019 Michael Jacobsen

Licensed under [GNU General Public License version 3](LICENSE).
