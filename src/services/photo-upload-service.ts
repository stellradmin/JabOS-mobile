// Photo upload service for managing profile pictures
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Platform, NativeModules } from 'react-native';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  errorType?: 'permission' | 'network' | 'storage' | 'file' | 'timeout' | 'unknown';
}

export interface PhotoUploadOptions {
  quality?: number;
  aspect?: [number, number];
  allowsEditing?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

// Request camera permissions with better error handling
export const requestPermissions = async (): Promise<{ granted: boolean; message?: string }> => {
  if (Platform.OS === 'web') {
    return { granted: true };
  }

  try {
    // Check current permission status first
    const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return { granted: true };
    }
    
    // Only request if not already granted
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      const platformMessage = Platform.select({
        ios: 'To upload photos, please go to Settings > Privacy > Photos and enable access for this app.',
        android: 'Gallery access is required. Please enable it in Settings > Apps > Permissions.',
        default: 'Gallery access is required to upload photos. Please enable it in your device settings.'
      });
      
      return { 
        granted: false, 
        message: platformMessage
      };
    }
    return { granted: true };
  } catch (error) {
    logError('Error requesting media library permissions:', "Error", error);
    
    // Handle specific platform errors
    if (Platform.OS === 'ios' && error instanceof Error && error.message.includes('PHPhotoLibrary')) {
      return {
        granted: false,
        message: 'Photo library access is required. Please enable it in Settings > Privacy > Photos.'
      };
    }
    
    return { 
      granted: false, 
      message: 'Unable to request gallery permissions. Please check your device settings.' 
    };
  }
};

// Request camera permissions with better error handling
export const requestCameraPermissions = async (): Promise<{ granted: boolean; message?: string }> => {
  if (Platform.OS === 'web') {
    return { granted: true };
  }

  try {
    // Check current permission status first
    const { status: existingStatus } = await ImagePicker.getCameraPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return { granted: true };
    }
    
    // Only request if not already granted
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      const platformMessage = Platform.select({
        ios: 'To take photos, please go to Settings > Privacy > Camera and enable access for this app.',
        android: 'Camera access is required. Please enable it in Settings > Apps > Permissions.',
        default: 'Camera access is required to take photos. Please enable it in your device settings.'
      });
      
      return { 
        granted: false, 
        message: platformMessage
      };
    }
    return { granted: true };
  } catch (error) {
    logError('Error requesting camera permissions:', "Error", error);
    
    // Handle specific platform errors
    if (Platform.OS === 'ios' && error instanceof Error && error.message.includes('AVCaptureDevice')) {
      return {
        granted: false,
        message: 'Camera access is required. Please enable it in Settings > Privacy > Camera.'
      };
    }
    
    return { 
      granted: false, 
      message: 'Unable to request camera permissions. Please check your device settings.' 
    };
  }
};

