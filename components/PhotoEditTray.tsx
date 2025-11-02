import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  PanResponder,
  ScrollView,
} from 'react-native';
import { Camera, Plus } from 'lucide-react-native';
import PopUpTray from './PopUpTray';
import { uploadProfilePhoto, uploadPhotoFlow } from '../src/services/photo-upload-service';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../src/utils/logger";
import { supabase } from '../src/lib/supabase';
import { PinchGestureHandler, State, PinchGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';

interface PhotoEditTrayProps {
  isVisible: boolean;
  onClose: () => void;
  userData: any;
  onPhotoUpdated: () => void;
  profile?: any;
}

const PhotoEditTray: React.FC<PhotoEditTrayProps> = ({
  isVisible,
  onClose,
  userData,
  onPhotoUpdated,
  profile,
}) => {
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLoadingGrid, setIsLoadingGrid] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  type SlotPhoto = { id?: string; url?: string; order: number };
  const EMPTY_GRID: SlotPhoto[] = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ order: i + 1 })),
    []
  );
  const [gridPhotos, setGridPhotos] = useState<SlotPhoto[]>(EMPTY_GRID);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const tileLayoutsRef = useRef<Array<{ x: number; y: number; width: number; height: number }>>([]);
  const dragPans = useRef(Array.from({ length: 6 }, () => new Animated.ValueXY())).current;

  const handlePhotoUpload = async () => {
    if (!userData?.id) {
      Alert.alert("Error", "User not found. Please try again.");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      // Ask for source like the slots
      let chosenSource: 'camera' | 'gallery' = 'gallery';
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Update Main Photo',
          'Choose a source',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
            { text: 'Camera', onPress: () => { chosenSource = 'camera'; resolve(); } },
            { text: 'Gallery', onPress: () => { chosenSource = 'gallery'; resolve(); } },
          ],
          { cancelable: true }
        );
      });

      const result = await uploadPhotoFlow(userData.id, chosenSource);
      
      if (result.success) {
        Alert.alert("Success", "Photo uploaded successfully!");
        onPhotoUpdated(); // Refresh profile data
        onClose(); // Close the tray
      } else {
        Alert.alert("Upload Failed", result.error || "Failed to upload photo. Please try again.");
      }
    } catch (error) {
      logError("Photo upload error:", "Error", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const loadAdditionalPhotos = async () => {
    if (!userData?.id) return;
    setIsLoadingGrid(true);
    try {
      const { data, error } = await supabase
        .from('profile_photos')
        .select('id, url, order')
        .eq('user_id', userData.id)
        .order('order', { ascending: true });

      if (error) throw error;

      const photosByOrder: Record<number, SlotPhoto> = {};
      (data || []).forEach((p: any) => {
        photosByOrder[p.order] = { id: p.id, url: p.url, order: p.order };
      });

      setGridPhotos(
        Array.from({ length: 6 }, (_, idx) => photosByOrder[idx + 1] || { order: idx + 1 })
      );
    } catch (e) {
      logError('Failed to load additional photos', "Error", e);
    } finally {
      setIsLoadingGrid(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadAdditionalPhotos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, userData?.id]);

  const addOrReplacePhotoAt = async (slotIndex: number) => {
    if (!userData?.id) return;
    setUploadingSlot(slotIndex);
    try {
      // Ask source first (camera or gallery)
      let chosenSource: 'camera' | 'gallery' = 'gallery';
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Add Photo',
          'Choose a source',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
            { text: 'Camera', onPress: () => { chosenSource = 'camera'; resolve(); } },
            { text: 'Gallery', onPress: () => { chosenSource = 'gallery'; resolve(); } },
          ],
          { cancelable: true }
        );
      });

      // If user cancelled (no slot update and no chosenSource change), just return
      if (!chosenSource) return;

      const result = await uploadPhotoFlow(userData.id, chosenSource);
      if (!result.success || !result.url) {
        Alert.alert('Upload Failed', result.error || 'Please try again.');
        return;
      }

      const desiredOrder = slotIndex + 1;

      // Upsert by user_id + order
      const { error } = await supabase
        .from('profile_photos')
        .upsert(
          [{ user_id: userData.id, url: result.url, order: desiredOrder }],
          { onConflict: 'user_id,order' }
        );

      if (error) throw error;

      await loadAdditionalPhotos();
      onPhotoUpdated();
    } catch (e) {
      logError('Failed to add/replace additional photo', "Error", e);
      Alert.alert('Error', 'Could not save the photo.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const promptReplaceOrRemove = (slotIndex: number) => {
    const hasPhoto = !!gridPhotos[slotIndex]?.url;
    if (!hasPhoto) {
      addOrReplacePhotoAt(slotIndex);
      return;
    }

    Alert.alert(
      'Photo Options',
      'Replace this photo or remove it from your profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removePhotoAt(slotIndex) },
        { text: 'Replace', onPress: () => addOrReplacePhotoAt(slotIndex) },
      ]
    );
  };

  const removePhotoAt = async (slotIndex: number) => {
    if (!userData?.id) return;
    try {
      const order = slotIndex + 1;
      const { error } = await supabase
        .from('profile_photos')
        .delete()
        .eq('user_id', userData.id)
        .eq('order', order);
      if (error) throw error;
      await loadAdditionalPhotos();
      onPhotoUpdated();
    } catch (e) {
      logError('Failed to remove photo from slot', "Error", e);
      Alert.alert('Error', 'Could not remove the photo.');
    }
  };

  // Save new order after reordering
  const saveGridOrder = async () => {
    if (!userData?.id) return;
    try {
      const rows = gridPhotos
        .map((p, idx) => ({ ...p, order: idx + 1 }))
        .filter(p => !!p.url)
        .map(p => ({ user_id: userData.id, url: p.url!, order: p.order }));
      await supabase.from('profile_photos').delete().eq('user_id', userData.id);
      if (rows.length > 0) {
        const { error } = await supabase.from('profile_photos').insert(rows);
        if (error) throw error;
      }
      await loadAdditionalPhotos();
      onPhotoUpdated();
    } catch (e) {
      logError('Failed to save new order', "Error", e);
    }
  };

  // PanResponders for drag-to-reorder
  const panRespondersRef = useRef(
    Array.from({ length: 6 }, (_, index) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isReorderMode && !!gridPhotos[index]?.url,
        onPanResponderGrant: () => {
          if (!isReorderMode || !gridPhotos[index]?.url) return;
          // @ts-ignore read current animated values
          const currentX = (dragPans[index].x as any)._value || 0;
          // @ts-ignore read current animated values
          const currentY = (dragPans[index].y as any)._value || 0;
          dragPans[index].setOffset({ x: currentX, y: currentY });
          dragPans[index].setValue({ x: 0, y: 0 });
          setDraggingIndex(index);
        },
        onPanResponderMove: Animated.event(
          [null, { dx: dragPans[index].x, dy: dragPans[index].y }],
          { useNativeDriver: false }
        ),
        onPanResponderRelease: (_evt, gesture) => {
          dragPans[index].flattenOffset();
          const origin = tileLayoutsRef.current[index];
          if (origin) {
            const centerX = origin.x + origin.width / 2 + gesture.dx;
            const centerY = origin.y + origin.height / 2 + gesture.dy;
            let target = index;
            tileLayoutsRef.current.forEach((rect, i) => {
              if (!rect) return;
              if (centerX >= rect.x && centerX <= rect.x + rect.width && centerY >= rect.y && centerY <= rect.y + rect.height) {
                target = i;
              }
            });
            if (target !== index) {
              setGridPhotos(prev => {
                const next = [...prev];
                const tmp = next[index];
                next[index] = next[target];
                next[target] = tmp;
                return next;
              });
            }
          }
          Animated.spring(dragPans[index], { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start(() => {
            setDraggingIndex(null);
            saveGridOrder();
          });
        },
      })
    )
  ).current;

  const handleTileLayout = (idx: number, layout: { x: number; y: number; width: number; height: number }) => {
    const arr = tileLayoutsRef.current.slice();
    arr[idx] = layout;
    tileLayoutsRef.current = arr;
  };

  // Preview modal with pinch-to-zoom
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = Animated.multiply(baseScale, pinchScale);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], { useNativeDriver: true });
  const onPinchStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.END || event.nativeEvent.oldState === State.ACTIVE) {
      // @ts-ignore access current value
      const currentBase = (baseScale as any)._value || 1;
      // @ts-ignore access current value
      const pinch = (pinchScale as any)._value || 1;
      baseScale.setValue(Math.max(1, Math.min(currentBase * pinch, 6)));
      pinchScale.setValue(1);
    }
  };

  const openPreview = (uri?: string) => {
    if (!uri) return;
    setPreviewUri(uri);
    baseScale.setValue(1);
    pinchScale.setValue(1);
    setPreviewVisible(true);
  };

  logDebug('PhotoEditTray render - isVisible:', "Debug", isVisible);
  
  return (
    <PopUpTray
      isVisible={isVisible}
      onClose={onClose}
      onConfirm={onClose}
      title=""
      confirmButtonText="Done"
      headerTabColor="#B8D4F1"
      customHeight={0.9} // Taller tray to eliminate overlap
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handlePhotoUpload}
            disabled={isUploadingPhoto}
            style={[styles.headerCameraButton, isUploadingPhoto && styles.cameraButtonDisabled]}
            accessibilityLabel="Add profile photo"
            accessibilityHint="Opens camera or gallery"
          >
            {isUploadingPhoto ? <ActivityIndicator /> : <Camera size={18} color="black" />}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile Photos</Text>
        </View>

        <View style={styles.photoSection}>
          <View style={styles.photoContainer}>
            {(profile?.avatar_url || userData?.avatar_url) ? (
              <Image source={{ uri: profile?.avatar_url || userData?.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {userData?.name ? userData.name.charAt(0).toUpperCase() : "U"}
                </Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.cameraButton, isUploadingPhoto && styles.cameraButtonDisabled]} 
              onPress={handlePhotoUpload}
              disabled={isUploadingPhoto}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator size={16} color="black" />
              ) : (
                <Camera size={16} color="black" />
              )}
            </TouchableOpacity>
          </View>
          
          <Text style={styles.instructions}>
            Tap the camera to update your main profile photo
          </Text>
        </View>

        <View style={styles.additionalSection}>
          <View style={styles.additionalHeaderRow}>
            <Text style={styles.additionalTitle}>Additional Photos</Text>
            <TouchableOpacity
              onPress={() => setIsReorderMode(v => !v)}
              style={[styles.reorderButton, isReorderMode && styles.reorderButtonActive]}
              accessibilityLabel={isReorderMode ? 'Finish reordering' : 'Reorder photos'}
            >
              <Text style={styles.reorderButtonText}>{isReorderMode ? 'Done' : 'Reorder'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {gridPhotos.map((p, idx) => (
              <Animated.View
                key={idx}
                style={[
                  styles.gridItem,
                  !p.url && styles.gridItemEmpty,
                  draggingIndex === idx && styles.dragging,
                  isReorderMode && p.url ? { zIndex: 2, transform: dragPans[idx].getTranslateTransform() } : undefined,
                ]}
                onLayout={(e) => handleTileLayout(idx, e.nativeEvent.layout)}
                {...(isReorderMode && p.url ? panRespondersRef[idx].panHandlers : {})}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => (isReorderMode ? undefined : promptReplaceOrRemove(idx))}
                  onLongPress={() => (!isReorderMode && p.url ? openPreview(p.url) : undefined)}
                  delayLongPress={200}
                  accessibilityLabel={p.url ? `Photo slot ${idx + 1}` : `Add photo slot ${idx + 1}`}
                  accessibilityHint={p.url ? (isReorderMode ? 'Drag to reorder' : 'Tap to replace or remove. Long-press to preview') : 'Tap to add photo'}
                  style={styles.gridInnerTouchable}
                >
                  {uploadingSlot === idx ? (
                    <ActivityIndicator />
                  ) : p.url ? (
                    <Image source={{ uri: p.url }} style={styles.gridImage} />
                  ) : (
                    <Plus size={28} color="#999" />
                  )}
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
          <Text style={styles.caption}>Add up to 6 photos. The first photo is your main profile picture.</Text>
        </View>
      </ScrollView>
      {/* Preview Modal */}
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewBackdrop} activeOpacity={1} onPress={() => setPreviewVisible(false)} />
          <View style={styles.previewContainer}>
            <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
              <Animated.Image
                source={{ uri: previewUri || undefined }}
                style={[styles.previewImage, { transform: [{ scale }] }]}
                resizeMode="contain"
              />
            </PinchGestureHandler>
          </View>
        </View>
      </Modal>
    </PopUpTray>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerCameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'black',
    borderBottomWidth: 3,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Geist-Regular',
    color: 'black',
  },
  photoSection: {
    alignItems: 'center',
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'black',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#B8D4F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'black',
  },
  avatarText: {
    fontSize: 36,
    fontFamily: 'Geist-Regular',
    color: 'black',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cameraButtonDisabled: {
    opacity: 0.6,
  },
  instructions: {
    fontSize: 14,
    fontFamily: 'Geist-Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  additionalSection: {
    marginTop: 10,
  },
  additionalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12, // Ensure grid sits below header/button
  },
  additionalTitle: {
    fontSize: 20,
    fontFamily: 'Geist-Regular',
    color: 'black',
    marginBottom: 10,
  },
  reorderButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: 'black',
    borderBottomWidth: 3,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  reorderButtonActive: {
    backgroundColor: '#e6f0ff',
  },
  reorderButtonText: {
    fontFamily: 'Geist-Regular',
    color: 'black',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  gridItem: {
    width: '31%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: 'black',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginBottom: 12,
  },
  gridInnerTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  gridItemEmpty: {
    backgroundColor: '#fafafa',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  dragging: {
    borderStyle: 'solid',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  caption: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    fontFamily: 'Geist-Regular',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});

export default PhotoEditTray;
