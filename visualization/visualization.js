// Initialize Firebase
var config = {
  apiKey: "AIzaSyCry7RclR4ZOh4A956n7mqugWUExLAba_0",
  authDomain: "kraakkrook-c581e.firebaseapp.com",
  databaseURL: "https://kraakkrook-c581e.firebaseio.com",
  projectId: "kraakkrook-c581e",
  storageBucket: "kraakkrook-c581e.appspot.com",
  messagingSenderId: "610352027337"
};
firebase.initializeApp(config);
var db = firebase.database();

// maps levels to a list of beacons
const sites = {};
// maps krookids to levels
const siteToLevel = {};
const movedFuncs = {};
// maps sensor id to actual sensor locations
const sensors = {};

var getSensorLocationsForLevel = function getSensorLocationsForLevel(level) {
  return Object.keys(sensors)
    .map(function sensorIdToObject(sensorId) {
      return sensors[sensorId];
    })
    .filter(function filterSensorByLevel(sensor) {
      return sensor.level == level;
    });
}


function init() {
  var voronoi = d3.voronoi();

  setTimeout(function() { window.location.reload(true); }, 120000);

  function redrawSite(site) {
    site
      .attr("cx", function (d) { return d[0]; })
      .attr("cy", function (d) { return d[1]; });
  }

  Object.keys(sites).forEach(function eachSite(level) {
    function moved() {
      redraw();
    }
    movedFuncs[level] = moved;

    function redraw() {
      var diagram = voronoi(sites[level]);
      var sensorLocations = getSensorLocationsForLevel(level)
      var triangleData = sensorLocations.map(l => l.closestSites);
      triangle = triangle.data(triangleData), triangle.exit().remove();
      triangle = triangle.enter().append("path").merge(triangle).call(redrawtriangle);
      link = link.data(diagram.links()), link.exit().remove();
      link = link.enter().append("line").merge(link).call(redrawlink);
      site = site.data(sites[level]).call(redrawSite);
      sensor = sensor.data(sensorLocations, sl => {
        return sl.sensorId
      }).call(redrawSensor);
      sensor.exit().remove();
      sensor = sensor.enter()
        .append("circle")
        .attr("r", 10)
        .call(redrawSensor);
    }

    function redrawtriangle(triangle) {
      triangle
        .attr("class", "primary")
        .attr("d", function (d) { return "M" + d.join("L") + "Z"; });
    }

    function redrawlink(link) {
      link
        // .classed("primary", function (d) { return d.source === sites[level][0] || d.target === sites[level][0]; })
        .attr("x1", function (d) { return d.source[0]; })
        .attr("y1", function (d) { return d.source[1]; })
        .attr("x2", function (d) { return d.target[0]; })
        .attr("y2", function (d) { return d.target[1]; });
    }

    function redrawSensor(sensor) {
      sensor
        .attr("cx", function (d) { return d.coords[0] })
        .attr("cy", function (d) { return d.coords[1]; });
    }

    var svg =
      d3.select(("#svg_" + level).replace('-', '_')),
      width = +svg.attr("width"),
      height = +svg.attr("height");

    var triangle = svg.append("g")
      .attr("class", "triangles")
      .selectAll("path")
      // .data(voronoi.triangles(sites[level]))
      // .enter().append("path")
      // .call(redrawtriangle);

    var link = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(voronoi.links(sites[level]))
      .enter().append("line")
      .call(redrawlink);

    var site = svg.append("g")
      .attr("class", "sites")
      .selectAll("circle")
      .data(sites[level])
      .enter().append("circle")
      .attr("r", 5)
      .call(redrawSite);
    
    var sensor = svg.append("g")
      .attr("class", "sites sensor")
      .selectAll("circle")
      .data(getSensorLocationsForLevel(level), sl => sl.sensorId)
      .enter()
        .append("circle")
        .attr("r", 10)
        .call(redrawSensor);
  });

  var getCentroid = function (coords) {
    var center = coords.reduce(function reduceCoords(x, y) {
      return [x[0] + y[0] / coords.length, x[1] + y[1] / coords.length]
    }, [0, 0])
    return center;
  };

  function getCoord(beacons) {
    // This code gets the centroid of the three closest beacons to the device, e.g. a sort of fake location
    var closest = beacons.sort((a, b) => b.rssi - a.rssi).slice(0, 3)
    var positions = locations;

    var closestNodeCoords = closest.map(c => {
      var position = positions[c.krookid];
      return [position.x, position.y];
    });
    // movedFuncs[level](getCentroid(closestNodeCoords));
    return getCentroid(closestNodeCoords);
  }

  var length = function length(l) {
    var s = l.source;
    var t = l.target;
    return Math.sqrt((s[0] - t[0]) * (s[0] - t[0]) + (s[1] - t[1]) * (s[1] - t[1]));
  };

  var getClosestSites = function getClosestSites(level, coord, n) {
    var allSites = sites[level].map(x => x);
    allSites.sort((a, b) => length({ source: coord, target: a }) - length({ source: coord, target: b }));
    return allSites.slice(0, n);
  };
  /**
   * Maps a list of beacons to a { coords: [x, y], level: x } object
   * @param {beacons} beacons list of beacons in { rssi:x, krookid: x} format
   */
  var getSensorLocation = function getSensorLocation(sensorId, beacons) {
    // majority vote on level: if we get 2 beacons on the 1st floor and 1 on the
    // 2nd floor, assume the sensor is on the 1st floor
    var bestCount = 0;
    var bestLevel = 0;
    var counts = {};
    beacons.forEach(function eachBeacon(beacon) {
      var level = siteToLevel[beacon.krookid];
      counts[level] = (counts[level] || 0) + 1;
      if (counts[level] > bestCount) {
        bestCount = counts[level];
        bestLevel = level;
      }
    });
    var coords = getCoord(beacons);
    return {
      sensorId: sensorId,
      coords: coords,
      level: bestLevel,
      sites: beacons.map(b => b.krookid),
      closestSites: getClosestSites(bestLevel, coords, 3),
    };

  }

  var updateSensors = function updateSensors(sensorId, beacons) {
    var location = getSensorLocation(sensorId, beacons);
    console.log(sensorId, location);
    sensors[sensorId] = location;
    Object.keys(movedFuncs).forEach(function callMovedFunc(level) {
      movedFuncs[level]();
    });
    
  }

  db.ref('/').on('value', function (snapshot) {
    const rawData = snapshot.val();
    console.log(rawData);
    Object.keys(rawData).forEach(sensorId => {
      const sensor = rawData[sensorId];
      const processedData = Object.keys(sensor).map(hexId => {
        const beaconData = sensor[hexId];
        return {
          rssi: beaconData.RSSI,
          krookid: parseInt(hexId, 16),
        }
      });
      updateSensors(sensorId, processedData);
    });
  });
}
var locations;
d3.json('locations-parsed.json', function (data) {
  locations = data;
  for (var i = 0; i < data.length; i++) {
    if (sites[data[i].level] == undefined) {
      sites[data[i].level] = []
    }
    sites[data[i].level].push([data[i].x, data[i].y]);
    siteToLevel[data[i].id] = data[i].level;
  }
  init();
});
