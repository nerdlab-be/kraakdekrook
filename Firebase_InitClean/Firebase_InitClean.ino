
#include <Esp.h>
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

/* Esp settings */
int scanTime = 2; //in seconds 
int sleepTime = 5; // in seconds
/* backend settings */ 
String firebaseLink = "http://krookfirebase.barkr.uk/";
String deviceName = "ufo-1";
/* Wifi settings */
char ssid[] = "***REMOVED***";
char password[] = "***REMOVED***";
/* end settings */


BLEScan* pBLEScan = BLEDevice::getScan(); 
WiFiMulti wifiMulti;
HTTPClient http;
String json; 

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
    Serial.begin(115200);
    wifiMulti.addAP(ssid, password); 
    BLEDevice::init("");
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
    pBLEScan->setActiveScan(true);
    scan();
    pushToFirebase();
    delay(sleepTime * 1000);
    ESP.restart();
}

void scan() {
  json = "{";
  BLEScanResults foundDevices = pBLEScan->start(scanTime);  
  json = json.substring(0, json.length() - 1);
  json = json + "}";
  delete pBLEScan;
  pBLEScan = NULL;
}

void pushToFirebase(){
      if((wifiMulti.run() == WL_CONNECTED)) {
      http.begin("http://vps.barkr.uk/esp/");
      http.PUT(json);
      http.end();
      http.begin(firebaseLink + deviceName + ".json"); //HTTP
      http.addHeader("Content-Type", "application/x-www-form-urlencoded");
      int httpCode = http.PUT(json);
      // Serial.println(json);
      Serial.println(firebaseLink + deviceName + ".json");
      if(httpCode > 0) {
        if(httpCode == HTTP_CODE_OK) {
                String payload = http.getString();
                Serial.println(payload);
        }
      }else {
            Serial.printf("PUT failed, error: %s\n", http.errorToString(httpCode).c_str());
      }
      http.end();
      }
}

void loop() {
    /* no need for loop */
}
