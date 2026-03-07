# Smart Farming Irrigation Management System - Features Checklist

## 📋 System Features Status

**Rule:** Mark [OK] lang kapag **connected na** sa DB/API/real data. Kapag mock o hindi pa naka-connect, wag i-mark para hindi malito.

---

### 1. Login / Registration
- [OK] Login page (email/password) — connected sa `user_profiles`
- [OK] Sign-up page — connected sa `user_profiles`
- [OK] Forgot password — connected sa flow
- [OK] Error messages kapag mali credentials
- [OK] Remember Me — connected sa AsyncStorage
- [OK] Auto-login kapag naka-check Remember Me

**Files:** `login.tsx`, `signup.tsx`, `splashScreen.tsx`, `welcomeScreen.tsx`, `lib/storage.ts`

---

### 2. Dashboard
- [ ] Field conditions (soil moisture, temperature, humidity) — **MOCK** (65%, 24°C, 48% hardcoded)
- [ ] Next scheduled cycle — **MOCK** ("Today, 6:00 PM" hardcoded)
- [ ] System active status — **MOCK** (true hardcoded)
- [OK] Profile name — connected sa `user_profiles`
- [OK] Link to weather screen
- [OK] Bell icon (UI)
- [OK] Irrigation controls (UI only; hindi pa naka-connect sa hardware)

**Files:** `dashboard.tsx`

---

### 3. Soil Moisture & Weather Data Collection
- [OK] Weather Update — connected sa OpenMeteo API + location
- [ ] Soil Moisture screen — **MOCK** (MOISTURE_POINTS, AREAS hardcoded; walang `sensor_reading` fetch)
- [ ] Temperature screen — **MOCK** (TEMP_POINTS, AREAS hardcoded)
- [ ] Humidity screen — **MOCK** (HUMIDITY_POINTS, AREAS hardcoded)
- [ ] 10-minute sensor data — hindi pa naka-connect sa hardware / `sensor_reading`

**Files:** `soilMoisture.tsx`, `temperature.tsx`, `humidity.tsx`, `weatherUpdate.tsx`, `lib/weatherConfig.js`

---

### 4. Crop Water Requirement Input
- [OK] Screen, recommended values, threshold settings
- [OK] Save/load — connected sa `water_requirements` table

**Files:** `waterRequirement.tsx`

---

### 5. Historical Irrigation & Water Usage Logging
- [OK] List/timeline — connected sa `irrigation_log` table
- [ ] Water usage statistics
- [ ] Export

**Files:** `irrigationHistory.tsx`

---

### 6. Automated Irrigation Based on Sensor Data
- [ ] Areas at flow/volume — **MOCK** (AREAS_DATA hardcoded)
- [ ] Add area — TODO
- [ ] Automatic control from sensor data
- [ ] Pump activation tracking
- [ ] Threshold-based trigger
- [OK] UI: START/STOP, water distribution screen (UI only; hindi pa naka-connect sa hardware)

**Files:** `waterDistribution.tsx`

---

### 7. Monitoring and Adjustments
- [OK] Monitoring screen (links to soil/temp/humidity)
- [ ] Soil/Temp/Humidity data — **MOCK** (see #3)
- [ ] System recommendations

**Files:** `soilMoisture.tsx`, `temperature.tsx`, `humidity.tsx`, `monitoringAdjustments.tsx`

---

### 8. Data Analytics & Reporting
- [ ] Environmental Condition Pattern Analyzer — placeholder "Coming Soon"
- [ ] Seasonal Irrigation Behavior Summary — placeholder "Coming Soon"
- [ ] Irrigation Report
- [ ] Data visualization (full analytics)
- [OK] Menu items for Analytics & Reporting

**Files:** `patternAnalyzer.tsx`, `seasonalSummary.tsx`

---

### 9. Alerts & Notifications
- [OK] Push notifications — connected sa irrigation schedule
- [OK] Notification permissions
- [ ] SMS (Arduino GSM) — hindi pa naka-connect
- [ ] Threshold-based alerts (soil moisture, etc.)

**Files:** `lib/notifications.ts`, `irrigationSchedule.tsx`

---

### 10. Settings
- [OK] Navigation menu (per wireframe)
- [OK] Settings screen
- [OK] Profile — connected sa `user_profiles`
- [OK] Logout

**Files:** `dashboard.tsx`, `settings.tsx`, `farmerProfile.tsx`

---

## 📊 Summary

| Feature | Status | Connected? |
|---------|--------|------------|
| 1. Login / Registration | OK | Yes (DB) |
| 2. Dashboard | — | No (field conditions, next schedule mock) |
| 3. Soil Moisture & Weather | — | Weather yes; soil/temp/humidity mock |
| 4. Crop Water Requirement | OK | Yes (DB) |
| 5. Historical Irrigation | OK | Yes (DB) |
| 6. Automated Irrigation | — | No (areas mock; hardware not connected) |
| 7. Monitoring and Adjustments | — | No (sensor data mock) |
| 8. Data Analytics & Reporting | — | No (placeholder screens) |
| 9. Alerts & Notifications | — | Push yes; SMS/threshold no |
| 10. Settings | OK | Yes (navigation + profile) |

**Fully connected:** 1, 4, 5, 10 (+ Weather sa #3, Push sa #9)  
**Hindi pa i-mark as complete:** 2, 6, 7, 8 (mock o hindi pa naka-connect)

---

## 📝 Mock vs Real Data

| Screen / Feature | Connected? | Notes |
|------------------|------------|--------|
| Dashboard field conditions | No | Mock |
| Soil Moisture | No | Mock |
| Temperature | No | Mock |
| Humidity | No | Mock |
| Weather Update | Yes | OpenMeteo API |
| Water Requirement | Yes | Supabase |
| Historical Irrigation | Yes | Supabase |
| Water Distribution areas | No | Mock |
| Pattern Analyzer / Seasonal Summary | No | Placeholder |
| Login, Signup, Profile, Schedule | Yes | Supabase |

---

**Last Updated:** 2025-03-07  
**Version:** 1.0.0
