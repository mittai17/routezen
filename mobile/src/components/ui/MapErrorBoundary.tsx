import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text } from "react-native";
import { MapPinOff } from "lucide-react-native";

export interface MapFallbackProps {
  message?: string;
  className?: string;
}

export function MapFallback({
  message = "Map unavailable — check your internet connection, or view stops below",
  className = "flex-1 min-h-[160px]",
}: MapFallbackProps) {
  return (
    <View
      className={`items-center justify-center rounded-xl border border-dashed border-border bg-surface p-6 ${className}`}
      accessibilityRole="text"
    >
      <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-warning/15">
        <MapPinOff size={24} color="#B3791A" />
      </View>
      <Text className="text-center text-sm font-semibold text-ink">Map unavailable</Text>
      <Text className="mt-1 text-center text-xs leading-5 text-ink-muted">
        {message}
      </Text>
    </View>
  );
}

interface MapErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackMessage?: string;
  className?: string;
}

interface MapErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  override state: MapErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Map rendering error caught by MapErrorBoundary:", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <MapFallback
          message={this.props.fallbackMessage}
          className={this.props.className}
        />
      );
    }
    return this.props.children;
  }
}
