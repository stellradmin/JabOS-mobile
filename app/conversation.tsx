import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CleanConversationTray from '../components/messaging/CleanConversationTray';

export default function ConversationScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const [visible, setVisible] = useState(true);

  return (
    <View style={{ flex: 1 }}>
      <CleanConversationTray
        visible={visible}
        onClose={() => { setVisible(false); try { router.back(); } catch {} }}
        conversationId={conversationId}
      />
    </View>
  );
}
