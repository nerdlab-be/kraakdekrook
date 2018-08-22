// Read Synchrously
var fs = require("fs");
var content = fs.readFileSync("locations.json");
var locations = JSON.parse(content);
locations.forEach(function(location) {
   if (location.id <= 15 || location.id == 237) {location.level = -2;}
   else if (location.id <= 58) {location.level = -1;}
   else if (location.id <= 113) {location.level = 0;}
   else if (location.id <= 160) {location.level = 1;}
   else if (location.id <= 204) {location.level = 2;}
   else if (location.id <= 236) {location.level = 3;}
   location.x = (location.x - 106) * 1920/1350;
   location.y = (location.y - 59) * 399/440;
});
var output = JSON.stringify(locations, null, 4);
fs.writeFileSync('locations-parsed.json', output);
