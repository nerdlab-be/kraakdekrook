
#include <Esp.h>
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#define ANALOG_BatteryPower 36 //VP

/* Esp settings */
int scanTime = 2; //in seconds 
int sleepTime = 5; // in seconds
/* backend settings */ 
String firebaseLink = "http://krookfirebase.barkr.uk/";
String deviceName = "ufo-1";
String batteryName = "batt-1";
/* Wifi settings */
// Krook WiFi
char ssid[] = "iVisitor";
char password[] = "WelcomeATimec";
/* end settings */


BLEScan* pBLEScan = BLEDevice::getScan(); 
WiFiMulti wifiMulti;
HTTPClient http;
String json; 
int batteryLevel_Digital=0;
float batteryLevel_Analog=0.0;
String batLevel;
float randomValue=0.0;

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      char* pHex = BLEUtils::buildHexData(nullptr, (uint8_t*)advertisedDevice.getManufacturerData().data(), advertisedDevice.getManufacturerData().length());
      String s = String(pHex).substring(8, 40);
      if(s.substring(0, 30).equals("e2c56db5dffb48d2b060d04f435441")){
          String id = s.substring(30, 32);
          String obj = "\"" + id + "\": {\"RSSI\": " + String(advertisedDevice.getRSSI()) + "},";
          json = json + obj;
        Serial.printf("Beacon found with ID : %s and RSSI %d \n", id.c_str(), advertisedDevice.getRSSI());     
      }
    }
};

void setup() {
    // Set serial console
    Serial.begin(115200);
    
    // Set analogRead
    analogReadResolution(11);
    analogSetAttenuation(ADC_6db);
    
    // Set WiFi
    wifiMulti.addAP(ssid, password); 
    BLEDevice::init("");
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
    pBLEScan->setActiveScan(true);

    // Measure and send to Firebase
    scan();
    batteryLevel();
    pushToFirebase();
    
    delay(sleepTime * 1000);

    // Restart programm
    ESP.restart();
}

void scan() {
  /**************************************************************************************
  |                            Acquire RSSI values                                      |
  **************************************************************************************/
  json = "{";
  BLEScanResults foundDevices = pBLEScan->start(scanTime);  
  json = json.substring(0, json.length() - 1);
  json = json + "}";
  if (json == "}") {
    json="{}";
  }
  // Remove when done testing
  /*int getal1=random(-100,0);
  int getal2=random(-100,0);
  json="{\"02\": {\"RSSI\":"+String(getal1)+"},\"6d\":{\"RSSI\" :"+String(getal2)+"}}";*/
  
  delete pBLEScan;
  pBLEScan = NULL;
}

void batteryLevel() {
  /**************************************************************************************
  |                            Acquire Battery Level                                    |
  **************************************************************************************/
  // Read battery voltage in ADC form - 11bits (0-2047)
  batteryLevel_Digital=analogRead(ANALOG_BatteryPower);
  
  //randomValue=random(100)/100.0; // Remove when done testing - add random value to see change

  // Convert battery level from digital to analog signal and make string
  batteryLevel_Analog=map(batteryLevel_Digital,0,2047,0,35)/10.0;//+randomValue;
  batLevel="{\"Level_bat1\":"+String(batteryLevel_Analog)+"}";
}

void pushToFirebase(){
      if((wifiMulti.run() == WL_CONNECTED)) {           // Check if WiFi is connected
        // Connect to URL for RSSI values - http://krookfirebase.barkr.uk/ufo-1.json
        
        http.begin(firebaseLink + deviceName + ".json"); //HTTP
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");
        int httpCode_json = http.PUT(json);
        
        // Debugging prints
        /*Serial.println("PUT2: "+String(httpCode_json));
        Serial.println("The .json: "+json);
        Serial.println(firebaseLink + deviceName + ".json");*/
        // Check succes of PUT
        if(httpCode_json > 0) {
          if(httpCode_json == HTTP_CODE_OK) {
                  String payload = http.getString();
                  Serial.println(payload);
          }
        }else {
              Serial.printf("PUT RSSI failed, error: %s\n", http.errorToString(httpCode_json).c_str());
        }
        http.end();       // end connection with http://krookfirebase.barkr.uk/ufo-1.json
        
        // Connect to URL for battery level - http://krookfirebase.barkr.uk/batt-1.json
        
        http.begin(firebaseLink + batteryName + ".json"); //HTTP
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");
        int httpCode_battery = http.PUT(batLevel);

        //Debugging prints
        /*Serial.println("PUT3: "+String(httpCode_battery));
        Serial.println("Battery Level: "+batLevel);
        Serial.println(firebaseLink + batteryName + ".json");*/
        // Check succes of PUT
        if(httpCode_battery > 0) {
          if(httpCode_battery == HTTP_CODE_OK) {
                  String payload = http.getString();
                  Serial.println(payload);
          }
        }else {
              Serial.printf("PUT batteryLevel failed, error: %s\n", http.errorToString(httpCode_battery).c_str());
        }
        http.end();       // end connection with http://krookfirebase.barkr.uk/batt-1.json
      }
}
      

void loop() {
    /* no need for loop */
}
