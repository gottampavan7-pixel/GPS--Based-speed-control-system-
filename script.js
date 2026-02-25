// Configuration
const CONFIG = {
  START: { lat: 17.4474, lng: 78.3762, name: 'HITEC City' },
  END: { lat: 17.3850, lng: 78.4867, name: 'Charminar' },
  SCHOOL_ZONE_RADIUS: 1500,
  SCHOOL_ZONE_SPEED: 30,
  MIN_SPEED: 20,
  MAX_SPEED: 80,
  ACCELERATION: 0.3,
  UPDATE_INTERVAL: 16
};

// MapManager Class
class MapManager {
  constructor() {
      this.map = null;
      this.vehicleMarker = null;
      this.routeLine = null;
      this.schoolZone = null;
      this.startMarker = null;
      this.endMarker = null;
      this.init();
  }

  init() {
      this.map = L.map('map').setView([17.4162, 78.4315], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19
      }).addTo(this.map);
  }

  addMarkers() {
      if (this.startMarker) this.startMarker.remove();
      if (this.endMarker) this.endMarker.remove();

      this.startMarker = L.marker([CONFIG.START.lat, CONFIG.START.lng], {
          icon: L.divIcon({
              className: 'custom-marker',
              html: '<div style="background: #51cf66; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [20, 20]
          })
      }).addTo(this.map).bindPopup(CONFIG.START.name);

      this.endMarker = L.marker([CONFIG.END.lat, CONFIG.END.lng], {
          icon: L.divIcon({
              className: 'custom-marker',
              html: '<div style="background: #ff6b6b; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [20, 20]
          })
      }).addTo(this.map).bindPopup(CONFIG.END.name);
  }

  drawRoute(coordinates) {
      if (this.routeLine) this.routeLine.remove();
      
      this.routeLine = L.polyline(coordinates, {
          color: '#667eea',
          weight: 5,
          opacity: 0.7,
          smoothFactor: 1
      }).addTo(this.map);

      this.map.fitBounds(this.routeLine.getBounds(), { padding: [50, 50] });
  }

  createVehicle() {
      if (this.vehicleMarker) this.vehicleMarker.remove();
      
      this.vehicleMarker = L.marker([CONFIG.START.lat, CONFIG.START.lng], {
          icon: L.divIcon({
              className: 'vehicle-icon',
              html: '🚗',
              iconSize: [32, 32],
              iconAnchor: [16, 16]
          }),
          zIndexOffset: 1000
      }).addTo(this.map);
  }

  updateVehiclePosition(lat, lng) {
      if (this.vehicleMarker) {
          this.vehicleMarker.setLatLng([lat, lng]);
          this.map.panTo([lat, lng], { animate: true, duration: 0.1 });
      }
  }

  createSchoolZone(lat, lng) {
      if (this.schoolZone) this.schoolZone.remove();
      
      this.schoolZone = L.circle([lat, lng], {
          color: '#667eea',
          fillColor: '#667eea',
          fillOpacity: 0.15,
          radius: CONFIG.SCHOOL_ZONE_RADIUS,
          weight: 3
      }).addTo(this.map);

      L.marker([lat, lng], {
          icon: L.divIcon({
              className: 'school-zone-label',
              html: '🏫 School Zone - 30 km/h',
              iconSize: [120, 30],
              iconAnchor: [60, 15]
          })
      }).addTo(this.map);
  }

  reset() {
      if (this.vehicleMarker) this.vehicleMarker.remove();
      if (this.routeLine) this.routeLine.remove();
      if (this.schoolZone) this.schoolZone.remove();
      if (this.startMarker) this.startMarker.remove();
      if (this.endMarker) this.endMarker.remove();
      this.map.setView([17.4162, 78.4315], 12);
  }
}

// RouteService Class
class RouteService {
  async fetchRoute(start, end) {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      
      try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.code !== 'Ok') {
              throw new Error('Route not found');
          }
          
          const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          const distance = data.routes[0].distance / 1000;
          const duration = data.routes[0].duration / 60;
          
          return { coordinates, distance, duration };
      } catch (error) {
          console.error('Error fetching route:', error);
          throw error;
      }
  }
}

// SimulationEngine Class
class SimulationEngine {
  constructor(mapManager) {
      this.mapManager = mapManager;
      this.coordinates = [];
      this.currentIndex = 0;
      this.currentSpeed = 0;
      this.targetSpeed = 50;
      this.isRunning = false;
      this.isPaused = false;
      this.distance = 0;
      this.totalDistance = 0;
      this.startTime = null;
      this.inSchoolZone = false;
      this.schoolZoneCenter = null;
      this.animationFrameId = null;
      this.lastUpdateTime = 0;
  }

  setRoute(coordinates, distance) {
      this.coordinates = coordinates;
      this.totalDistance = distance;
      this.currentIndex = 0;
      this.distance = 0;
      this.currentSpeed = 0;
      
      const midIndex = Math.floor(coordinates.length / 2);
      this.schoolZoneCenter = coordinates[midIndex];
      this.mapManager.createSchoolZone(this.schoolZoneCenter[0], this.schoolZoneCenter[1]);
  }

