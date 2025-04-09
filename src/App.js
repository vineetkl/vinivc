import React, { useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
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

function MapController({ locations }) {
  const map = useMap();
  const pathRef = useRef(null);
  
  React.useEffect(() => {
    // Remove existing path if it exists
    if (pathRef.current) {
      pathRef.current.remove();
    }

    if (locations && locations.length === 2) {
      const bounds = L.latLngBounds(locations);
      map.fitBounds(bounds, { padding: [50, 50] });

      // Create new path with updated style
      pathRef.current = L.polyline([], {
        color: '#000000',  // Black color
        weight: 8,        // Thick line
        opacity: 0.9,     // High opacity
        dashArray: '8, 16',  // 8px dash with 16px gap
        lineCap: 'round'
      }).addTo(map);

      // Update path with new coordinates
      const [start, end] = locations;
      const updatePath = async () => {
        try {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&access_token=be82a573-0ad7-4a1a-bf21-4b7bd0057fb1`
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
    } else if (pathRef.current) {
      // Clear the path if locations are reset
      pathRef.current.setLatLngs([]);
    }
  }, [locations, map]);

  return null;
}

function App() {
  const [locations, setLocations] = useState([]);
  const mapRef = useRef(null);

  const handleLocationsSelected = useCallback((newLocations) => {
    setLocations(newLocations);
  }, []);

  return (
    <div className="app-container">
      <SearchForm onLocationsSelected={handleLocationsSelected} />
      <div className="map-container">
        <div className="map-wrapper" style={{ height: '100%' }}>
          <MapContainer 
            ref={mapRef}
            center={[37.7749, -122.4194]} 
            zoom={12} 
            scrollWheelZoom={true}
            style={{ background: '#f4d03f' }}
          >
            <MapController locations={locations} />
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
