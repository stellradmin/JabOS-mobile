import React, { useEffect, useRef } from 'react'; // Add useEffect, useRef
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Platform,
  Animated, // Add Animated
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';

interface PopUpTrayProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  children: React.ReactNode;
  confirmButtonText?: string;
  headerTabColor?: string;
  customHeight?: number; // Custom height as percentage of screen height
  contentBackgroundColor?: string; // Optional content background color override
  // Horizontal padding for the content area (inside the tray, around children).
  // Defaults to 20 to preserve existing layouts, but can be set to 0 for edge-to-edge UIs
  contentPaddingHorizontal?: number;
  // Vertical padding inside the content area. Defaults to 10 to preserve spacing
  contentPaddingVertical?: number;
  // Bottom padding for the content container (separate from content area). Useful for trays
  // that manage their own safe-area padding (e.g., messaging composer).
  contentContainerPaddingBottom?: number;
  // If true, wraps content in KeyboardAvoidingView so inner content stays above the keyboard
  avoidKeyboard?: boolean;
  // Vertical offset to fine-tune keyboard avoidance (e.g., account for header heights)
  keyboardVerticalOffset?: number;
  // Which safe area edges to apply. Default top-only; bottom handled by content/footer.
  safeAreaEdges?: ('top' | 'bottom' | 'left' | 'right')[];
}

const { height: screenHeight } = Dimensions.get('window');