  start() {
      this.isRunning = true;
      this.isPaused = false;
      this.startTime = Date.now();
      this.lastUpdateTime = Date.now();
      this.mapManager.createVehicle();
      this.animate();
  }

  pause() {
      this.isPaused = true;
      if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
      }
  }

  resume() {
      this.isPaused = false;
      this.lastUpdateTime = Date.now();
      this.animate();
  }

  stop() {
      this.isRunning = false;
      this.isPaused = false;
      if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
      }
  }

  reset() {
      this.stop();
      this.currentIndex = 0;
      this.distance = 0;
      this.currentSpeed = 0;
      this.inSchoolZone = false;
  }

  animate() {
      if (!this.isRunning || this.isPaused) return;

      const currentTime = Date.now();
      const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
      this.lastUpdateTime = currentTime;

      // Get current position
      const interpIndex = Math.floor(this.currentIndex);
      const nextIndex = Math.min(interpIndex + 1, this.coordinates.length - 1);
      const fraction = this.currentIndex - interpIndex;
      
      const lat = this.coordinates[interpIndex][0] + (this.coordinates[nextIndex][0] - this.coordinates[interpIndex][0]) * fraction;
      const lng = this.coordinates[interpIndex][1] + (this.coordinates[nextIndex][1] - this.coordinates[interpIndex][1]) * fraction;

      // Check school zone
      const currentPos = [lat, lng];
      const distanceToZone = this.getDistance(currentPos, this.schoolZoneCenter);
      const wasInZone = this.inSchoolZone;
      this.inSchoolZone = distanceToZone <= CONFIG.SCHOOL_ZONE_RADIUS;

      if (this.inSchoolZone && !wasInZone) {
          eventLog.add('Entered school zone - Speed limited to 30 km/h');
      } else if (!this.inSchoolZone && wasInZone) {
          eventLog.add('Exited school zone - Normal speed resumed');
      }

      // Calculate advised speed
      const advisedSpeed = this.inSchoolZone ? CONFIG.SCHOOL_ZONE_SPEED : this.targetSpeed;
      
      // Smooth acceleration/deceleration
      if (this.currentSpeed < advisedSpeed) {
          this.currentSpeed = Math.min(advisedSpeed, this.currentSpeed + CONFIG.ACCELERATION);
      } else if (this.currentSpeed > advisedSpeed) {
          this.currentSpeed = Math.max(advisedSpeed, this.currentSpeed - CONFIG.ACCELERATION);
      }

      // Calculate movement step - speed in km/h to coordinates per frame
      // Using a fixed multiplier for smooth movement
      const speedFactor = this.currentSpeed / 50; // normalized speed
      const baseStep = 0.5; // base movement speed
      const step = baseStep * speedFactor * deltaTime * 60; // adjusted for frame rate
      
      this.currentIndex += step;

      // Check if simulation completed
      if (this.currentIndex >= this.coordinates.length - 1) {
          this.currentIndex = this.coordinates.length - 1;
          this.stop();
          eventLog.add('Simulation completed');
          ui.update({
              currentSpeed: 0,
              advisedSpeed: this.targetSpeed,
              zoneStatus: 'Completed',
              distance: this.totalDistance,
              eta: '00:00',
              simStatus: 'Completed'
          });
          document.getElementById('pauseSim').disabled = true;
          return;
      }

      // Update vehicle position
      this.mapManager.updateVehiclePosition(lat, lng);
      this.distance = (this.currentIndex / this.coordinates.length) * this.totalDistance;

      // Calculate ETA
      const elapsedTime = (Date.now() - this.startTime) / 1000;
      const avgSpeed = this.distance / (elapsedTime / 3600);
      const remainingDistance = this.totalDistance - this.distance;
      const eta = avgSpeed > 0 ? (remainingDistance / avgSpeed) * 60 : 0;

      // Update UI
      ui.update({
          currentSpeed: Math.round(this.currentSpeed),
          advisedSpeed: advisedSpeed,
          zoneStatus: this.inSchoolZone ? 'School Zone ⚠️' : 'Normal',
          distance: this.distance.toFixed(2),
          eta: this.formatTime(eta),
          simStatus: 'Running'
      });

      this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  getDistance(pos1, pos2) {
      const R = 6371e3;
      const φ1 = pos1[0] * Math.PI / 180;
      const φ2 = pos2[0] * Math.PI / 180;
      const Δφ = (pos2[0] - pos1[0]) * Math.PI / 180;
      const Δλ = (pos2[1] - pos1[1]) * Math.PI / 180;

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
  }

  getSegmentDistance() {
      if (this.coordinates.length < 2) return 100;
      return this.getDistance(this.coordinates[0], this.coordinates[1]);
  }

  formatTime(minutes) {
      const mins = Math.floor(minutes);
      const secs = Math.floor((minutes - mins) * 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  setTargetSpeed(speed) {
      this.targetSpeed = speed;
  }
}

// UI Controller
class UIController {
  constructor() {
      this.elements = {
          currentSpeed: document.getElementById('currentSpeed'),
          advisedSpeed: document.getElementById('advisedSpeed'),
          zoneStatus: document.getElementById('zoneStatus'),
          distance: document.getElementById('distance'),
          eta: document.getElementById('eta'),
          simStatus: document.getElementById('simStatus'),
          speedSlider: document.getElementById('speedSlider'),
          sliderValue: document.getElementById('sliderValue')
      };
  }

  update(data) {
      if (data.currentSpeed !== undefined) {
          this.elements.currentSpeed.textContent = `${data.currentSpeed} km/h`;
      }
      if (data.advisedSpeed !== undefined) {
          this.elements.advisedSpeed.textContent = `${data.advisedSpeed} km/h`;
      }
      if (data.zoneStatus !== undefined) {
          this.elements.zoneStatus.textContent = data.zoneStatus;
          this.elements.zoneStatus.style.color = data.zoneStatus === 'School Zone' ? '#ffc107' : '#333';
          this.elements.zoneStatus.style.fontWeight = data.zoneStatus === 'School Zone' ? 'bold' : '600';
      }
      if (data.distance !== undefined) {
          this.elements.distance.textContent = `${data.distance} km`;
      }
      if (data.eta !== undefined) {
          this.elements.eta.textContent = data.eta;
      }
      if (data.simStatus !== undefined) {
          this.elements.simStatus.textContent = data.simStatus;
      }
  }

  updateSliderValue(value) {
      this.elements.sliderValue.textContent = value;
  }
}

// Event Log
class EventLog {
  constructor() {
      this.container = document.getElementById('eventLog');
  }

  add(message) {
      const event = document.createElement('div');
      event.className = 'event';
      const time = new Date().toLocaleTimeString();
      event.innerHTML = `<span class="event-time">${time}</span><span class="event-message">${message}</span>`;
      this.container.insertBefore(event, this.container.firstChild);
  }

  clear() {
      this.container.innerHTML = '';
  }
}

// Initialize
const mapManager = new MapManager();
const routeService = new RouteService();
const simulationEngine = new SimulationEngine(mapManager);
const ui = new UIController();
const eventLog = new EventLog();

let routePlanned = false;

// Event Listeners
document.getElementById('planRoute').addEventListener('click', async () => {
  try {
      document.getElementById('planRoute').disabled = true;
      document.getElementById('planRoute').textContent = 'Planning...';
      eventLog.add('Planning route from HITEC City to Charminar');
      
      const route = await routeService.fetchRoute(CONFIG.START, CONFIG.END);
      mapManager.addMarkers();
      mapManager.drawRoute(route.coordinates);
      simulationEngine.setRoute(route.coordinates, route.distance);
      
      routePlanned = true;
      document.getElementById('startSim').disabled = false;
      document.getElementById('planRoute').textContent = 'Route Planned ✓';
      eventLog.add(`Route planned - Distance: ${route.distance.toFixed(2)} km`);
      
      ui.update({
          simStatus: 'Route Planned',
          distance: '0.0',
          advisedSpeed: ui.elements.speedSlider.value
      });
  } catch (error) {
      eventLog.add('Error planning route');
      document.getElementById('planRoute').disabled = false;
      document.getElementById('planRoute').textContent = 'Plan Route';
      alert('Failed to plan route. Please try again.');
  }
});

document.getElementById('startSim').addEventListener('click', () => {
  if (!routePlanned) return;
  
  simulationEngine.start();
  document.getElementById('startSim').disabled = true;
  document.getElementById('pauseSim').disabled = false;
  document.getElementById('pauseSim').textContent = 'Pause';
  eventLog.add('Simulation started');
});

document.getElementById('pauseSim').addEventListener('click', () => {
  if (simulationEngine.isPaused) {
      simulationEngine.resume();
      document.getElementById('pauseSim').textContent = 'Pause';
      eventLog.add('Simulation resumed');
  } else {
      simulationEngine.pause();
      document.getElementById('pauseSim').textContent = 'Resume';
      eventLog.add('Simulation paused');
  }
});

document.getElementById('resetSim').addEventListener('click', () => {
  simulationEngine.reset();
  mapManager.reset();
  routePlanned = false;
  
  document.getElementById('planRoute').disabled = false;
  document.getElementById('planRoute').textContent = 'Plan Route';
  document.getElementById('startSim').disabled = true;
  document.getElementById('pauseSim').disabled = true;
  
  ui.update({
      currentSpeed: 0,
      advisedSpeed: ui.elements.speedSlider.value,
      zoneStatus: 'Normal',
      distance: '0.0',
      eta: '--:--',
      simStatus: 'Ready'
  });
  
  eventLog.clear();
  eventLog.add('System reset');
});

document.getElementById('speedSlider').addEventListener('input', (e) => {
  const speed = parseInt(e.target.value);
  ui.updateSliderValue(speed);
  simulationEngine.setTargetSpeed(speed);
  ui.update({ advisedSpeed: simulationEngine.inSchoolZone ? CONFIG.SCHOOL_ZONE_SPEED : speed });
});

// Initial log
eventLog.add('System initialized - Ready to plan route');
