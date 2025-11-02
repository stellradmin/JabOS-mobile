import React, { useState, useEffect } from 'react';
import { Image, View, Text, StyleSheet, ImageProps, ImageSourcePropType } from 'react-native';
import { Camera } from 'lucide-react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";

interface SafeImageProps extends Omit<ImageProps, 'source'> {
  source: ImageSourcePropType;
  fallbackText?: string;
  fallbackIcon?: boolean;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: any) => void;
}

const SafeImage: React.FC<SafeImageProps> = ({
  source,
  style,
  fallbackText = 'U',
  fallbackIcon = true,
  onLoadStart,
  onLoadEnd,
  onError,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [validSource, setValidSource] = useState<ImageSourcePropType | null>(null);

  useEffect(() => {
    // Validate source
    if (!source || (typeof source === 'object' && 'uri' in source && !source.uri)) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Additional validation for URI sources
    if (typeof source === 'object' && 'uri' in source && source.uri) {
      const uri = source.uri;
      
      // Check if URI is valid
      if (typeof uri !== 'string' || uri.trim() === '') {
        setHasError(true);
        setIsLoading(false);
        return;
      }

      // Basic URI validation
      const validPatterns = [
        /^file:\/\//,
        /^content:\/\//,
        /^assets-library:\/\//,
        /^ph:\/\//,
        /^https?:\/\//,
        /^data:image\//,
      ];

      const isValid = validPatterns.some(pattern => pattern.test(uri));
      if (!isValid && !uri.startsWith('/')) {
        logWarn('Invalid image URI format:', "Warning", uri);
        setHasError(true);
        setIsLoading(false);
        return;
      }
    }

    setValidSource(source);
    setHasError(false);
  }, [source]);

  const handleError = (error: any) => {
    logDebug('SafeImage error:', "Debug", error?.nativeEvent?.error || 'Unknown error');
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    onLoadStart?.();
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
    onLoadEnd?.();
  };

  if (hasError || !validSource) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        {fallbackIcon ? (
          <Camera size={40} color="#666" />
        ) : (
          <Text style={styles.fallbackText}>{fallbackText}</Text>
        )}
      </View>
    );
  }

  return (
    <Image
      {...props}
      source={validSource}
      style={style}
      onError={handleError}
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
    />
  );
};

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fallbackText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#666',
  },
});

export default SafeImage;