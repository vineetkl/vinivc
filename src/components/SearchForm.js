import React, { useState, useEffect, useCallback } from 'react';

function SearchForm({ onLocationsSelected, onDownloadMap }) {
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);

  const searchPlaces = useCallback(async (query, setResults) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) {
      setResults([]);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=en`
      );
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    }
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchPlaces(startQuery, setStartSuggestions);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [startQuery, searchPlaces]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchPlaces(endQuery, setEndSuggestions);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [endQuery, searchPlaces]);

  const handleLocationSelect = (item, isStart) => {
    const location = [parseFloat(item.lat), parseFloat(item.lon)];
    if (isStart) {
      setStartLocation(location);
      setStartQuery(item.display_name);
      setStartSuggestions([]);
    } else {
      setEndLocation(location);
      setEndQuery(item.display_name);
      setEndSuggestions([]);
    }
  };

  const checkIsValidLocation = async (point) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point[0]}&lon=${point[1]}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      // Check if location is in Los Angeles
      const isLA = data.address && 
        (data.address.city === 'Los Angeles' || 
         data.address.county === 'Los Angeles County');

      // Check for any water bodies or parks
      const isInvalid = data.address && (
        data.address.water ||
        data.address.bay ||
        data.address.ocean ||
        data.address.sea ||
        data.address.river ||
        data.address.lake ||
        data.address.park ||
        data.address.forest ||
        data.address.beach
      );
      
      return isLA && !isInvalid;
    } catch (error) {
      console.error('Error checking location:', error);
      return false;
    }
  };

  const generateRandomNearbyPoint = async (basePoint) => {
    // Convert 10m to degrees (approximately)
    const metersToDegrees = 0.0009;
    const radius = 10 * metersToDegrees;
    
    let attempts = 0;
    let point;
    
    // Try up to 5 times to find a valid land point
    while (attempts < 5) {
      // Random angle and distance
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.sqrt(Math.random()) * radius;
      
      // Calculate offset
      const lat = basePoint[0] + distance * Math.cos(angle);
      const lon = basePoint[1] + distance * Math.sin(angle);
      
      point = [lat, lon];
      
      // Check if point is valid
      if (await checkIsValidLocation(point)) {
        return point;
      }
      
      attempts++;
    }
    
    // If no valid point found, return null
    return null;
  };

  const handleRandomLocations = async () => {
    try {
      // Try different areas until we find valid land points
      let validPoints = false;
      let attempts = 0;
      let point1, point2;

      while (!validPoints && attempts < 5) {
        // Generate a random point in central LA (around Downtown LA)
        // Downtown LA: 34.0522° N, 118.2437° W
        point1 = [34.0522 + (Math.random() - 0.5) * 0.02, -118.2437 + (Math.random() - 0.5) * 0.02];
        
        // Check if base point is valid
        if (await checkIsValidLocation(point1)) {
          point2 = await generateRandomNearbyPoint(point1);
          if (point2) {
            validPoints = true;
          }
        }
        
        attempts++;
      }

      if (validPoints) {
        // Update the locations
        setStartLocation(point1);
        setEndLocation(point2);
        setStartQuery('');
        setEndQuery('');
        
        // Create the map
        onLocationsSelected([point1, point2]);
      } else {
        console.error('Could not find valid land points');
      }
    } catch (error) {
      console.error('Error generating random locations:', error);
    }
  };

  const handleCreateMap = () => {
    if (startLocation && endLocation) {
      onLocationsSelected([startLocation, endLocation]);
    }
  };

  return (
    <div className="search-form">
      <h1>Treasure Map Creator</h1>
      <div className="search-inputs">
        <div className="input-group">
          <input
            value={startQuery}
            onChange={(e) => {
              setStartQuery(e.target.value);
              if (startSuggestions.length > 0) {
                setStartSuggestions([]);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setStartSuggestions([]);
              }
            }}
            placeholder="Enter starting location"
          />
          {startSuggestions.length > 0 && (
            <ul className="suggestions-list">
              {startSuggestions.map((suggestion) => (
                <li
                  key={suggestion.place_id}
                  onClick={() => handleLocationSelect(suggestion, true)}
                >
                  {suggestion.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="input-group">
          <input
            value={endQuery}
            onChange={(e) => {
              setEndQuery(e.target.value);
              if (endSuggestions.length > 0) {
                setEndSuggestions([]);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEndSuggestions([]);
              }
            }}
            placeholder="Enter treasure location"
          />
          {endSuggestions.length > 0 && (
            <ul className="suggestions-list">
              {endSuggestions.map((suggestion) => (
                <li
                  key={suggestion.place_id}
                  onClick={() => handleLocationSelect(suggestion, false)}
                >
                  {suggestion.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="button-group">
        <button
          className="create-map-button"
          onClick={handleCreateMap}
          disabled={!startLocation || !endLocation}
        >
          Create Treasure Map
        </button>
        <button
          className="dice-button"
          onClick={handleRandomLocations}
          title="Generate random nearby locations"
        >
          🎲
        </button>
        {onDownloadMap && (
          <button
            className="dice-button"
            onClick={onDownloadMap}
            title="Download Map"
          >
            📥
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchForm;
