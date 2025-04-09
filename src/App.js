import React, { useState, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-compass/dist/leaflet-compass.min.css';
import 'leaflet-compass';
import L from 'leaflet';
import SearchForm from './components/SearchForm';

// Custom watercolor-style markers
const createWatercolorIcon = (type) => {
  const gooseSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-size="160px">🦢</text>
    </svg>
  `;

  const treasureSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-size="160px">❌</text>
    </svg>
  `;

  const svg = type === 'start' ? gooseSvg : treasureSvg;
  
  return L.divIcon({
    html: `<div class="watercolor-icon">${svg}</div>`,
    className: 'watercolor-marker',
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48]
  });
};

const startIcon = createWatercolorIcon('start');
const treasureIcon = createWatercolorIcon('treasure');

function MapController({ locations, onManualPinAdd }) {
  const [initialized, setInitialized] = React.useState(false);
  const map = useMap();
  const pathRef = useRef(null);
  
  // Initialize compass once
  React.useEffect(() => {
    if (!initialized) {
      const compass = new L.Control.Compass({
        autoActive: true,
        showDigit: true,
        position: 'topright',
        width: 40,
        height: 40
      });
      map.addControl(compass);
      setInitialized(true);

      return () => {
        map.removeControl(compass);
      };
    }
  }, [map, initialized]);

  // Handle location updates
  React.useEffect(() => {
    // Remove existing path if it exists
    if (pathRef.current) {
      pathRef.current.remove();
    }

    if (locations && locations.length > 0) {
      // For single location, zoom to it. For two locations, fit bounds
      if (locations.length === 1) {
        map.flyTo(locations[0], 13, {
          duration: 1.5,
          easeLinearity: 0.25
        });
      } else if (locations.length === 2) {
        const bounds = L.latLngBounds(locations);
        map.fitBounds(bounds, { padding: [50, 50] });

        // Create new path with dashed style
        pathRef.current = L.polyline([], {
          color: '#000000',
          weight: 6,
          dashArray: '10, 10',
          opacity: 0.9,
          smoothFactor: 1
        }).addTo(map);

        // Update path with new coordinates
        const [start, end] = locations;
        const updatePath = async () => {
          try {
            const response = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
            );
            const data = await response.json();
            
            if (data.routes && data.routes[0]) {
              const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
              pathRef.current.setLatLngs(coordinates);
            }
          } catch (error) {
            console.error('Error getting route:', error);
            // Fallback to straight line if routing fails
            pathRef.current.setLatLngs([start, end]);
          }
        };
        updatePath();
      }
    } else if (pathRef.current) {
      // Reset view if no locations
      map.setView([0, 0], 2);
      // Clear the path if locations are reset
      pathRef.current.setLatLngs([]);
    }
  }, [locations, map]);

  // Handle click events for manual pin placement
  useMapEvents({
    click: (e) => {
      if (onManualPinAdd) {
        onManualPinAdd([e.latlng.lat, e.latlng.lng]);
      }
    }
  });

  return null;
}

function App() {
  const [locations, setLocations] = useState([]);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [activeInput, setActiveInput] = useState(null);
  const mapRef = useRef(null);

  const handleLocationsSelected = useCallback((newLocations) => {
    setLocations(newLocations);
    setIsAddingPin(false);
  }, []);

  const handleManualPinAdd = useCallback((latlng) => {
    if (!isAddingPin) return;

    if (locations.length === 0) {
      setLocations([latlng]);
      setIsAddingPin(false);
    } else if (locations.length === 1) {
      // If adding end point, put it second
      setLocations(prev => prev[0] ? [prev[0], latlng] : [latlng]);
      setIsAddingPin(false);
    } else if (locations.length === 2) {
      // Replace the appropriate point based on which input is active
      setLocations(prev => [
        activeInput === 'start' ? latlng : prev[0],
        activeInput === 'end' ? latlng : prev[1]
      ]);
      setIsAddingPin(false);
    }
  }, [locations, isAddingPin, activeInput]);

  const handleAddPin = useCallback((inputType) => {
    setIsAddingPin(true);
    setActiveInput(inputType);
  }, []);

  const handleFlipLocations = useCallback(() => {
    if (locations.length === 2) {
      setLocations([locations[1], locations[0]]);
    }
  }, [locations]);

  const handleDownloadMap = useCallback(async () => {
    if (!locations.length) return;
    
    const mapElement = document.querySelector('.leaflet-container');
    if (!mapElement) return;

    try {
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f4d03f'
      });
      
      const link = document.createElement('a');
      link.download = 'treasure-map.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating map image:', error);
    }
  }, [locations]);

  return (
    <div className="app-container">
      <SearchForm 
        onLocationsSelected={handleLocationsSelected} 
        onDownloadMap={locations.length > 0 ? handleDownloadMap : null}
        onAddPin={handleAddPin}
        onFlipLocations={locations.length === 2 ? handleFlipLocations : null}
        isAddingPin={isAddingPin}
        activeInput={activeInput}
      />
      <div className="map-container">
        <div className="map-wrapper" style={{ height: '100%' }}>
          <MapContainer 
            ref={mapRef}
            center={[37.7749, -122.4194]} 
            zoom={12} 
            scrollWheelZoom={true}
            zoomControl={false}
            style={{ background: '#f4d03f' }}
          >
            <MapController 
              locations={locations} 
              onManualPinAdd={handleManualPinAdd}
            />
            <TileLayer
              attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>'
              url="https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=be82a573-0ad7-4a1a-bf21-4b7bd0057fb1"
            />
            {locations.map((position, index) => (
              <Marker 
                key={index} 
                position={position} 
                icon={index === 0 ? startIcon : treasureIcon}
              >
                <Popup className="treasure-popup">
                  <h3>{index === 0 ? "Starting Point" : "Treasure Location"}</h3>
                  <p><em>{index === 0 ? "Your journey begins here..." : "X marks the spot!"}</em></p>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          <div className="compass-rose" />
        </div>
      </div>
    </div>
  );
}

export default App;
