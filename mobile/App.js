import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaView, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Audio } from 'expo-av';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    (async () => {
      // 1. Request microphone permissions natively
      await Audio.requestPermissionsAsync();
      // 2. Configure audio to play in background even when screen is locked
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    })();
  }, []);

  // Replace this with your actual Desktop's local IP Address (e.g. 192.168.0.50)
  const LOCAL_IP_HOST = 'http://192.168.X.X:5173';

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: LOCAL_IP_HOST }}
        style={styles.webview}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        originWhitelist={['*']}
      />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070a', // Matches Paxion Hacker Dark Theme
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
