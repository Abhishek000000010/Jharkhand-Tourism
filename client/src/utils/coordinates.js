/**
 * Headquarters coordinates for all 24 districts of Jharkhand.
 *
 * Used as a map fallback for records that carry no coordinates of their own
 * (listings only know their district). Destinations carry real coordinates and
 * do not go through this table. Kept in sync with server/data/districts.js.
 */
export const DISTRICT_COORDINATES = {
  'Bokaro': { lat: 23.6693, lng: 86.1511 },
  'Chatra': { lat: 24.2069, lng: 84.8710 },
  'Deoghar': { lat: 24.4823, lng: 86.6969 },
  'Dhanbad': { lat: 23.7957, lng: 86.4304 },
  'Dumka': { lat: 24.2676, lng: 87.2495 },
  'East Singhbhum': { lat: 22.8046, lng: 86.2029 },
  'Garhwa': { lat: 24.1547, lng: 83.8081 },
  'Giridih': { lat: 24.1913, lng: 86.3095 },
  'Godda': { lat: 24.8268, lng: 87.2128 },
  'Gumla': { lat: 23.0444, lng: 84.5386 },
  'Hazaribagh': { lat: 23.9925, lng: 85.3637 },
  'Jamtara': { lat: 23.9628, lng: 86.8036 },
  'Khunti': { lat: 23.0721, lng: 85.2782 },
  'Koderma': { lat: 24.4676, lng: 85.5940 },
  'Latehar': { lat: 23.7443, lng: 84.4998 },
  'Lohardaga': { lat: 23.4333, lng: 84.6833 },
  'Pakur': { lat: 24.6339, lng: 87.8460 },
  'Palamu': { lat: 24.0333, lng: 84.0667 },
  'Ramgarh': { lat: 23.6304, lng: 85.5140 },
  'Ranchi': { lat: 23.3441, lng: 85.3096 },
  'Sahibganj': { lat: 25.2495, lng: 87.6416 },
  'Seraikela-Kharsawan': { lat: 22.7000, lng: 85.9333 },
  'Simdega': { lat: 22.6167, lng: 84.5167 },
  'West Singhbhum': { lat: 22.5586, lng: 85.8000 },
};