// Pick image from library
export const pickImage = async (): Promise<string | null> => {
  const permissionResult = await requestPermissions();
  if (!permissionResult.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
};

// Upload image to Supabase storage
export const uploadImage = async (
  uri: string,
  userId: string,
  bucket: string = 'profile-pictures'
): Promise<UploadResult> => {
  try {
    // Create a unique filename with user isolation for security
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `users/${userId}/${fileName}`;

    // Convert URI to blob for upload
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload to Supabase storage
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });

    if (error) {
      logError('Upload error:', "Error", error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return { success: true, url: publicUrl };
  } catch (error) {
    logError('Upload error:', "Error", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Update user's avatar URL in the database
export const updateUserAvatar = async (
  userId: string,
  avatarUrl: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (error) {
      logError('Error updating avatar:', "Error", error);
      return false;
    }

    return true;
  } catch (error) {
    logError('Error updating avatar:', "Error", error);
    return false;
  }
};

// Track active operations to prevent race conditions
let activeOperations = new Set<string>();

// Detect if running in Expo Go (native modules not available)
const isRunningInExpoGo = (): boolean => {
  // In Expo Go, native modules are not properly linked
  return !NativeModules.ExponentImagePicker && !NativeModules.EXImagePicker;
};

// Get safe quality setting based on environment
const getSafeQuality = (requestedQuality?: number): number => {
  if (isRunningInExpoGo()) {
    // Expo Go requires very low quality to prevent crashes
    logDebug('[PhotoService] Running in Expo Go - using reduced quality (0.2, "Debug")');
    return 0.2;
  }
  // Development builds can handle higher quality
  return requestedQuality ?? 0.8;
};

// Launch image picker with retry mechanism for Expo Go
const launchImagePickerWithRetry = async (
  launchFunction: (options: any) => Promise<ImagePicker.ImagePickerResult>,
  options: any,
  logPrefix: string
): Promise<ImagePicker.ImagePickerResult> => {
  const isExpoGo = isRunningInExpoGo();
  
  if (!isExpoGo) {
    // In development builds, just launch normally
    return await launchFunction(options);
  }
  
  // In Expo Go, try with progressively lower quality
  const qualities = [0.2, 0.1, 0.05];
  let lastError: Error | null = null;
  
  for (let i = 0; i < qualities.length; i++) {
    const quality = qualities[i];
    const attemptOptions = { ...options, quality };
    
    try {
      logDebug(`${logPrefix} Attempt ${i + 1} with quality: ${quality}`, "Debug");
      const result = await launchFunction(attemptOptions);
      logDebug(`${logPrefix} Success on attempt ${i + 1}`, "Debug");
      return result;
    } catch (error: any) {
      lastError = error;
      logWarn(`${logPrefix} Attempt ${i + 1} failed:`, "Warning", error.message);
      
      // If it's the last attempt, throw the error
      if (i === qualities.length - 1) {
        break;
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // All attempts failed
  throw new Error(`Image picker failed after ${qualities.length} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
};

// Validate image URI
const isValidImageUri = (uri: string | null | undefined): boolean => {
  if (!uri || typeof uri !== 'string') return false;
  
  // Check for common URI patterns
  const validPatterns = [
    /^file:\/\//,           // Local file
    /^content:\/\//,        // Android content provider
    /^assets-library:\/\//, // iOS assets
    /^ph:\/\//,            // iOS photo library
    /^https?:\/\//,        // Web URLs
    /^data:image\//,       // Data URLs
  ];
  
  return validPatterns.some(pattern => pattern.test(uri));
};

// Pick image from camera
export const pickImageFromCamera = async (options?: PhotoUploadOptions): Promise<string | null> => {
  logDebug('[PhotoService-Camera] 1. pickImageFromCamera called', "Debug");
  logDebug('[PhotoService-Camera] 1.1 Options:', "Debug", JSON.stringify(options));
  logDebug('[PhotoService-Camera] 1.2 Platform:', "Debug", Platform.OS);
  
  // Check ImagePicker availability
  logDebug('[PhotoService-Camera] 2. Checking ImagePicker availability', "Debug");
  logDebug('[PhotoService-Camera] 2.1 ImagePicker exists:', "Debug", !!ImagePicker);
  logDebug('[PhotoService-Camera] 2.2 launchCameraAsync exists:', "Debug", typeof ImagePicker?.launchCameraAsync);
  logDebug('[PhotoService-Camera] 2.3 requestCameraPermissionsAsync available:', "Debug", typeof ImagePicker?.requestCameraPermissionsAsync);
  
  // iOS-specific checks
  if (Platform.OS === 'ios') {
    logDebug('[PhotoService-iOS] Checking iOS-specific requirements', "Debug");
    logDebug('[PhotoService-iOS] Available native modules:', "Debug", Object.keys(NativeModules));
    logDebug('[PhotoService-iOS] ExponentImagePicker module:', "Debug", !!NativeModules.ExponentImagePicker);
    logDebug('[PhotoService-iOS] EXImagePicker module:', "Debug", !!NativeModules.EXImagePicker);
    logDebug('[PhotoService-iOS] ExponentImagePicker methods:', "Debug", NativeModules.ExponentImagePicker ? Object.keys(NativeModules.ExponentImagePicker) : 'N/A');
    
    // Check if we can access native camera functionality
    try {
      logDebug('[PhotoService-iOS] ImagePicker MediaTypeOptions:', "Debug", ImagePicker.MediaTypeOptions);
      logDebug('[PhotoService-iOS] MediaTypeOptions.Images:', "Debug", ImagePicker.MediaTypeOptions.Images);
    } catch (optionsError) {
      logError('[PhotoService-iOS] Error accessing MediaTypeOptions:', "Error", optionsError);
    }
  }
  
  // Prevent concurrent operations
  if (activeOperations.has('camera')) {
    logWarn('[PhotoService-Camera] 3. Camera operation already in progress', "Warning");
    return null;
  }
  
  activeOperations.add('camera');
  logDebug('[PhotoService-Camera] 4. Added camera to active operations', "Debug");
  
  try {
    logDebug('[PhotoService-Camera] 5. Requesting camera permissions', "Debug");
    const permissionResult = await requestCameraPermissions();
    logDebug('[PhotoService-Camera] 5.1 Permission result:', "Debug", permissionResult);
    
    if (!permissionResult.granted) {
      logDebug('[PhotoService-Camera] 5.2 Permission denied:', "Debug", permissionResult.message);
      throw new Error(permissionResult.message || 'Camera permission not granted');
    }

    logDebug('[PhotoService-Camera] 6. Launching camera with options:', "Debug");
    logDebug('[PhotoService-Camera] 6.1 mediaTypes:', "Debug", ImagePicker.MediaTypeOptions.Images);
    logDebug('[PhotoService-Camera] 6.2 Conservative mode - editing disabled for stability', "Debug");
    
    // Use safe settings for Expo Go
    const isExpoGo = isRunningInExpoGo();
    const quality = getSafeQuality(options?.quality);
    const allowsEditing = isExpoGo ? false : (options?.allowsEditing ?? true);
    
    logDebug('[PhotoService-Camera] 6.3 Environment:', "Debug", isExpoGo ? 'Expo Go' : 'Development Build');
    logDebug('[PhotoService-Camera] 6.4 Quality:', "Debug", quality);
    logDebug('[PhotoService-Camera] 6.5 Allows editing:', "Debug", allowsEditing);
    
    const pickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing,
      aspect: options?.aspect ?? [1, 1],
      quality,
      base64: false, // Don't load base64 to save memory
      exif: false, // Don't include EXIF data to save memory
    };
    
    const result = await launchImagePickerWithRetry(
      ImagePicker.launchCameraAsync,
      pickerOptions,
      '[PhotoService-Camera]'
    );

    logDebug('[PhotoService-Camera] 7. Camera result received', "Debug");
    logDebug('[PhotoService-Camera] 7.1 Result canceled:', "Debug", result.canceled);
    logDebug('[PhotoService-Camera] 7.2 Assets count:', "Debug", result.assets?.length || 0);
    
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      logDebug('[PhotoService-Camera] 8. Processing image URI', "Debug");
      logDebug('[PhotoService-Camera] 8.1 URI length:', "Debug", uri?.length || 0);
      logDebug('[PhotoService-Camera] 8.2 URI prefix:', "Debug", uri?.substring(0, 50));
      
      // Validate URI before returning
      if (!isValidImageUri(uri)) {
        logError('[PhotoService-Camera] 8.3 Invalid image URI received:', "Error", uri);
        throw new Error('Invalid image selected. Please try again.');
      }
      
      logDebug('[PhotoService-Camera] 9. Returning valid URI', "Debug");
      return uri;
    }
    
    logDebug('[PhotoService-Camera] 10. No image selected or operation canceled', "Debug");
    return null;
  } catch (error: any) {
    logError('[PhotoService-Camera] ERROR:', "Error", error);
    logError('[PhotoService-Camera] Error type:', "Error", error?.constructor?.name);
    logError('[PhotoService-Camera] Error message:', "Error", error?.message);
    logError('[PhotoService-Camera] Error stack:', "Error", error?.stack);
    throw new Error(error?.message || 'Failed to access camera');
  } finally {
    logDebug('[PhotoService-Camera] 11. Cleanup - removing from active operations', "Debug");
    activeOperations.delete('camera');
  }
};

// Pick image from gallery
export const pickImageFromGallery = async (options?: PhotoUploadOptions): Promise<string | null> => {
  logDebug('[PhotoService-Gallery] 1. pickImageFromGallery called', "Debug");
  logDebug('[PhotoService-Gallery] 1.1 Options:', "Debug", JSON.stringify(options));
  logDebug('[PhotoService-Gallery] 1.2 Platform:', "Debug", Platform.OS);
  
  // Check ImagePicker availability
  logDebug('[PhotoService-Gallery] 2. Checking ImagePicker availability', "Debug");
  logDebug('[PhotoService-Gallery] 2.1 ImagePicker exists:', "Debug", !!ImagePicker);
  logDebug('[PhotoService-Gallery] 2.2 launchImageLibraryAsync exists:', "Debug", typeof ImagePicker?.launchImageLibraryAsync);
  logDebug('[PhotoService-Gallery] 2.3 requestMediaLibraryPermissionsAsync available:', "Debug", typeof ImagePicker?.requestMediaLibraryPermissionsAsync);
  
  // iOS-specific checks
  if (Platform.OS === 'ios') {
    logDebug('[PhotoService-iOS-Gallery] Checking iOS-specific requirements', "Debug");
    logDebug('[PhotoService-iOS-Gallery] Available native modules:', "Debug", Object.keys(NativeModules));
    logDebug('[PhotoService-iOS-Gallery] ExponentImagePicker module:', "Debug", !!NativeModules.ExponentImagePicker);
    logDebug('[PhotoService-iOS-Gallery] EXImagePicker module:', "Debug", !!NativeModules.EXImagePicker);
    
    // Check if we can access native gallery functionality
    try {
      logDebug('[PhotoService-iOS-Gallery] ImagePicker MediaTypeOptions:', "Debug", ImagePicker.MediaTypeOptions);
      logDebug('[PhotoService-iOS-Gallery] MediaTypeOptions.Images:', "Debug", ImagePicker.MediaTypeOptions.Images);
    } catch (optionsError) {
      logError('[PhotoService-iOS-Gallery] Error accessing MediaTypeOptions:', "Error", optionsError);
    }
  }
  
  // Prevent concurrent operations
  if (activeOperations.has('gallery')) {
    logWarn('[PhotoService-Gallery] 3. Gallery operation already in progress', "Warning");
    return null;
  }
  
  activeOperations.add('gallery');
  logDebug('[PhotoService-Gallery] 4. Added gallery to active operations', "Debug");
  
  try {
    logDebug('[PhotoService-Gallery] 5. Requesting gallery permissions', "Debug");
    const permissionResult = await requestPermissions();
    logDebug('[PhotoService-Gallery] 5.1 Permission result:', "Debug", permissionResult);
    
    if (!permissionResult.granted) {
      logDebug('[PhotoService-Gallery] 5.2 Permission denied:', "Debug", permissionResult.message);
      throw new Error(permissionResult.message || 'Gallery permission not granted');
    }

    logDebug('[PhotoService-Gallery] 6. Launching gallery with options:', "Debug");
    logDebug('[PhotoService-Gallery] 6.1 mediaTypes:', "Debug", ImagePicker.MediaTypeOptions.Images);
    logDebug('[PhotoService-Gallery] 6.2 Conservative mode - editing disabled for stability', "Debug");
    
    // Use safe settings for Expo Go
    const isExpoGo = isRunningInExpoGo();
    const quality = getSafeQuality(options?.quality);
    const allowsEditing = isExpoGo ? false : (options?.allowsEditing ?? true);
    
    logDebug('[PhotoService-Gallery] 6.3 Environment:', "Debug", isExpoGo ? 'Expo Go' : 'Development Build');
    logDebug('[PhotoService-Gallery] 6.4 Quality:', "Debug", quality);
    logDebug('[PhotoService-Gallery] 6.5 Allows editing:', "Debug", allowsEditing);
    
    const pickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing,
      aspect: options?.aspect ?? [1, 1],
      quality,
      base64: false, // Don't load base64 to save memory
      exif: false, // Don't include EXIF data to save memory
    };
    
    const result = await launchImagePickerWithRetry(
      ImagePicker.launchImageLibraryAsync,
      pickerOptions,
      '[PhotoService-Gallery]'
    );

    logDebug('[PhotoService-Gallery] 7. Gallery result received', "Debug");
    logDebug('[PhotoService-Gallery] 7.1 Result canceled:', "Debug", result.canceled);
    logDebug('[PhotoService-Gallery] 7.2 Assets count:', "Debug", result.assets?.length || 0);
    
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      logDebug('[PhotoService-Gallery] 8. Processing image URI', "Debug");
      logDebug('[PhotoService-Gallery] 8.1 URI length:', "Debug", uri?.length || 0);
      logDebug('[PhotoService-Gallery] 8.2 URI prefix:', "Debug", uri?.substring(0, 50));
      
      // Validate URI before returning
      if (!isValidImageUri(uri)) {
        logError('[PhotoService-Gallery] 8.3 Invalid image URI received:', "Error", uri);
        throw new Error('Invalid image selected. Please try again.');
      }
      
      logDebug('[PhotoService-Gallery] 9. Returning valid URI', "Debug");
      return uri;
    }
    
    logDebug('[PhotoService-Gallery] 10. No image selected or operation canceled', "Debug");
    return null;
  } catch (error: any) {
    logError('[PhotoService-Gallery] ERROR:', "Error", error);
    logError('[PhotoService-Gallery] Error type:', "Error", error?.constructor?.name);
    logError('[PhotoService-Gallery] Error message:', "Error", error?.message);
    logError('[PhotoService-Gallery] Error stack:', "Error", error?.stack);
    throw new Error(error?.message || 'Failed to access gallery');
  } finally {
    logDebug('[PhotoService-Gallery] 11. Cleanup - removing from active operations', "Debug");
    activeOperations.delete('gallery');
  }
};

// Helper function for retry logic
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      logDebug(`Attempt ${attempt} failed:`, "Debug", lastError.message);
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
    }
  }
  
  throw lastError!;
};

// Upload image to Supabase storage with proper bucket handling and retry logic
export const uploadImageToSupabase = async (
  uri: string,
  userId: string,
  bucket: string = 'profile-pictures'
): Promise<UploadResult> => {
  try {
    // Validate inputs
    if (!uri || !userId) {
      return {
        success: false,
        error: 'Missing required parameters',
        errorType: 'file'
      };
    }
    
    // Validate URI format
    if (!isValidImageUri(uri)) {
      return {
        success: false,
        error: 'Invalid image format',
        errorType: 'file'
      };
    }
    
    return await retryOperation(async () => {
      // Create a unique filename with user isolation for security
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `users/${userId}/${fileName}`;

      // Convert URI to blob for upload with better error handling
      let response: Response;
      try {
        // Add timeout to fetch operation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        response = await fetch(uri, { signal: controller.signal });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Image fetch timeout. Please try with a smaller image.');
        }
        throw new Error(`Network error while fetching image: ${fetchError instanceof Error ? fetchError.message : 'Unknown network error'}`);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      let blob: Blob;
      try {
        blob = await response.blob();
      } catch (blobError) {
        throw new Error(`Failed to process image data: ${blobError instanceof Error ? blobError.message : 'Unknown processing error'}`);
      }
      
      if (blob.size === 0) {
        throw new Error('Image file is empty');
      }
      
      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (blob.size > maxSize) {
        throw new Error(`Image too large (${(blob.size / 1024 / 1024).toFixed(2)}MB). Please choose a smaller image.`);
      }

      // Upload to Supabase storage
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return { success: true, url: publicUrl };
    }, 3, 1000);
  } catch (error) {
    logError('Upload error after retries:', "Error", error);
    
    let errorType: UploadResult['errorType'] = 'unknown';
    let errorMessage = 'Unknown upload error';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.message.includes('Network error') || error.message.includes('fetch')) {
        errorType = 'network';
      } else if (error.message.includes('too large')) {
        errorType = 'file';
      } else if (error.message.includes('timeout')) {
        errorType = 'timeout';
      } else if (error.message.includes('Upload failed')) {
        errorType = 'storage';
      }
    }
    
    return { 
      success: false, 
      error: errorMessage,
      errorType
    };
  }
};

// Delete image from Supabase storage
export const deleteImageFromSupabase = async (imageUrl: string): Promise<boolean> => {
  try {
    if (!imageUrl.includes('supabase')) {
      return true; // Not a Supabase URL, nothing to delete
    }

    // Extract the file path from the URL (handle both old and new path formats)
    let urlParts = imageUrl.split('/storage/v1/object/public/profile-pictures/');
    if (urlParts.length < 2) {
      logError('Invalid Supabase URL format', "Error");
      return false;
    }

    const filePath = urlParts[1];
    
    const { error } = await supabase.storage
      .from('profile-pictures')
      .remove([filePath]);

    if (error) {
      logError('Delete error:', "Error", error);
      return false;
    }

    return true;
  } catch (error) {
    logError('Delete error:', "Error", error);
    return false;
  }
};

// Complete photo upload flow with source selection
export const uploadPhotoFlow = async (
  userId: string,
  source: 'camera' | 'gallery',
  options?: PhotoUploadOptions
): Promise<UploadResult> => {
  // Wrap entire function in try-catch for safety
  try {
    // Validate inputs
    if (!userId) {
      return {
        success: false,
        error: 'User ID is required',
        errorType: 'unknown'
      };
    }

    // Prevent concurrent upload operations
    const operationKey = `upload-${userId}`;
    if (activeOperations.has(operationKey)) {
      return {
        success: false,
        error: 'Upload already in progress',
        errorType: 'unknown'
      };
    }

    activeOperations.add(operationKey);

    try {
      // Step 1: Pick image based on source with error handling
      let imageUri: string | null = null;

      try {
        imageUri = source === 'camera'
          ? await pickImageFromCamera(options)
          : await pickImageFromGallery(options);
      } catch (pickerError) {
        logError(`Error picking image from ${source}:`, "Error", pickerError);

        // Handle specific picker errors
        if (pickerError instanceof Error) {
          if (pickerError.message.includes('User cancelled') ||
              pickerError.message.includes('cancelled')) {
            return {
              success: false,
              error: 'Selection cancelled',
              errorType: 'file'
            };
          }

          if (pickerError.message.includes('permission')) {
            return {
              success: false,
              error: pickerError.message,
              errorType: 'permission'
            };
          }
        }

        throw pickerError; // Re-throw for general error handling
      }

      if (!imageUri) {
        return {
          success: false,
          error: 'No image selected',
          errorType: 'file'
        };
      }

      // Step 2: Upload image with timeout
      logDebug('[PhotoUpload] Uploading to storage', "Debug");
      const uploadWithTimeout = Promise.race([
        uploadImageToSupabase(imageUri, userId),
        new Promise<UploadResult>((resolve) =>
          setTimeout(() => resolve({
            success: false,
            error: 'Upload timeout. Please check your connection and try again.',
            errorType: 'timeout'
          }), 60000)
        )
      ]);

      const uploadResult = await uploadWithTimeout;

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Step 3: Update user's avatar URL in database
      logDebug('[PhotoUpload] Updating user avatar URL', "Debug");
      const avatarUpdated = await updateUserAvatar(userId, uploadResult.url!);

      if (!avatarUpdated) {
        logWarn('[PhotoUpload] Failed to update avatar URL in database', "Warning");
        // Don't fail the upload, just log the warning
      }

      // Return successful result
      logInfo('[PhotoUpload] Photo upload completed successfully', "Info");
      return uploadResult;

    } catch (error) {
      logError('Photo upload flow error:', "Error", error);

      let errorType: UploadResult['errorType'] = 'unknown';
      let errorMessage = 'Failed to upload photo. Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('permission')) {
          errorType = 'permission';
        } else if (error.message.includes('timeout')) {
          errorType = 'timeout';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorType = 'network';
          errorMessage = 'Network error. Please check your connection.';
        } else if (error.message.includes('Invalid image')) {
          errorType = 'file';
        }
      }

      return {
        success: false,
        error: errorMessage,
        errorType
      };
    } finally {
      activeOperations.delete(operationKey);
    }
  } catch (unexpectedError) {
    // Catch any unexpected errors at the top level
    logError('Unexpected error in uploadPhotoFlow:', "Error", unexpectedError);
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
      errorType: 'unknown'
    };
  }
};

// Complete photo upload flow (legacy)
export const uploadProfilePhoto = async (userId: string): Promise<UploadResult> => {
  return uploadPhotoFlow(userId, 'gallery');
};
