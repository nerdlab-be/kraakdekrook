// This code gets the centroid of the three closest beacons to the device, e.g. a sort of fake location

var fs = require('fs');

var data = '[{"beacons":[{"krookid":169,"rssi":-75},{"krookid":171,"rssi":-60},{"krookid":170,"rssi":-74},{"krookid":175,"rssi":-80}],"id":"michiel"}]';
var beacons = JSON.parse(data);

var closest = beacons[0].beacons.sort((a, b) => b.rssi - a.rssi).slice(0, 3)
var content = fs.readFileSync("locations-parsed.json");
var positions = JSON.parse(content);

var c1 = [positions[closest[0].krookid].x, positions[closest[0].krookid].y];
var c2 = [positions[closest[1].krookid].x, positions[closest[1].krookid].y];
var c3 = [positions[closest[2].krookid].x, positions[closest[2].krookid].y];

var getCentroid = function (coord) {
	var center = coord.reduce(function (x,y) {
		return [x[0] + y[0]/coord.length, x[1] + y[1]/coord.length]
	}, [0,0])
	return center;
}

console.log(getCentroid([c1, c2, c3]));
