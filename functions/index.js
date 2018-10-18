const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
let _beacons = null;
const beaconsRef = admin.database().ref('/beacons');
const processedUsersRef = admin.database().ref('/sensors-processed');

const getBeacons = async () => {
  if (_beacons !== null) {
    return _beacons;
  }
  const snap = await beaconsRef.once("value");
  _beacons = snap.val();
  return _beacons;
};

const getCentroid = coords => coords.reduce((acc, c) => ({
  x: acc.x + c.x / coords.length,
  y: acc.y + c.y / coords.length,
}), { x: 0, y: 0 });


const getLocation = async beacons => {
  // majority vote on level: if we get 2 beacons on the 1st floor and 1 on the
  // 2nd floor, assume the sensor is on the 1st floor
  let bestCount = 0;
  let bestLevel = 0;
  let counts = {};
  const beaconById = await getBeacons();
  const filteredBeacons = beacons
    .sort((a, b) => b.rssi - a.rssi)
    .slice(0, 3)
  filteredBeacons.forEach(beacon => {
    let level = beaconById[beacon.krookid].level;
    counts[level] = (counts[level] || 0) + 1;
    if (counts[level] > bestCount) {
      bestCount = counts[level];
      bestLevel = level;
    }
  });
  const coords = getCentroid(filteredBeacons.map(b => beaconById[b.krookid]));
  return {
    x: coords.x,
    y: coords.y,
    level: bestLevel,
    beacons: beacons,
  };

}

exports.updateSensor = functions.https.onRequest(async (req, res) => {
  res.send(JSON.stringify(await beacons()));
});

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