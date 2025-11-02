import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
  Platform,
  Animated 
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { BlurView } from 'expo-blur';
import { 
  Camera, 
  Image as ImageIcon, 
  X, 
  Send, 
  Download,
  Share2,
  ZoomIn 
} from 'lucide-react-native';
import { COLORS } from '../../constants/theme';
import { logger } from '../../src/utils/logger';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PhotoMessageProps {
  messageId: string;
  imageUri: string;
  thumbnailUri?: string;
  caption?: string;
  metadata?: {
    width: number;
    height: number;
    size: number;
  };
  isFromCurrentUser: boolean;
  timestamp: string;
  onImagePress?: () => void;
}

interface PhotoPickerProps {
  visible: boolean;
  onClose: () => void;
  onPhotoSelected: (uri: string, caption?: string) => void;
}

interface PhotoViewerProps {
  visible: boolean;
  imageUri: string;
  caption?: string;
  onClose: () => void;
  onSave?: () => void;
  onShare?: () => void;
}

const PhotoMessage: React.FC<PhotoMessageProps> = ({
  messageId,
  imageUri,
  thumbnailUri,
  caption,
  metadata,
  isFromCurrentUser,
  timestamp,
  onImagePress,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const calculateImageSize = () => {
    if (!metadata) return { width: 200, height: 200 };
    
    const maxWidth = screenWidth * 0.6;
    const maxHeight = screenHeight * 0.4;
    const aspectRatio = metadata.width / metadata.height;
    
    let displayWidth = maxWidth;
    let displayHeight = displayWidth / aspectRatio;
    
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * aspectRatio;
    }
    
    return { width: Math.round(displayWidth), height: Math.round(displayHeight) };
  };

  const displaySize = calculateImageSize();

  const handleImageLoad = () => {
    setImageLoaded(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={[
      styles.container,
      isFromCurrentUser ? styles.ownMessage : styles.otherMessage
    ]}>
      <TouchableOpacity 
        style={styles.imageContainer}
        onPress={onImagePress}
        activeOpacity={0.9}
      >
        <View style={[styles.imageWrapper, displaySize]}>
          {!imageLoaded && (
            <View style={[styles.imagePlaceholder, displaySize]}>
              <ImageIcon size={24} color={COLORS.SECONDARY_TEXT} />
            </View>
          )}
          
          <Animated.View style={{ opacity: fadeAnim }}>
            <Image
              source={{ uri: thumbnailUri || imageUri }}
              style={[styles.image, displaySize]}
              contentFit="cover"
              onLoad={handleImageLoad}
              onError={(error) => {
                logger.error('Failed to load photo message', new Error(error.error), { messageId, imageUri }, 'MESSAGING');
              }}
            />
          </Animated.View>
          
          {/* Zoom indicator overlay */}
          <View style={styles.zoomOverlay}>
            <ZoomIn size={16} color={COLORS.WHITE_CARD} />
          </View>
        </View>
      </TouchableOpacity>

      {caption && (
        <View style={styles.captionContainer}>
          <Text style={[
            styles.captionText,
            { color: isFromCurrentUser ? COLORS.WHITE_CARD : COLORS.DARK_TEXT }
          ]}>
            {caption}
          </Text>
        </View>
      )}

      {metadata && (
        <View style={styles.metadataContainer}>
          <Text style={[
            styles.metadataText,
            { color: isFromCurrentUser ? 'rgba(255, 255, 255, 0.7)' : COLORS.SECONDARY_TEXT }
          ]}>
            {metadata.width} × {metadata.height} • {formatFileSize(metadata.size)}
          </Text>
        </View>
      )}
    </View>
  );
};

export const PhotoPicker: React.FC<PhotoPickerProps> = ({
  visible,
  onClose,
  onPhotoSelected,
}) => {
  const [captionText, setCaptionText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take photos');
      return false;
    }
    
    if (libraryStatus !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed to select photos');
      return false;
    }
    
    return true;
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 1024 } }, // Resize to max width of 1024px
        ],
        {
          compress: 0.8, // 80% quality
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      return manipulatedImage.uri;
    } catch (error) {
      logger.error('Failed to compress image', error instanceof Error ? error : undefined, { uri }, 'MESSAGING');
      return uri; // Return original if compression fails
    }
  };

  const takePhoto = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      setIsProcessing(true);
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false, // Remove EXIF data for privacy
      });

      if (!result.canceled && result.assets[0]) {
        const compressedUri = await compressImage(result.assets[0].uri);
        setSelectedImage(compressedUri);
      }
    } catch (error) {
      logger.error('Failed to take photo', error instanceof Error ? error : undefined, {}, 'MESSAGING');
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      setIsProcessing(false);
    }
  };

  const pickFromLibrary = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      setIsProcessing(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false, // Remove EXIF data for privacy
      });

      if (!result.canceled && result.assets[0]) {
        const compressedUri = await compressImage(result.assets[0].uri);
        setSelectedImage(compressedUri);
      }
    } catch (error) {
      logger.error('Failed to pick photo', error instanceof Error ? error : undefined, {}, 'MESSAGING');
      Alert.alert('Error', 'Failed to select photo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = () => {
    if (selectedImage) {
      onPhotoSelected(selectedImage, captionText.trim() || undefined);
      setSelectedImage(null);
      setCaptionText('');
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    setCaptionText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.pickerContainer}>
        {/* Header */}
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={COLORS.DARK_TEXT} />
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>Share Photo</Text>
          {selectedImage && (
            <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
              <Send size={20} color={COLORS.WHITE_CARD} />
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        <View style={styles.pickerContent}>
          {selectedImage ? (
            <View style={styles.selectedImageContainer}>
              <Image
                source={{ uri: selectedImage }}
                style={styles.selectedImage}
                contentFit="contain"
              />
            </View>
          ) : (
            <View style={styles.pickerOptions}>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={takePhoto}
                disabled={isProcessing}
              >
                <Camera size={32} color={COLORS.DARK_TEXT} />
                <Text style={styles.optionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={pickFromLibrary}
                disabled={isProcessing}
              >
                <ImageIcon size={32} color={COLORS.DARK_TEXT} />
                <Text style={styles.optionText}>Choose from Library</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export const PhotoViewer: React.FC<PhotoViewerProps> = ({
  visible,
  imageUri,
  caption,
  onClose,
  onSave,
  onShare,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleImageLoad = () => {
    setImageLoaded(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.viewerContainer}>
        <BlurView intensity={100} style={styles.viewerBlur}>
          {/* Header */}
          <View style={styles.viewerHeader}>
            <TouchableOpacity onPress={onClose} style={styles.viewerCloseButton}>
              <X size={24} color={COLORS.WHITE_CARD} />
            </TouchableOpacity>
            
            <View style={styles.viewerActions}>
              {onShare && (
                <TouchableOpacity onPress={onShare} style={styles.viewerActionButton}>
                  <Share2 size={20} color={COLORS.WHITE_CARD} />
                </TouchableOpacity>
              )}
              {onSave && (
                <TouchableOpacity onPress={onSave} style={styles.viewerActionButton}>
                  <Download size={20} color={COLORS.WHITE_CARD} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Image */}
          <View style={styles.viewerImageContainer}>
            {!imageLoaded && (
              <View style={styles.viewerImagePlaceholder}>
                <ImageIcon size={48} color={COLORS.WHITE_CARD} />
              </View>
            )}
            
            <Animated.View style={{ opacity: fadeAnim }}>
              <Image
                source={{ uri: imageUri }}
                style={styles.viewerImage}
                contentFit="contain"
                onLoad={handleImageLoad}
              />
            </Animated.View>
          </View>

          {/* Caption */}
          {caption && (
            <View style={styles.viewerCaptionContainer}>
              <Text style={styles.viewerCaptionText}>{caption}</Text>
            </View>
          )}
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: '80%',
    overflow: 'hidden',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  imageContainer: {
    position: 'relative',
  },
  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.BUTTON_PRESS_BG,
  },
  imagePlaceholder: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    zIndex: 1,
  },
  image: {
    backgroundColor: 'transparent',
  },
  zoomOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
  },
  captionContainer: {
    padding: 12,
    paddingTop: 8,
  },
  captionText: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    lineHeight: 18,
  },
  metadataContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  metadataText: {
    fontSize: 10,
    fontFamily: 'Geist-Medium',
  },
  
  // Photo Picker Styles
  pickerContainer: {
    flex: 1,
    backgroundColor: COLORS.WHITE_CARD,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: COLORS.WHITE_CARD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BUTTON_PRESS_BG,
  },
  closeButton: {
    padding: 8,
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: 'Geist-Regular',
    color: COLORS.DARK_TEXT,
  },
  sendButton: {
    backgroundColor: COLORS.DARK_TEXT,
    borderRadius: 20,
    padding: 10,
  },
  pickerContent: {
    flex: 1,
  },
  pickerOptions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  optionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BUTTON_PRESS_BG,
    borderRadius: 20,
    padding: 32,
    minWidth: 160,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'Geist-Medium',
    color: COLORS.DARK_TEXT,
  },
  selectedImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectedImage: {
    width: screenWidth - 40,
    height: screenHeight * 0.6,
    borderRadius: 12,
  },

  // Photo Viewer Styles
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  viewerBlur: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  viewerCloseButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  viewerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewerActionButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  viewerImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  viewerImagePlaceholder: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  viewerImage: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  viewerCaptionContainer: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  viewerCaptionText: {
    color: COLORS.WHITE_CARD,
    fontSize: 16,
    fontFamily: 'Geist-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default PhotoMessage;