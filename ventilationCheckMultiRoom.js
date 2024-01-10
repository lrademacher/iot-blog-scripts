//  Program Ventilation Check
/*
*   @author Moritz Heusinger <moritz.heusinger@gmail.com>
*   The program checks the absolute humidity of an inside room and outside.
*   If the difference is above a specified threshold, a ventilation recommendation
*   is set as state. The absolute humidity values are set as state too.
*   The script also contains a datapoint, which triggers speech output of the
*   last used Amazon Alexa device.
*
*   Require: Instance of Alexa2 Adapter
*
*   Create your rooms in the rooms array with a name and the states which contain the desired values.
*   Humidity Threshold is used to only give a ventilate calculation if outside absolute humidity - the
*   threshold is less than inside absolute humidity. Min Humidity is used to make sure that you only get a
*   ventilation recommendation, if the relative inside humidity is above the min value.
*   You can additionally define a namespace, which will be appended to the states, e.g. '0_Userdata.0.Lueftungsempfehlung'
*/

const logging = true;
const namespace = ``;

const rooms = [
    {
        roomName: `office`,
        outsideHumidityState: `accuweather.0.Current.RelativeHumidity`,
        outsideTemperatureState: `accuweather.0.Current.Temperature`,
        insideHumidityState: `zigbee.0.00124b002269c07b.humidity`,
        insideTemperatureState: `zigbee.0.00124b002269c07b.temperature`,
        humidityThreshold: 2, /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
        minHumidity: 45 /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
    },
    {
        roomName: `bathroom`,
        outsideHumidityState: `accuweather.0.Current.RelativeHumidity`,
        outsideTemperatureState: `accuweather.0.Current.Temperature`,
        insideHumidityState: `zigbee.0.a4c138f84b402c2a.humidity`,
        insideTemperatureState: `zigbee.0.a4c138f84b402c2a.temperature`,
        humidityThreshold: 2, /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
        minHumidity: 45 /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
    },
    {
        roomName: `living_room`,
        outsideHumidityState: `accuweather.0.Current.RelativeHumidity`,
        outsideTemperatureState: `accuweather.0.Current.Temperature`,
        insideHumidityState: `zigbee.0.a4c138c8a3254d2f.humidity`,
        insideTemperatureState: `zigbee.0.a4c138c8a3254d2f.temperature`,
        humidityThreshold: 2, /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
        minHumidity: 45 /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
    },
    {
        roomName: `cellar`,
        outsideHumidityState: `accuweather.0.Current.RelativeHumidity`,
        outsideTemperatureState: `accuweather.0.Current.Temperature`,
        insideHumidityState: `zigbee.0.00124b00226a138f.humidity`,
        insideTemperatureState: `zigbee.0.00124b00226a138f.temperature`,
        humidityThreshold: 2, /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
        minHumidity: 45 /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
    },
    {
        roomName: `bedroom`,
        outsideHumidityState: `accuweather.0.Current.RelativeHumidity`,
        outsideTemperatureState: `accuweather.0.Current.Temperature`,
        insideHumidityState: `zigbee.0.a4c138d6afc5ce8f.humidity`,
        insideTemperatureState: `zigbee.0.a4c138d6afc5ce8f.temperature`,
        humidityThreshold: 2, /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
        minHumidity: 45 /* YOU ARE ALLOWED TO CHANGE IF YOU WANT */
    }
];

const triggersInsideHumidity = [];

try {
    // create counter outside of rooms
    await createStateAsync(namespace ? `${namespace}.totalVentilationRecommendations` : `totalVentilationRecommendations`, {
        type: `number`,
        read: true,
        write: false,
        name: `Anzahl Lüftungsempfehlungen`
    });
} catch (e) {
    log(`Could not create trigger dp for ventilation recommendations: ${e}`, `error`);
}

for (const room of rooms) {
    try {
        await createStateAsync(`${namespace ? `${namespace}.` : ''}${room.roomName}.absoluteHumidity`, {
            type: `number`,
            read: true,
            write: false,
            unit: `g/m^3`,
            name: `${room.roomName} Absolute Feuchtigkeit`
        });

        await createStateAsync(`${namespace ? `${namespace}.` : ''}${room.roomName}.outsideAbsoluteHumidity`, {
            type: `number`,
            read: true,
            write: false,
            unit: `g/m^3`,
            name: `${room.roomName} Absolute Feuchtigkeit Außen`
        });

        await createStateAsync(`${namespace ? `${namespace}.` : ''}${room.roomName}.ventilationRecommendation`, {
            type: `boolean`,
            read: true,
            write: false,
            name: `${room.roomName} Lüftungsempfehlung`
        });
        
        triggersInsideHumidity.push(room.insideHumidityState);
        triggersInsideHumidity.push(room.insideTemperatureState);
        triggersInsideHumidity.push(room.outsideHumidityState);
        triggersInsideHumidity.push(room.outsideTemperatureState);
    } catch (e) {
        log(`Could not create states for room ${room.roomName}: ${e}`, `error`);
    }
} // endFor

on({id: triggersInsideHumidity, change: `any`}, obj => {
    const room = rooms[triggersInsideHumidity.indexOf(obj.id)];
    // Get inside and outside humidity and temperature
    const relHumidityOutdside = getState(room.outsideHumidityState).val;
    const temperatureOutside = getState(room.outsideTemperatureState).val;
    const relHumidityInside = getState(room.insideHumidityState).val;
    const temperatureInside = getState(room.insideTemperatureState).val;
    // Calc ventilation recommendation and absolute humidity inside and outside
    const jsonRes = ventilateRoom(relHumidityInside, temperatureInside, relHumidityOutdside,
        temperatureOutside, room.humidityThreshold, room.minHumidity);
    // Set states
    setState(`${namespace ? `${namespace}.` : ''}${room.roomName}.absoluteHumidity`, jsonRes.insideAbsoluteHumidity, true);
    setState(`${namespace ? `${namespace}.` : ''}${room.roomName}.outsideAbsoluteHumidity`, jsonRes.outsideAbsoluteHumidity, true);
    setState(`${namespace ? `${namespace}.` : ''}${room.roomName}.ventilationRecommendation`, jsonRes.ventilate, true);

    // now update our counter by checking all rooms recommendation
    let counter = 0;
    for (const room of rooms) {
        const val = getState(`${namespace ? `${namespace}.` : ''}${room.roomName}.ventilationRecommendation`).val;
        counter = counter + +val;
    }
    setState(namespace ? `${namespace}.totalVentilationRecommendations` : `totalVentilationRecommendations`, counter, true);
});

/* Internals */

function calcAbsoluteHumidity(relHumidity, temperature) {
    const res = ((6.112 * Math.pow(Math.E, ((17.67 * temperature) / (temperature + 243.5))) * relHumidity * 2.1674)) / (273.15 + temperature);
    return Math.round(res * 100) / 100;
} // endCalcAbsoluteHumidity

function ventilateRoom(relHumidityInside, tempInside, relHumidityOutside, tempOutside,
                       threshold = 2.0, minHumidity = 50.0) {
    const res = {};
    res.insideAbsoluteHumidity = calcAbsoluteHumidity(relHumidityInside, tempInside);
    res.outsideAbsoluteHumidity = calcAbsoluteHumidity(relHumidityOutside, tempOutside);
    res.diff = Math.round((res.insideAbsoluteHumidity - res.outsideAbsoluteHumidity) * 100) / 100;

    res.ventilate = res.diff > threshold && relHumidityInside > minHumidity;
    return res;
} // endVentilateRoom
