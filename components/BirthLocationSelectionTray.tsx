import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { MapPin, X, Search } from "lucide-react-native";
import { FrontendGeocodingService } from "../src/services/geocoding-service";

const { height } = Dimensions.get("window");

interface LocationSuggestion {
  city: string;
  country: string;
  lat: number;
  lng: number;
  displayName: string;
}

interface BirthLocationSelectionTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirmLocation: (location: LocationSuggestion) => void;
  initialLocation?: string;
}

// Built-in cities from the backend geocoding service
const BUILT_IN_CITIES = [
  // Major US Cities
  { city: "New York", country: "USA", lat: 40.7128, lng: -74.0060 },
  { city: "Los Angeles", country: "USA", lat: 34.0522, lng: -118.2437 },
  { city: "Chicago", country: "USA", lat: 41.8781, lng: -87.6298 },
  { city: "Houston", country: "USA", lat: 29.7604, lng: -95.3698 },
  { city: "Phoenix", country: "USA", lat: 33.4484, lng: -112.0740 },
  { city: "Philadelphia", country: "USA", lat: 39.9526, lng: -75.1652 },
  { city: "San Antonio", country: "USA", lat: 29.4241, lng: -98.4936 },
  { city: "San Diego", country: "USA", lat: 32.7157, lng: -117.1611 },
  { city: "Dallas", country: "USA", lat: 32.7767, lng: -96.7970 },
  { city: "San Jose", country: "USA", lat: 37.3382, lng: -121.8863 },
  { city: "Austin", country: "USA", lat: 30.2672, lng: -97.7431 },
  { city: "San Francisco", country: "USA", lat: 37.7749, lng: -122.4194 },
  { city: "Seattle", country: "USA", lat: 47.6062, lng: -122.3321 },
  { city: "Denver", country: "USA", lat: 39.7392, lng: -104.9903 },
  { city: "Washington", country: "USA", lat: 38.9072, lng: -77.0369 },
  { city: "Boston", country: "USA", lat: 42.3601, lng: -71.0589 },
  { city: "Detroit", country: "USA", lat: 42.3314, lng: -83.0458 },
  { city: "Nashville", country: "USA", lat: 36.1627, lng: -86.7816 },
  { city: "Portland", country: "USA", lat: 45.5152, lng: -122.6784 },
  { city: "Las Vegas", country: "USA", lat: 36.1699, lng: -115.1398 },
  { city: "Miami", country: "USA", lat: 25.7617, lng: -80.1918 },
  { city: "Atlanta", country: "USA", lat: 33.7490, lng: -84.3880 },
  
  // International Cities
  { city: "London", country: "UK", lat: 51.5074, lng: -0.1278 },
  { city: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { city: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503 },
  { city: "Berlin", country: "Germany", lat: 52.5200, lng: 13.4050 },
  { city: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964 },
  { city: "Madrid", country: "Spain", lat: 40.4168, lng: -3.7038 },
  { city: "Barcelona", country: "Spain", lat: 41.3851, lng: 2.1734 },
  { city: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041 },
  { city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093 },
  { city: "Melbourne", country: "Australia", lat: -37.8136, lng: 144.9631 },
  { city: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832 },
  { city: "Vancouver", country: "Canada", lat: 49.2827, lng: -123.1207 },
  { city: "Montreal", country: "Canada", lat: 45.5017, lng: -73.5673 },
  { city: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332 },
  { city: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333 },
  { city: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729 },
  { city: "Buenos Aires", country: "Argentina", lat: -34.6118, lng: -58.3960 },
  { city: "Mumbai", country: "India", lat: 19.0760, lng: 72.8777 },
  { city: "Delhi", country: "India", lat: 28.7041, lng: 77.1025 },
  { city: "Beijing", country: "China", lat: 39.9042, lng: 116.4074 },
  { city: "Shanghai", country: "China", lat: 31.2304, lng: 121.4737 },
  { city: "Hong Kong", country: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { city: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198 },
  { city: "Dubai", country: "UAE", lat: 25.2048, lng: 55.2708 },
  { city: "Moscow", country: "Russia", lat: 55.7558, lng: 37.6176 },
].map(city => ({
  ...city,
  displayName: `${city.city}, ${city.country}`
}));

const BirthLocationSelectionTray: React.FC<BirthLocationSelectionTrayProps> = ({
  isVisible,
  onClose,
  onConfirmLocation,
  initialLocation = "",
}) => {
  const [searchQuery, setSearchQuery] = useState(initialLocation);
  const [filteredCities, setFilteredCities] = useState<LocationSuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter cities based on search query
  const filterCities = useCallback((query: string) => {
    if (!query.trim()) {
      setFilteredCities(BUILT_IN_CITIES.slice(0, 20)); // Show top 20 cities initially
      return;
    }

    const searchTerm = query.toLowerCase();
    const filtered = BUILT_IN_CITIES.filter(city => 
      city.city.toLowerCase().includes(searchTerm) ||
      city.country.toLowerCase().includes(searchTerm) ||
      city.displayName.toLowerCase().includes(searchTerm)
    ).slice(0, 10); // Limit to 10 results for performance

    setFilteredCities(filtered);
  }, []);

  useEffect(() => {
    filterCities(searchQuery);
  }, [searchQuery, filterCities]);

  useEffect(() => {
    if (isVisible) {
      // Reset state when tray opens
      setSearchQuery(initialLocation);
      setSelectedLocation(null);
      filterCities(initialLocation);
    }
  }, [isVisible, initialLocation, filterCities]);

  const handleLocationSelect = (location: LocationSuggestion) => {
    setSelectedLocation(location);
    setSearchQuery(location.displayName);
  };

  const handleConfirm = async () => {
    if (!selectedLocation) {
      // Try to find a match in filtered cities if user typed but didn't select
      if (filteredCities.length === 1) {
        setSelectedLocation(filteredCities[0]);
        onConfirmLocation(filteredCities[0]);
        onClose();
        return;
      }
      
      Alert.alert(
        "Select Location",
        "Please select a city from the list or search for your birth location.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }

    // Validate coordinates using geocoding service
    if (!FrontendGeocodingService.validateCoordinates(selectedLocation.lat, selectedLocation.lng)) {
      Alert.alert(
        "Invalid Location",
        "The selected location has invalid coordinates. Please try another city.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }

    onConfirmLocation(selectedLocation);
    onClose();
  };

  const renderLocationItem = ({ item }: { item: LocationSuggestion }) => {
    const isSelected = selectedLocation?.displayName === item.displayName;
    
    return (
      <TouchableOpacity
        style={[styles.locationItem, isSelected && styles.selectedLocationItem]}
        onPress={() => handleLocationSelect(item)}
        activeOpacity={0.7}
      >
        <MapPin 
          size={16} 
          color={isSelected ? "#B8D4F1" : "#666"} 
          style={styles.locationIcon}
        />
        <View style={styles.locationTextContainer}>
          <Text style={[styles.locationText, isSelected && styles.selectedLocationText]}>
            {item.city}
          </Text>
          <Text style={[styles.countryText, isSelected && styles.selectedCountryText]}>
            {item.country}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.tray}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Birth Location</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={24} color="black" />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Search size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for your birth city..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          {/* Location List */}
          <View style={styles.listContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#B8D4F1" />
                <Text style={styles.loadingText}>Searching locations...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredCities}
                keyExtractor={(item) => item.displayName}
                renderItem={renderLocationItem}
                showsVerticalScrollIndicator={false}
                style={styles.locationList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <MapPin size={24} color="#ccc" />
                    <Text style={styles.emptyText}>
                      {searchQuery.trim() 
                        ? "No cities found. Try a different search term."
                        : "Start typing to search for your birth location"
                      }
                    </Text>
                  </View>
                }
              />
            )}
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[
              styles.confirmButton,
              selectedLocation ? styles.confirmButtonEnabled : styles.confirmButtonDisabled
            ]}
            onPress={handleConfirm}
            disabled={!selectedLocation}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.confirmButtonText,
              selectedLocation ? styles.confirmButtonTextEnabled : styles.confirmButtonTextDisabled
            ]}>
              Confirm Location
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  tray: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 34,
    height: height * 0.5,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: "black",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: "Geist-Regular",
    color: "black",
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "black",
  },
  listContainer: {
    flex: 1,
    minHeight: 200,
  },
  locationList: {
    flex: 1,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  selectedLocationItem: {
    backgroundColor: "#f0f8ff",
    borderColor: "#B8D4F1",
    borderWidth: 2,
  },
  locationIcon: {
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationText: {
    fontSize: 16,
    fontFamily: "Geist-Medium",
    color: "black",
    marginBottom: 2,
  },
  selectedLocationText: {
    color: "black",
    fontFamily: "Geist-Regular",
  },
  countryText: {
    fontSize: 14,
    color: "#666",
  },
  selectedCountryText: {
    color: "#555",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    fontFamily: "Geist-Medium",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    fontFamily: "Geist-Medium",
  },
  confirmButton: {
    borderRadius: 12,
    paddingVertical: 16,
    // Match PopUpTray sizing: center and size-to-content
    alignSelf: 'center',
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    marginTop: 20,
    borderWidth: 2,
    borderColor: "black",
  },
  confirmButtonEnabled: {
    backgroundColor: "#B8D4F1",
  },
  confirmButtonDisabled: {
    backgroundColor: "#f5f5f5",
    borderColor: "#ddd",
  },
  confirmButtonText: {
    fontSize: 18,
    fontFamily: "Geist-Regular",
  },
  confirmButtonTextEnabled: {
    color: "black",
  },
  confirmButtonTextDisabled: {
    color: "#999",
  },
});

export default BirthLocationSelectionTray;
