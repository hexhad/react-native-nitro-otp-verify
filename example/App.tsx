import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useOtpVerify } from 'react-native-nitro-otp-verify';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  const { otp, message, hash, timeoutError, startListener, stopListener } =
    useOtpVerify({ numberOfDigits: 6 });

  console.log('[COPY FROM DEV TOOLS] APP HASH', hash?.[0]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Hash */}
      <View style={styles.section}>
        <Text style={styles.label}>App Hash</Text>
        <Text style={styles.hash}>{hash?.[0] ?? 'Loading...'}</Text>
      </View>

      {/* OTP Input */}
      <View style={styles.section}>
        <Text style={styles.label}>OTP</Text>
        <TextInput
          style={styles.input}
          value={otp ?? ''}
          placeholder="Waiting for OTP..."
          keyboardType="number-pad"
          maxLength={6}
          editable={false}
        />
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.label}>Status</Text>
        {!otp && !timeoutError && (
          <View style={styles.row}>
            <ActivityIndicator size="small" color="#6C63FF" />
            <Text style={styles.statusText}>Listening for SMS...</Text>
          </View>
        )}
        {otp && (
          <Text style={styles.successText}>OTP received successfully</Text>
        )}
        {timeoutError && (
          <Text style={styles.errorText}>Timeout — no SMS received</Text>
        )}
        {message && <Text style={styles.message}>{message}</Text>}
      </View>

      {/* Buttons */}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={startListener}>
          <Text style={styles.btnText}>Start</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnDanger]}
          onPress={stopListener}
        >
          <Text style={styles.btnText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#979797',
    padding: 24,
    justifyContent: 'center',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hash: {
    fontSize: 13,
    color: '#333',
    fontFamily: 'monospace',
    backgroundColor: '#E8E8E8',
    padding: 10,
    borderRadius: 8,
  },
  input: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    color: '#1A1A1A',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#6C63FF',
    borderRadius: 12,
    padding: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
  successText: {
    fontSize: 14,
    color: '#2ECC71',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '600',
  },
  message: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  btn: {
    flex: 1,
    backgroundColor: '#6C63FF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDanger: {
    backgroundColor: '#E74C3C',
  },
  btnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
