window.setInterval(() => { window.location.reload(); }, 3600000);

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
const debugSensorRef = db.ref('/sensors/debug');
const linkLengthSquared = (source, target) => {
  const dx = target[0] - source[0];
  const dy = target[1] - source[1];
  return dx * dx + dy * dy;
};

const xValue = x => 1920 - x;
const yValue = y => y/300*250+25;
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
        .attr("x1", d => xValue(d.source[0]))
        .attr("y1", d => yValue(d.source[1]))
        .attr("x2", d => xValue(d.target[0]))
        .attr("y2", d => yValue(d.target[1]));
    
    // draw beacons
    svg.append("g")
      .attr("class", "sites")
      .selectAll("circle")
      .data(beacons)
      .enter()
        .append("circle")
        .attr("r", 5)
        .attr("cx", d => xValue(d.x))
        .attr("cy", d => yValue(d.y))
        // useful debugging tool: log beacon object to console on click
        .on('click', d => console.log(d) )
    
      // prepare a layer for the sensors, but don't do anything with it just yet
      svg.append('g').attr('class', 'sensors');
      svg.append('g').attr('class', 'goals');
      svg.on('click', function onSvgClick() {
        const sensors = beaconsByLevel[level];
        const [x, y] = d3.mouse(this);
        const closestSensors = sensors
          .sort((a, b) => (a.x - xValue(x)) ** 2 + (a.y - yValue(y)) ** 2 - (b.x - xValue(x)) ** 2 - (b.y - yValue(y)) ** 2)
          .slice(0, 3);
        const debugSensorObject = {};
        closestSensors.forEach(s => {
          debugSensorObject[s.id.toString(16)] = { RSSI: -10 };
        });
        console.log('click', d3.mouse(this), debugSensorObject);
        debugSensorRef.set(debugSensorObject);
      });
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
      .attr("x", d => xValue(d.x))
      .attr("y", d => yValue(d.y))

    updatedSensorGraphics.enter()
      .append('image')
      .attr("xlink:href", "ufo.svg?v=2")
      .attr('class', 'sensor')
      .attr("x", d => xValue(d.x))
      .attr("y", d => yValue(d.y))
      .attr('width', 0)
      .attr('height', 0)
      .transition()
      .attr("x", d => xValue(d.x - ufoSize / 2))
      .attr("y", d => yValue(d.y - ufoSize / 2))
      .attr('width', ufoSize)
      .attr('height', ufoSize)
      .attr('transform', d => 'rotate('+ Math.floor((Math.random() * 60) -30) +', ' +  xValue(d.x) + ', ' + yValue(d.y)+ ')');

    updatedSensorGraphics.exit()
      .attr("x", d => xValue(d.x - ufoSize / 2))
      .attr("y", d => yValue(d.y - ufoSize / 2))
      .transition()
      .attr('width', 0)
      .attr('height', 0)
      .attr("x", d => xValue(d.x))
      .attr("y", d => yValue(d.y))
      .remove()
  });
};

const drawGoal = goal => {
  console.log(goal);
  levels.forEach(level => {
    const svg = svgForLevel(level);
    const goals = level === goal.location.level ? [goal] : [];
    const goalCircles = svg.select('.goals');
    const updatedGoalCircles = goalCircles
      .selectAll('circle.goal')
      .data(goals);

    updatedGoalCircles.transition()
      .attr('cx', g => xValue(g.location.x))
      .attr('cy', g => yValue(g.location.y))
      .attr('r', g => g.radius)

    updatedGoalCircles.enter()
      .append('circle')
      .attr('class', 'goal')
      .attr('cx', g => xValue(g.location.x))
      .attr('cy', g => yValue(g.location.y))
      .attr('r', g => g.radius)

    updatedGoalCircles.exit()
        .remove()
  });
};

d3.json('locations-parsed.json', data => {
  const flippedX = data.map(beacon => ({
    ...beacon,
    x: beacon.x,
  }))
  beaconsByLevel = groupByLevel(flippedX);
  flippedX.forEach(beacon => {
    beaconById[beacon.id] = beacon;
  });
  drawLevels(beaconsByLevel);
});

db.ref('/sensors-processed').on('value', snapshot => {
  const rawData = snapshot.val();
  const sensors = []
  Object.keys(rawData).forEach(sensorId => {
    const sensor = rawData[sensorId];
    sensors.push(sensor);
  });
  drawSensors(sensors);
});

db.ref('/goal').on('value', snapshot => {
  const goal = snapshot.val();
  const element=document.querySelector('#alienSays');
  element.innerHTML = goal.objectiveText;
  drawGoal(goal);
  if (goal) {
    element.classList.remove("empty");
  }
  else {
    element.classList.add("empty");
  }
});

let firstLoad = true;
db.ref('/version').on('value', snapshot => {
  if (firstLoad) {
    firstLoad = false;
  } else {
    window.location.reload();
  }
});