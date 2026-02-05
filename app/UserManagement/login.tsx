import { FontAwesome } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { sendPasswordResetCode } from '@/lib/sendgrid';

const colors = {
  brandGreen: '#3E9B4F',
  brandBlue: '#007AFF',
  brandGrayText: '#8A8A8E',
  brandGrayBorder: '#D1D1D6',
};

const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [forgotEmailMessage, setForgotEmailMessage] = useState<string | null>(null);
  const [forgotEmailMessageType, setForgotEmailMessageType] = useState<'success' | 'error' | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const deviceId = Device.osInternalBuildId || Device.modelId || 'unknown';
      const deviceModel = Device.modelName || Device.modelId || 'unknown';

      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      const { data: userProfile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email.trim())
        .eq('password', hashedPassword)
        .maybeSingle();

      if (error) {
        Alert.alert('Login Failed', error.message);
        setLoading(false);
        return;
      }

      if (!userProfile) {
        Alert.alert('Login Failed', 'Invalid credentials');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          device_id: deviceId,
          device_model: deviceModel,
        })
        .eq('email', email.trim());

      if (updateError) {
        console.warn('Failed to update device info:', updateError.message);
      }

      router.replace({
        pathname: '/UserManagement/dashboard',
        params: { email: email.trim() },
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!forgotEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      // Reset previous message
      setForgotEmailMessage(null);
      setForgotEmailMessageType(null);

      // Check if email exists in Supabase
      const { data: existingUser, error: fetchError } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('email', forgotEmail)
        .single();

      if (fetchError || !existingUser) {
        setForgotEmailMessage('Email address is not registered');
        setForgotEmailMessageType('error');
        setLoading(false);
        return;
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      await sendPasswordResetCode(forgotEmail, code);
      
      setForgotStep(2);
      startCountdown();
      setForgotEmailMessage('Verification code sent to your email');
      setForgotEmailMessageType('success');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (!verificationCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    setForgotStep(3);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        newPassword
      );

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ password: hashedPassword })
        .eq('email', forgotEmail);

      if (updateError) throw updateError;

      Alert.alert('Success', 'Password has been reset. You can now log in with your new password.', [
        { text: 'OK', onPress: () => {
          setShowForgotPassword(false);
          resetForgotPasswordForm();
        }}
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = () => {
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetForgotPasswordForm = () => {
    setForgotEmail('');
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotStep(1);
    setCountdown(0);
    setForgotEmailMessage(null);
    setForgotEmailMessageType(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView bounces={false} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.phoneFrame}>
          {/* Green Background Section */}
          <View style={styles.greenBackground}>
            <View style={styles.header}>
              <Text style={styles.title}>Hello Welcome Back!</Text>
            </View>
          </View>

          {/* White Card Section */}
          <View style={styles.cardContainer}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('@/assets/images/logo_string_beans.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <FontAwesome name="envelope" size={16} color={colors.brandGrayText} style={styles.inputIcon} />
                <TextInput
                  placeholder="Email"
                  placeholderTextColor={colors.brandGrayText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputWrapper}>
                <FontAwesome name="lock" size={18} color={colors.brandGrayText} style={styles.inputIcon} />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor={colors.brandGrayText}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.togglePasswordButton}
                  activeOpacity={0.7}
                  onPress={() => setShowPassword((prev) => !prev)}>
                  <FontAwesome
                    name={showPassword ? 'eye-slash' : 'eye'}
                    size={18}
                    color={colors.brandGrayText}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.forgotWrapper} 
                activeOpacity={0.7}
                onPress={() => setShowForgotPassword(true)}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                activeOpacity={0.9}
                onPress={handleLogin}
                disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Login</Text>}
              </TouchableOpacity>

              <View style={styles.inlineFooter}>
                <Text style={styles.inlineFooterText}>Don&apos;t have an account?</Text>
                <Link href="/UserManagement/signup" asChild>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.inlineFooterLink}>Create Account</Text>
                  </TouchableOpacity>
                </Link>
              </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Signing in...</Text>
        </View>
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => {
                setShowForgotPassword(false);
                resetForgotPasswordForm();
              }}>
              <FontAwesome name="times" size={20} color={colors.brandGrayText} />
            </TouchableOpacity>

            {forgotStep === 1 && (
              <View style={styles.modalContent}>
                <View style={styles.modalIconContainer}>
                  <FontAwesome name="lock" size={32} color={colors.brandGreen} />
                </View>
                <Text style={styles.modalTitle}>Forgot Password?</Text>
                <Text style={styles.modalDescription}>
                  Enter your email address to receive a verification code
                </Text>
                <View style={styles.inputContainer}>
                  <FontAwesome name="envelope" size={16} color={colors.brandGrayText} style={styles.modalInputIcon} />
                  <TextInput
                    style={[styles.inputField, { letterSpacing: 0 }]}
                    placeholder="Email address"
                    placeholderTextColor={colors.brandGrayText}
                    value={forgotEmail}
                    onChangeText={(text) => {
                      setForgotEmail(text);
                      setForgotEmailMessage(null);
                      setForgotEmailMessageType(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {forgotEmailMessage && (
                  <Text
                    style={[
                      styles.forgotEmailMessage,
                      forgotEmailMessageType === 'success'
                        ? styles.forgotEmailMessageSuccess
                        : styles.forgotEmailMessageError,
                    ]}>
                    {forgotEmailMessage}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                  onPress={handleSendCode}
                  disabled={loading}>
                  <Text style={styles.sendButtonText}>
                    {loading ? 'Sending...' : 'Send Code'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {forgotStep === 2 && (
              <View style={styles.modalContent}>
                <View style={styles.modalIconContainer}>
                  <FontAwesome name="envelope-open" size={32} color={colors.brandGreen} />
                </View>
                <Text style={styles.modalTitle}>Enter Verification Code</Text>
                <Text style={styles.modalDescription}>
                  We've sent a 6-digit code to {forgotEmail}
                </Text>
                <View style={styles.codeInputContainer}>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="000000"
                    placeholderTextColor={colors.brandGrayText}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="numeric"
                    maxLength={6}
                    textAlign="center"
                  />
                </View>
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleVerifyCode}>
                  <Text style={styles.sendButtonText}>Verify Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleSendCode}
                  disabled={countdown > 0}>
                  <Text style={[styles.resendButtonText, countdown > 0 && styles.resendButtonTextDisabled]}>
                    {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {forgotStep === 3 && (
              <View style={styles.modalContent}>
                <View style={styles.modalIconContainer}>
                  <FontAwesome name="unlock" size={32} color={colors.brandGreen} />
                </View>
                <Text style={styles.modalTitle}>New Password</Text>
                <Text style={styles.modalDescription}>
                  Enter your new password
                </Text>
                <View style={styles.inputContainer}>
                  <FontAwesome name="lock" size={16} color={colors.brandGrayText} style={styles.modalInputIcon} />
                  <TextInput
                    style={[styles.inputField, { letterSpacing: 0 }]}
                    placeholder="New password"
                    placeholderTextColor={colors.brandGrayText}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>
                <View style={styles.inputContainer}>
                  <FontAwesome name="lock" size={16} color={colors.brandGrayText} style={styles.modalInputIcon} />
                  <TextInput
                    style={[styles.inputField, { letterSpacing: 0 }]}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.brandGrayText}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>
                <TouchableOpacity
                  style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}>
                  <Text style={styles.sendButtonText}>
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  phoneFrame: {
    flex: 1,
    backgroundColor: '#fff',
  },
  greenBackground: {
    backgroundColor: colors.brandGreen,
    paddingTop: 40,
    paddingBottom: 130,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 100,
    height: 100,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
  },
  cardContainer: {
    marginTop: -80,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    marginBottom: 24,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: '#000',
  },
  form: {
    gap: 16,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  togglePasswordButton: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    paddingLeft: 48,
    paddingRight: 48,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#F8F8F8',
  },
  forgotWrapper: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 4,
  },
  forgotText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.brandBlue,
  },
  loginButton: {
    backgroundColor: colors.brandGreen,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
    shadowColor: colors.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  inlineFooter: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  inlineFooterText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.brandGrayText,
  },
  inlineFooterLink: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.brandBlue,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.brandGrayText,
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 10,
  },
  modalContent: {
    alignItems: 'center',
    paddingTop: 8,
  },
  modalIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f0f9f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    color: colors.brandGreen,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.brandGrayText,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
    position: 'relative',
  },
  modalInputIcon: {
    position: 'absolute',
    left: 14,
    top: 14,
    zIndex: 1,
  },
  inputField: {
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    paddingLeft: 44,
    paddingRight: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#000',
    width: '100%',
  },
  codeInputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  codeInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brandGrayBorder,
    fontFamily: fonts.regular,
    fontSize: 20,
    color: '#000',
    width: '100%',
    letterSpacing: 8,
    textAlign: 'center',
  },
  sendButton: {
    backgroundColor: colors.brandGreen,
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  resendButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  resendButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.brandBlue,
    textAlign: 'center',
  },
  resendButtonTextDisabled: {
    color: colors.brandGrayText,
  },
  forgotEmailMessage: {
    marginTop: -8,
    marginBottom: 4,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'left',
    width: '100%',
  },
  forgotEmailMessageSuccess: {
    color: colors.brandGreen,
  },
  forgotEmailMessageError: {
    color: '#FF3B30',
  },
});