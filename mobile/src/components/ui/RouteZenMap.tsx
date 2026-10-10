import React, { forwardRef, useImperativeHandle, useRef, useState, useMemo } from "react";
import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { MapErrorBoundary, MapFallback } from "./MapErrorBoundary";

export const OSM_TILE_URL_TEMPLATE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export interface RouteZenMapProps {
  initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  markers?: { id: string; latitude: number; longitude: number; title?: string; color?: string /* hex, default brand green #0E4429 */ }[];
  polyline?: { latitude: number; longitude: number }[]; // omit entirely if not supplied — never draw a straight-line approximation where the caller didn't explicitly pass real geometry
  polylineColor?: string; // default brand green #0E4429
  fitToMarkers?: boolean; // auto-fit viewport to all markers/polyline on load, default true when markers.length > 0
  onMapReady?: () => void;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps["pointerEvents"]; // used by logistics package detail for a non-interactive preview
  className?: string; // keep for NativeWind parity with the old API, applied to the outer View
}

export interface RouteZenMapRef {
  fitToCoordinates: (coords: { latitude: number; longitude: number }[]) => void;
  animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => void;
}

function buildHtml(
  initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number },
  markers: { id: string; latitude: number; longitude: number; title?: string; color?: string }[] = [],
  polyline?: { latitude: number; longitude: number }[],
  polylineColor: string = "#0E4429",
  fitToMarkers: boolean = true
): string {
  const centerLat = initialRegion?.latitude ?? (markers.length > 0 ? markers[0].latitude : 13.0827);
  const centerLng = initialRegion?.longitude ?? (markers.length > 0 ? markers[0].longitude : 80.2707);

  let initialZoom = 13;
  if (initialRegion) {
    const maxDelta = Math.max(initialRegion.latitudeDelta, initialRegion.longitudeDelta);
    if (maxDelta > 0) {
      initialZoom = Math.max(1, Math.min(18, Math.round(Math.log2(360 / maxDelta))));
    }
  }

  const markersJson = JSON.stringify(markers);
  const polylineJson = polyline && polyline.length > 0 ? JSON.stringify(polyline) : "null";
  const polylineColorJson = JSON.stringify(polylineColor);
  const autoFit = fitToMarkers && (markers.length > 0 || (polyline && polyline.length > 0));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #f4f6f3;
    }
    .leaflet-container {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .custom-pin {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-bubble {
      width: 20px;
      height: 20px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid #ffffff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.35);
    }
    .leaflet-popup-content-wrapper {
      border-radius: 8px;
      padding: 2px 4px;
    }
    .leaflet-popup-content {
      margin: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      color: #0E1A14;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map;
    var markersLayer = L.layerGroup();
    var polylineLayer = L.layerGroup();

    function createPinIcon(color) {
      return L.divIcon({
        className: 'custom-pin',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
        html: '<div class="pin-bubble" style="background-color: ' + (color || '#0E4429') + ';"></div>'
      });
    }

    function init() {
      map = L.map('map', {
        zoomControl: false,
        attributionControl: true
      }).setView([${centerLat}, ${centerLng}], ${initialZoom});

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        subdomains: 'abc',
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
      }).addTo(map);

      markersLayer.addTo(map);
      polylineLayer.addTo(map);

      var initialMarkers = ${markersJson};
      var initialPolyline = ${polylineJson};
      var pColor = ${polylineColorJson};

      var allBounds = [];

      if (initialMarkers && initialMarkers.length > 0) {
        initialMarkers.forEach(function(m) {
          var marker = L.marker([m.latitude, m.longitude], {
            icon: createPinIcon(m.color || '#0E4429')
          });
          if (m.title) {
            marker.bindPopup(m.title);
          }
          marker.addTo(markersLayer);
          allBounds.push([m.latitude, m.longitude]);
        });
      }

      if (initialPolyline && initialPolyline.length > 0) {
        var latLngs = initialPolyline.map(function(pt) {
          allBounds.push([pt.latitude, pt.longitude]);
          return [pt.latitude, pt.longitude];
        });
        L.polyline(latLngs, {
          color: pColor || '#0E4429',
          weight: 4,
          opacity: 0.9
        }).addTo(polylineLayer);
      }

      if (${autoFit} && allBounds.length > 0) {
        if (allBounds.length === 1) {
          map.setView(allBounds[0], 14);
        } else {
          map.fitBounds(allBounds, { padding: [40, 40] });
        }
      }

      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      }
    }

    window.fitToCoordinates = function(coords) {
      if (!map || !coords || coords.length === 0) return;
      var bounds = coords.map(function(c) {
        return [c.latitude !== undefined ? c.latitude : c[0], c.longitude !== undefined ? c.longitude : c[1]];
      });
      if (bounds.length === 1) {
        map.setView(bounds[0], 14, { animate: true });
      } else {
        map.fitBounds(bounds, { padding: [40, 40], animate: true });
      }
    };

    window.animateToRegion = function(region) {
      if (!map || !region) return;
      var lat = region.latitude;
      var lng = region.longitude;
      var latDelta = region.latitudeDelta || 0.05;
      var lngDelta = region.longitudeDelta || 0.05;
      var southWest = [lat - latDelta / 2, lng - lngDelta / 2];
      var northEast = [lat + latDelta / 2, lng + lngDelta / 2];
      map.fitBounds([southWest, northEast], { animate: true });
    };

    document.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>`;
}

export const RouteZenMap = forwardRef<RouteZenMapRef, RouteZenMapProps>(function RouteZenMap(
  {
    initialRegion,
    markers = [],
    polyline,
    polylineColor = "#0E4429",
    fitToMarkers = true,
    onMapReady,
    style,
    pointerEvents,
    className,
  },
  ref
) {
  const webViewRef = useRef<WebView>(null);
  const [webViewFailed, setWebViewFailed] = useState(false);
  const mapReadyFired = useRef(false);

  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coords: { latitude: number; longitude: number }[]) => {
      if (!webViewRef.current) return;
      const json = JSON.stringify(coords);
      webViewRef.current.injectJavaScript(`if (window.fitToCoordinates) { window.fitToCoordinates(${json}); } true;`);
    },
    animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => {
      if (!webViewRef.current) return;
      const json = JSON.stringify(region);
      webViewRef.current.injectJavaScript(`if (window.animateToRegion) { window.animateToRegion(${json}); } true;`);
    },
  }));

  const html = useMemo(
    () => buildHtml(initialRegion, markers, polyline, polylineColor, fitToMarkers),
    [initialRegion, markers, polyline, polylineColor, fitToMarkers]
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        if (!mapReadyFired.current) {
          mapReadyFired.current = true;
          onMapReady?.();
        }
      }
    } catch {
      // ignore unknown message payload
    }
  };

  return (
    <MapErrorBoundary className={className}>
      <View
        className={className}
        pointerEvents={pointerEvents}
        style={[{ flex: 1, overflow: "hidden" }, style]}
      >
        {webViewFailed ? (
          <MapFallback />
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html }}
            onMessage={handleMessage}
            onError={() => setWebViewFailed(true)}
            onHttpError={() => setWebViewFailed(true)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            bounces={false}
            style={{ flex: 1, backgroundColor: "#f4f6f3" }}
          />
        )}
      </View>
    </MapErrorBoundary>
  );
});
