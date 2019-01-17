const admin = require('firebase-admin');
admin.initializeApp();
let _beacons = null;
const beaconsRef = admin.database().ref('/beacons');

const getBeacons = async() => {
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

exports.getLocation = async beacons => {
  // majority vote on level: if we get 2 beacons on the 1st floor and 1 on the
  // 2nd floor, assume the sensor is on the 1st floor
  let bestCount = 0;
  let bestLevel = 0;
  let counts = {};
  const beaconById = await getBeacons();
  const filteredBeacons = beacons
    .sort((a, b) => b.rssi - a.rssi)
    .slice(0, 3)
  console.log({ filteredBeacons, beacons })
  filteredBeacons.forEach(beacon => {
    console.log(beacon);
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

exports.distance = (a, b) => {
  console.log('distance inside', {a, b})
  const euclid = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  console.log(euclid + 10000 * (b.level - a.level) ** 2);
  return euclid + 10000 * (b.level - a.level) ** 2;
}

exports.admin = admin;