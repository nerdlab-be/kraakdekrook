const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const { getLocation, admin, distance } = require('./krook');
const pois = require('./pois');

const processedSensorsRef = admin.database().ref('/sensors-processed');
const goalRef = admin.database().ref('/goal');
const availableGoalsRef = admin.database().ref('/availableGoals');

const getGoal = async() => {
  const snap = await goalRef.once('value');
  return snap.val();
};

const getAvailableGoals = async () => {
  const snap = await availableGoalsRef.once('value')
  return snap.val();
};

const pickGoal = async () => {
  const availableGoals = await getAvailableGoals();
  const goalIds = Object.keys(availableGoals);
  const goalId = goalIds[Math.floor(Math.random() * goalIds.length)];
  const goal = {
    ...availableGoals[goalId],
    id: goalId,
  }
  return goalRef.set(goal);
};

const updateGoals = async sensor => {
  const goal = await getGoal();
  if (!goal) {
    return pickGoal();
  }
  if (!goal.reached && distance(sensor, goal.location) <= goal.radius) {
    return goalRef.set({
      ...goal,
      reached: new Date().toISOString(),
    })
  }
  
  if (goal.reached) {
    const millisecondsSinceReached = new Date() - new Date(goal.reached);
    if (millisecondsSinceReached > 10000) {
      return pickGoal();
    }
  }
};

exports.processSensor = functions.database.ref('/sensors/{id}')
  .onUpdate(async(snapshot, context) => {
    // Grab the current value of what was written to the Realtime Database.
    const sensor = snapshot.after.val();
    const sensorId = context.params.id;
    console.log({ sensor, sensorId });
    const beacons = Object.keys(sensor).map(hexId => {
      const beaconData = sensor[hexId];
      return {
        rssi: beaconData.RSSI,
        krookid: parseInt(hexId, 16),
      };
    });
    const sensorLocation = await getLocation(beacons);
    const processedData = {
      id: sensorId,
      name: sensorId,
      ...sensorLocation,
      beacons,
      lastUpdate: new Date().toISOString(),
    }
    await updateGoals(processedData);
    // You must return a Promise when performing asynchronous tasks inside a Functions such as
    // writing to the Firebase Realtime Database.
    // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
    return processedSensorsRef.child(context.params.id).update(processedData);

  });

const app = express();
// Automatically allow cross-origin requests
app.use(cors({ origin: true }));
// build multiple CRUD interfaces:
app.put('/:sensorId', async (req, res) => {
  await processedSensorsRef.child(req.params.sensorId).update({
    lastHeartbeat: new Date().toISOString(),
    batteryVoltage: req.body.battery,
  });
  res.send("5000000");
});

exports.heartbeat = functions.https.onRequest(app);
