import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

// leaflet.heat has no react-leaflet wrapper, so it's driven imperatively via
// useMap() — same pattern as MapController in driver-app's MapView.jsx.
export default function HeatmapLayer({ points }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = L.heatLayer(points, {
      radius: 30,
      blur: 22,
      maxZoom: 16,
      minOpacity: 0.35,
      gradient: { 0.2: '#14b8a6', 0.5: '#f59e0b', 0.8: '#f43f5e' },
    });

    // leaflet.heat's _redraw runs a canvas getImageData() that throws if the
    // map/canvas has a zero size (e.g. mounted inside a display:none tab) or
    // if it fires — it's scheduled via requestAnimationFrame — after the
    // layer's already been torn down. Either way a failed redraw is harmless
    // (it just draws again next update), so swallow it at the source instead
    // of choreographing every mount/unmount/visibility edge case around it.
    const safeRedraw = layer._redraw.bind(layer);
    layer._redraw = function guardedRedraw(...args) {
      try {
        return safeRedraw(...args);
      } catch {
        return undefined;
      }
    };

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      if (layerRef.current === layer) layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (layerRef.current && map.hasLayer(layerRef.current)) {
      layerRef.current.setLatLngs(points);
    }
  }, [points, map]);

  return null;
}