const PopUpTray: React.FC<PopUpTrayProps> = ({
  isVisible,
  onClose,
  onConfirm,
  title,
  children,
  confirmButtonText = "Confirm",
  headerTabColor = "#F2BAC9", // Default color for the header tab
  customHeight = 0.8, // Default to 80% of screen height
  contentBackgroundColor,
  contentPaddingHorizontal = 20,
  contentPaddingVertical = 10,
  contentContainerPaddingBottom = Platform.OS === 'ios' ? 20 : 20,
  avoidKeyboard = false,
  keyboardVerticalOffset = 0,
  safeAreaEdges = ['top'],
}) => {
  const overlayOpacity = useRef(new Animated.Value(0)).current; // For overlay fade

  useEffect(() => {
    if (isVisible) {
      // Reset opacity to 0 when modal is about to show, before onShow animation
      overlayOpacity.setValue(0);
    }
    // Fade-out is handled by handleClosePress before onClose is called
  }, [isVisible, overlayOpacity]);

  const handleFadeIn = () => {
    Animated.timing(overlayOpacity, {
      toValue: 0.5, // Target opacity for the overlay
      duration: 200, // Duration of the fade-in animation
      useNativeDriver: true, // Opacity animations are native-driver friendly
    }).start();
  };

  const handleClosePress = () => {
    Animated.timing(overlayOpacity, {
      toValue: 0, // Target opacity (fully transparent)
      duration: 200, // Duration of the fade-out animation
      useNativeDriver: true,
    }).start(() => {
      onClose(); // Call the original onClose prop AFTER the animation
    });
  };

  return (
    <Modal
      animationType="slide"
      transparent={true} // Key change: Modal itself is transparent
      visible={isVisible}
      presentationStyle="overFullScreen"
      onShow={handleFadeIn} // Trigger fade-in after slide
      onRequestClose={handleClosePress} // Handle Android back button
    >
      {/* 1. Full-screen animated overlay */}
      <Animated.View
        style={[
          styles.fullScreenAnimatedOverlay,
          { opacity: overlayOpacity },
        ]}
      />

      {/* 2. Transparent pressable overlay to close when tapping outside */}
      <Pressable style={styles.touchCloseBackdrop} onPress={handleClosePress} />

      {/* 3. Non-touchable container for the tray at bottom */}
      <View style={styles.touchableContainerForTray}>
        {/* 4. The actual tray content */}
        <View
          style={[
            styles.modalView, 
            { 
              height: screenHeight * customHeight,
              maxHeight: screenHeight * 0.9 // Safety limit to prevent overflow
            }
          ]}
        >
          {/* Header Tab Area */}
          <View style={[styles.headerTab, { backgroundColor: headerTabColor }]}>
            <TouchableOpacity
              onPress={handleClosePress} // Use new handler for chevron
              style={{
                ...styles.chevronButtonWrapper,
                backgroundColor: headerTabColor === 'white'
                  ? '#C8A8E9'
                  : styles.chevronButtonWrapper.backgroundColor
              }}
            >
              <ChevronDown size={24} color={headerTabColor === 'white' ? 'black' : 'black'} />
            </TouchableOpacity>
          </View>
          {/* White content area below the tab */}
          <View style={[
            styles.contentContainer,
            { paddingBottom: contentContainerPaddingBottom },
            headerTabColor === 'white' && styles.contentContainerPaywall,
            contentBackgroundColor ? { backgroundColor: contentBackgroundColor } : null,
          ]}>
            {avoidKeyboard ? (
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={keyboardVerticalOffset}
              >
                <SafeAreaView style={styles.safeAreaContent} edges={safeAreaEdges}>
                  {title.trim() !== "" && <Text style={styles.titleText}>{title}</Text>}
                  <View style={[
                    styles.contentArea,
                    headerTabColor === 'white' && styles.contentAreaPaywall,
                    { paddingHorizontal: contentPaddingHorizontal, paddingVertical: contentPaddingVertical }
                  ]}>
                    {children}
                  </View>
                  {onConfirm && (
                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        { marginHorizontal: contentPaddingHorizontal }
                      ]}
                      onPress={onConfirm}
                    >
                      <Text style={styles.confirmButtonText}>{confirmButtonText}</Text>
                    </TouchableOpacity>
                  )}
                </SafeAreaView>
              </KeyboardAvoidingView>
            ) : (
              <SafeAreaView style={styles.safeAreaContent} edges={safeAreaEdges}>
                {title.trim() !== "" && <Text style={styles.titleText}>{title}</Text>}
                <View style={[
                  styles.contentArea,
                  headerTabColor === 'white' && styles.contentAreaPaywall,
                  { paddingHorizontal: contentPaddingHorizontal, paddingVertical: contentPaddingVertical }
                ]}>
                  {children}
                </View>
                {onConfirm && (
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      { marginHorizontal: contentPaddingHorizontal }
                    ]}
                    onPress={onConfirm}
                  >
                    <Text style={styles.confirmButtonText}>{confirmButtonText}</Text>
                  </TouchableOpacity>
                )}
              </SafeAreaView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // overlay: { // This style is no longer used directly for the background
  //   flex: 1,
  //   backgroundColor: 'rgba(0, 0, 0, 0.5)',
  //   justifyContent: 'flex-end',
  // },
  fullScreenAnimatedOverlay: { // New style for the animated background
    ...StyleSheet.absoluteFillObject, // Covers the entire screen
    backgroundColor: 'black', // The color that will be faded (opacity controlled by Animated.Value)
  },
  touchCloseBackdrop: {
    ...StyleSheet.absoluteFillObject,
    // Transparent touch-catcher above the animated backdrop but below the tray
  },
  touchableContainerForTray: { // New style for the container that positions the tray
    flex: 1,
    justifyContent: 'flex-end', // Aligns modalView (tray) to the bottom
    // This view is transparent, allowing fullScreenAnimatedOverlay to be seen.
  },
  modalView: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 2,
    borderColor: 'black',
    borderBottomWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  headerTab: { 
    height: 50,
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'black',
  },
  chevronButtonWrapper: { 
    width: 36,
    height: 36,
    borderRadius: 18, 
    // Subtle outline consistent with other handles
    borderWidth: 1.25,
    borderColor: 'black',
    borderBottomWidth: 1.25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainerPaywall: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  safeAreaContent: {
    flex: 1,
  },
  titleText: {
    fontSize: 22,
    fontFamily: 'Geist-Regular',
    color: 'black',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  contentArea: {
    flex: 1,
  },
  contentAreaPaywall: {
    flex: 1,
    paddingVertical: 0,
  },
  confirmButton: { 
    backgroundColor: "#e0e0e0",
    borderRadius: 12,
    paddingVertical: 16, 
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20, 
    borderWidth: 2, 
    borderColor: "black",
    borderBottomWidth: 4, 
    alignSelf: 'stretch',
  },
  confirmButtonText: {
    color: "black", 
    fontFamily: 'Geist-Regular',
    fontSize: 18,
  },
});

export default PopUpTray;
