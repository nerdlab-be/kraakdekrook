// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCry7RclR4ZOh4A956n7mqugWUExLAba_0",
  authDomain: "kraakkrook-c581e.firebaseapp.com",
  databaseURL: "https://kraakkrook-c581e.firebaseio.com",
  projectId: "kraakkrook-c581e",
  storageBucket: "kraakkrook-c581e.appspot.com",
  messagingSenderId: "610352027337"
};
const ufoSize = 100;
const levels = [-2, -1, 0, 1, 2, 3];

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
// level -> list of beacons
let beaconsByLevel = {};
const beaconById = {};


const linkLengthSquared = (source, target) => {
  const dx = target[0] - source[0];
  const dy = target[1] - source[1];
  return dx * dx + dy * dy;
};

const svgForLevel = level => d3.select((`#svg_${level}`).replace('-', '_'));

const drawLevels = beaconsByLevel => {
  const voronoi = d3.voronoi();

  levels.forEach(level => {
    const svg = svgForLevel(level);
    const beacons = beaconsByLevel[level] || [];
    // draw links
    const links = voronoi
      .links(beacons.map(b => [b.x, b.y]))
      .filter(l => linkLengthSquared(l.source, l.target) < 200000)

    // draw links between beacons
    svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter()
        .append("line")
        .attr("x1", d => d.source[0])
        .attr("y1", d => d.source[1])
        .attr("x2", d => d.target[0])
        .attr("y2", d => d.target[1]);
    
    // draw beacons
    svg.append("g")
      .attr("class", "sites")
      .selectAll("circle")
      .data(beacons)
      .enter()
        .append("circle")
        .attr("r", 5)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        // useful debugging tool: log beacon object to console on click
        .on('click', d => console.log(d) )
    
      // prepare a layer for the sensors, but don't do anything with it just yet
      svg.append('g').attr('class', 'sensors');
  });
};

/**
 * Groups a list of objects with a 'level' key by level
 * @param {[Object]} List of objects with a 'level' key 
 */
const groupByLevel = objects => {
  const objectsByLevel = {};
  objects.forEach(obj => {
    if (objectsByLevel[obj.level] === undefined) {
      objectsByLevel[obj.level] = [];
    }
    objectsByLevel[obj.level].push(obj);
  })
  return objectsByLevel;
}

const drawSensors = allSensors => {
  const sensorsByLevel = groupByLevel(allSensors);
  levels.forEach(level => {
    const sensors = sensorsByLevel[level] || [];
    const svg = svgForLevel(level);
    const sensorGraphics = svg.select('.sensors');
    const updatedSensorGraphics = sensorGraphics
      .selectAll('image.sensor')
      .data(sensors, s => s.id)
      
    updatedSensorGraphics.transition()
      .attr("x", d => d.x)
      .attr("y", d => d.y)

    updatedSensorGraphics.enter()
      .append('image')
      .attr("xlink:href", "ufo.svg?yellow")
      .attr('class', 'sensor')
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .attr('width', 0)
      .attr('height', 0)
      // .style('fill', '#f00')
      // .attr('r', 0)
      .transition()
      .attr("x", d => d.x - ufoSize / 2)
      .attr("y", d => d.y - ufoSize / 2)
      .attr('width', ufoSize)
      .attr('height', ufoSize)
    
    updatedSensorGraphics.exit()
      .attr("x", d => {console.log(d); return d.x - ufoSize / 2})
      .attr("y", d => d.y - ufoSize / 2)
      .transition()
      .attr('width', 0)
      .attr('height', 0)
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .remove()
  })
};

d3.json('locations-parsed.json', data => {
  beaconsByLevel = groupByLevel(data);
  data.forEach(beacon => {
    beaconById[beacon.id] = beacon;
  });
  drawLevels(beaconsByLevel);
  // drawSensors(sensors);
  // setInterval(
  //   () => {
  //     sensors[0].x = Math.random() * 600;
  //     sensors[0].y = Math.random() * 150;
  //     const proposedLevel = sensors[0].level + Math.round(Math.random() * 2 - 1);
  //     sensors[0].level = Math.max(-2, Math.min(3, proposedLevel));
  //     drawSensors(sensors);
  //   },
  //   1000
  // );
});

const getCentroid = coords => coords.reduce((acc, c) => ({
  x: acc.x + c.x / coords.length,
  y: acc.y + c.y / coords.length,
}), { x: 0, y: 0 });


const getLocation = beacons => {
  // majority vote on level: if we get 2 beacons on the 1st floor and 1 on the
  // 2nd floor, assume the sensor is on the 1st floor
  let bestCount = 0;
  let bestLevel = 0;
  let counts = {};
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

db.ref('/').on('value', snapshot => {
  const rawData = snapshot.val();
  console.log(rawData);
  const sensors = []
  Object.keys(rawData).forEach(sensorId => {
    const sensor = rawData[sensorId];
    const beacons = Object.keys(sensor).map(hexId => {
      const beaconData = sensor[hexId];
      return {
        rssi: beaconData.RSSI,
        krookid: parseInt(hexId, 16),
      }
    });
    const sensorLocation = getLocation(beacons);
    const processedData = {
      id: sensorId,
      name: sensorId,
      level: sensorLocation.level,
      x: sensorLocation.x,
      y: sensorLocation.y,
      beacons: beacons,
    }
    sensors.push(processedData);
    console.log('loc', sensorLocation);
  });
  drawSensors(sensors);
});
