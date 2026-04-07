import { useEffect, useRef } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

const AdvancedMarker = ({ position }) => {
  const map = useGoogleMap();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || !position || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    if (!markerRef.current) {
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
      });
    } else {
      markerRef.current.position = position;
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [map, position]);

  return null;
};

export default AdvancedMarker;
