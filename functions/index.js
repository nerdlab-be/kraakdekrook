const functions = require('firebase-functions');
const { getLocation, admin } = require('./krook');

const processedUsersRef = admin.database().ref('/sensors-processed');


exports.processSensor = functions.database.ref('/sensors/{id}')
    .onUpdate(async (snapshot, context) => {
      // Grab the current value of what was written to the Realtime Database.
      console.log('onUpdate', snapshot, context)
      const sensor = snapshot.after.val();
      console.log('Processing', context.params.id, sensor);
      const sensorId = context.params.id;
      const beacons = Object.keys(sensor).map(hexId => {
        const beaconData = sensor[hexId];
        return {
          rssi: beaconData.RSSI,
          krookid: parseInt(hexId, 16),
        }
      });
      const sensorLocation = await getLocation(beacons);
      const processedData = {
        id: sensorId,
        name: sensorId,
        ...sensorLocation,
        beacons,
      }
      // You must return a Promise when performing asynchronous tasks inside a Functions such as
      // writing to the Firebase Realtime Database.
      // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
      return processedUsersRef.child(context.params.id).set(processedData);
    });