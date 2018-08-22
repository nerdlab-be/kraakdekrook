const BeaconScannerKrook = require('de-krook-beacons'); 
const admin = require('firebase-admin');

const serviceAccount = require('./firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const docRef = db.collection('scans').doc('michiel');
// make a new scanner
const scanner = new BeaconScannerKrook();

// create a listener, the scanner returns a list of found beacons with their RSSI. 
scanner.foundBeacons = async beacons => {
  // get the three beacons with the best signal strength
  const filteredBeacons = beacons.sort((a, b) => b.rssi - a.rssi).slice(0, 3)
  // put them in Firebase
  try {
    await docRef.set({
      id: 'michiel',
      beacons: filteredBeacons.map(({ uuid, ...rest }) => rest)
    });
  } catch (e) {
    throw e;
  }
};

//start the scanner. This scans for 3000 milliseconds or 3 seconds, 
//Then it returns a list to the listener, and repeats the process. 
//(Parameter is not required, default scantime is 5000 milliseconds)
// scanner.stopScan();
scanner.startScan(5000);

//stops the scanner.
//make sure you wrap this in an interval or you get a empty list.
//scanner.stopScan();
