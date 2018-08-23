#define ARDUHAL_LOG_LEVEL 4
#include <esp32-hal-log.h>  
#include <Esp.h>
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include "time.h"

/* Esp settings */
int scanTime = 2; //in seconds 
int sleepTime = 5; // in seconds
/* backend settings */ 
String firebaseLink = "http://krookfirebase.barkr.uk/";
String deviceName = "ESP32";
/* Wifi settings */
char ssid[] = "***REMOVED***";
char password[] = "***REMOVED***";
/* time settings*/
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 3600;
const int   daylightOffset_sec = 3600;
/* end settings */

BLEScan* pBLEScan = BLEDevice::getScan(); 
WiFiMulti wifiMulti;
HTTPClient http;
String json;

// Name of the server we want to connect to
const char kHostname[] = "arduino.cc";
// Path to download (this is the bit after the hostname in the URL
// that you want to download
const char kPath[] = "/";

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
      char* pHex = BLEUtils::buildHexData(nullptr, (uint8_t*)advertisedDevice.getManufacturerData().data(), advertisedDevice.getManufacturerData().length());
      String s = String(pHex).substring(8, 40);
      if(s.substring(0, 30).equals("e2c56db5dffb48d2b060d04f435441")){
          String id = s.substring(30, 32);
          String obj = "\"" + id + "\": {\"RSSI\": " + String(advertisedDevice.getRSSI()) + "},";
          json = json + obj;
        //Serial.printf("Beacon found with ID : %s and RSSI %d \n", id.c_str(), advertisedDevice.getRSSI());     
      }
    }
};

void printLocalTime()
{
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)){
    Serial.println("Failed to obtain time");
    return;
  }
  Serial.println(&timeinfo, "%A, %B %d %Y %H:%M:%S");
}

void setup() {
    Serial.begin(115200);
  
    //connect to WiFi
    Serial.printf("Connecting to %s ", ssid);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println(" CONNECTED");
  
    //init and get the time
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    

   
    wifiMulti.addAP(ssid, password); 
    BLEDevice::init("");
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
    pBLEScan->setActiveScan(true);
    scan();
    printLocalTime();
    pushToFirebase();
    delay(sleepTime * 1000);
    ESP.restart();

    //disconnect WiFi as it's no longer needed
    //WiFi.disconnect(true);
    //WiFi.mode(WIFI_OFF);
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
      Serial.println("FIREBASE");
      printLocalTime();
      if((wifiMulti.run() == WL_CONNECTED)) {
//        if(!http.begin("https://httpstat.us/200")) {
//          Serial.println("AAAAAAAAAAAAAA");
//        }; //HTTP
//        int getCode = http.GET();
//        if(getCode > 0) {
//          if(getCode == HTTP_CODE_OK) {
//                  Serial.println("BBBBBB");
//                  String payload = http.getString();
//                  Serial.println(payload);
//          }
//        }else {
//              Serial.printf("GET failed, error: %s\n", http.errorToString(getCode).c_str());
//        }
//        http.end();
        
        if(!http.begin(firebaseLink + deviceName + ".json")) {
          Serial.println("AAAAAAAAAAAAAA");
        }; //HTTP
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");
        
        
        int httpCode = http.PUT(json);
        //int httpGet=http.get(kHostname, kPath);
        // Serial.println(json);
        // Serial.println(firebaseLink + deviceName + ".json");
        Serial.println(httpCode);
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
    delay(1000);
    printLocalTime();
}
