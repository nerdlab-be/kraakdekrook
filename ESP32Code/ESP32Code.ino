
#include <Esp.h>
#include <driver/adc.h>
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#define ANALOG_BatteryPower 34 //A2
#define LED_BUILTIN 13

/* Esp settings */
int scanTime = 2; //in seconds 
int sleepTime = 5; // in seconds

/* backend settings */ 
String firebaseLink = "http://krookfirebase.barkr.uk/";
String deviceName;
String batteryName;
bool jsonisValid;

/* Wifi settings */
// Nerdlab WiFi
char ssid[] = "Nerdlab";
char password[] = "***REMOVED***";
/* end settings */

/*Init*/
BLEScan* pBLEScan = BLEDevice::getScan(); 
WiFiMulti wifiMulti;
HTTPClient http;
String json; 
int batteryLevel_Digital=0;
float batteryLevel_Analog=0.0;
String batLevel;
String requestTimestamp;

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
    pinMode(LED_BUILTIN, OUTPUT);

    String macad=getMacAddress();
    Serial.print("Mac: ");
    Serial.println(macad);
    deviceName=macad;
    batteryName=macad;
        
    // Set analogRead
    analogReadResolution(11);
    analogSetAttenuation(ADC_6db);
    
    // Set WiFi
    wifiMulti.addAP(ssid, password);
    BLEDevice::init("");
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
    pBLEScan->setActiveScan(true);

    // Measure and send to Firebase
    jsonisValid=true;
    scan();
    batteryLevel();
    if((wifiMulti.run() == WL_CONNECTED)) {           // Check if WiFi is connected
    // Connect to URL for RSSI values - http://krookfirebase.barkr.uk/ufo-1.json
    
      if (jsonisValid) {
        pushToFirebase_json();
      }
      else {
        Serial.println("Invalid JSON");
      }
      pushToFirebase_battery();

    }
      
    digitalWrite(LED_BUILTIN, HIGH);
    delay(sleepTime * 1000);
    digitalWrite(LED_BUILTIN, LOW);

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

    // Remove when done testing
  /*int getal1=random(-100,0);
  int getal2=random(-100,0);
  json="{\"02\": {\"RSSI\":"+String(getal1)+"},\"6d\":{\"RSSI\" :"+String(getal2)+"}}";*/
  
  if (json.equals("}")) {
    jsonisValid=false;
  }

  
  delete pBLEScan;
  pBLEScan = NULL;
}

void batteryLevel() {
  /**************************************************************************************
  |                            Acquire Battery Level                                    |
  **************************************************************************************/
  // Read battery voltage in ADC form - 11bits (0-2047)
  batteryLevel_Digital=readLightSensor();
  Serial.print("Batt: ");
  Serial.print(batteryLevel_Digital);
  Serial.print(" - ");

  // Convert battery level from digital to analog signal and make string
  batteryLevel_Analog=map(batteryLevel_Digital,0,2047,0,36)/10.0;//+randomValue;
  batLevel=String(batteryLevel_Analog);
  Serial.println(batLevel);

  requestTimestamp=String(random(100));
}

void pushToFirebase_json(){                
        http.begin(firebaseLink + "sensors/" + deviceName + ".json"); //HTTP
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");
        int httpCode_json = http.PUT(json);

        Serial.println(firebaseLink + "sensors/" + deviceName + ".json");
        Serial.println(json);
        
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

}

void pushToFirebase_battery(){
        // Connect to URL for battery level - http://krookfirebase.barkr.uk/batt-1.json
        
        http.begin(firebaseLink + "battery/"+deviceName+".json"); //HTTP
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");
        int httpCode_battery = http.PUT(batLevel);

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

        // Connect to URL for battery level - http://krookfirebase.barkr.uk/batt-1.json
        
        http.begin(firebaseLink + "TimeStamp/"+deviceName+".json"); //HTTP
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");
        int httpCode_timestamp = http.PUT(requestTimestamp);

        // Check succes of PUT
        if(httpCode_battery > 0) {
          if(httpCode_timestamp == HTTP_CODE_OK) {
                  String payload = http.getString();
                  Serial.println(payload);
          }
        }else {
              Serial.printf("PUT batteryLevel failed, error: %s\n", http.errorToString(httpCode_battery).c_str());
        }
        http.end();       // end connection with http://krookfirebase.barkr.uk/batt-1.json
      
}

String getMacAddress(){
  uint8_t baseMac[6];
  esp_read_mac(baseMac, ESP_MAC_WIFI_STA);
  baseMac[5]=baseMac[5] & 0b11111100;
  char baseMacChr[18] = {0};
  sprintf(baseMacChr, "%02X:%02X:%02X:%02X:%02X:%02X", baseMac[0],baseMac[1],baseMac[2],baseMac[3],baseMac[4],baseMac[5]);
  return String(baseMacChr);
}

int readLightSensor(){
  //adc1_config_width(ADC_WIDTH_BIT_10);   //Range 0-1023 
  //adc1_config_channel_atten(ANALOG_BatteryPower,ADC_ATTEN_DB_11);  //ADC_ATTEN_DB_11 = 0-3,6V
  return analogRead( ANALOG_BatteryPower ); //Read analog
}
    

void loop() {
    /* no need for loop */
}
