const functions = require('firebase-functions');
const { getLocation, admin, distance } = require('./krook');
const pois = require('./pois');

const processedUsersRef = admin.database().ref('/sensors-processed');
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
    await pickGoal();
  }
  console.log('distance', distance(sensor, goal), sensor, goal);
  if (distance(sensor, goal.location) <= goal.radius) {
    goalRef.set({
      ...goal,
      reached: new Date().toISOString(),
    })
    await pickGoal();
  }
  if (goal.reached) {
    /// lol
  }
};

exports.processSensor = functions.database.ref('/sensors/{id}')
  .onUpdate(async(snapshot, context) => {
    // Grab the current value of what was written to the Realtime Database.
    const sensor = snapshot.after.val();
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
      lastUpdate: new Date().toISOString(),
    }
    await updateGoals(processedData);
    // You must return a Promise when performing asynchronous tasks inside a Functions such as
    // writing to the Firebase Realtime Database.
    // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
    return processedUsersRef.child(context.params.id).set(processedData);

  });