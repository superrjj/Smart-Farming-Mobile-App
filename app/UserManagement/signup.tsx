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

const generateUUID = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // fallback v4 uuid
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Password requirements validation
  const getPasswordRequirements = (pwd: string) => {
    return {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      symbol: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
  };

  const passwordRequirements = getPasswordRequirements(password);
  
  // Check if all password requirements are met
  const allPasswordRequirementsMet = Object.values(passwordRequirements).every(req => req === true);
  
  // Check if form is ready for submission
  const isFormValid = name && email && phone && password && confirmPassword && 
                    password === confirmPassword && allPasswordRequirementsMet;

  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const checkEmailExists = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes('@')) {
      setEmailExists(false);
      return;
    }

    setCheckingEmail(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('email', emailToCheck.trim())
        .maybeSingle();

      setEmailExists(!error && !!data);
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailExists(false);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailExists(false);
    if (text.includes('@')) {
      const timeoutId = setTimeout(() => {
        checkEmailExists(text);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  };

  const handleSignup = async () => {
    if (!name || !email || !phone || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Check if email already exists
    if (emailExists) {
      Alert.alert('Error', 'This email address is already registered. Please use a different email or try logging in.');
      return;
    }

    // Check if all password requirements are met
    const requirements = getPasswordRequirements(password);
    const allRequirementsMet = Object.values(requirements).every(req => req === true);
    
    if (!allRequirementsMet) {
      Alert.alert('Error', 'Please meet all password requirements before signing up');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Get device information
      const deviceId = Device.osInternalBuildId || Device.modelId || 'unknown';
      const deviceModel = Device.modelName || Device.modelId || 'unknown';

      // Hash the password
      const hashedPassword = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      const newId = generateUUID();

      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: newId,
        name,
        email: email.trim(),
        phone_number: phone,
        password: hashedPassword,
        device_id: deviceId,
        device_model: deviceModel,
      });

      if (profileError) {
        Alert.alert('Sign Up Failed', profileError.message);
        setLoading(false);
        return;
      }

      Alert.alert('Success', 'Account created successfully. You can now log in.', [
        {
          text: 'OK',
          onPress: () => router.replace('/UserManagement/login'),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.phoneFrame}>
          {/* Green Background Section */}
          <View style={styles.greenBackground}>
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
            </View>
          </View>

          {/* White Card Section */}
          <View style={styles.cardContainer}>
            <View style={styles.card}>
              <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <FontAwesome name="user" size={16} color={colors.brandGrayText} style={styles.inputIcon} />
                <TextInput
                  placeholder="Full name"
                  placeholderTextColor={colors.brandGrayText}
                  autoCapitalize="words"
                  value={name}
                  onChangeText={setName}
                  editable={!loading}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputWrapper}>
                <FontAwesome name="envelope" size={16} color={colors.brandGrayText} style={styles.inputIcon} />
                <TextInput
                  placeholder="Email address"
                  placeholderTextColor={colors.brandGrayText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={handleEmailChange}
                  editable={!loading}
                  style={styles.input}
                />
                {checkingEmail && (
                  <ActivityIndicator size="small" color={colors.brandGrayText} style={styles.togglePasswordButton} />
                )}
                {!checkingEmail && email && email.includes('@') && (
                  <FontAwesome 
                    name={emailExists ? "times-circle" : "check-circle"} 
                    size={18} 
                    color={emailExists ? "#EF4444" : colors.brandGreen} 
                    style={styles.togglePasswordButton} 
                  />
                )}
              </View>
              
              {emailExists && (
                <Text style={styles.emailErrorText}>
                  This email is already registered. Please use a different email.
                </Text>
              )}

              <View style={styles.inputWrapper}>
                <FontAwesome name="phone" size={18} color={colors.brandGrayText} style={styles.inputIcon} />
                <TextInput
                  placeholder="Phone number"
                  placeholderTextColor={colors.brandGrayText}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(text) => {
                    // Only allow numbers and limit to 11 digits
                    const numericText = text.replace(/[^0-9]/g, '');
                    setPhone(numericText.slice(0, 11));
                  }}
                  editable={!loading}
                  style={styles.input}
                  maxLength={11}
                />
              </View>

              <View style={styles.inputWrapper}>
                <FontAwesome name="lock" size={18} color={colors.brandGrayText} style={styles.inputIcon} />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor={colors.brandGrayText}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                  style={styles.input}
                />
              </View>

              {/* Password Requirements */}
              {password.length > 0 && (
                <View style={styles.passwordRequirements}>
                  <Text style={styles.requirementsTitle}>Password must:</Text>
                  <View style={styles.requirementItem}>
                    <FontAwesome 
                      name={passwordRequirements.length ? "check-circle" : "times-circle"} 
                      size={16} 
                      color={passwordRequirements.length ? colors.brandGreen : "#EF4444"} 
                    />
                    <Text style={[styles.requirementText, passwordRequirements.length && styles.requirementMet]}>
                      Contain 8 to 30 characters
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <FontAwesome 
                      name={passwordRequirements.uppercase ? "check-circle" : "times-circle"} 
                      size={16} 
                      color={passwordRequirements.uppercase ? colors.brandGreen : "#EF4444"} 
                    />
                    <Text style={[styles.requirementText, passwordRequirements.uppercase && styles.requirementMet]}>
                      Contain both lower and uppercase letters
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <FontAwesome 
                      name={passwordRequirements.number ? "check-circle" : "times-circle"} 
                      size={16} 
                      color={passwordRequirements.number ? colors.brandGreen : "#EF4444"} 
                    />
                    <Text style={[styles.requirementText, passwordRequirements.number && styles.requirementMet]}>
                      Contain one number
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <FontAwesome 
                      name={passwordRequirements.symbol ? "check-circle" : "times-circle"} 
                      size={16} 
                      color={passwordRequirements.symbol ? colors.brandGreen : "#EF4444"} 
                    />
                    <Text style={[styles.requirementText, passwordRequirements.symbol && styles.requirementMet]}>
                      Contain one special character !@#$%^&*()_+
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.inputWrapper}>
                <FontAwesome name="lock" size={18} color={colors.brandGrayText} style={styles.inputIcon} />
                <TextInput
                  placeholder="Confirm password"
                  placeholderTextColor={colors.brandGrayText}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!loading}
                  style={styles.input}
                />
              </View>

              <TouchableOpacity
                style={[styles.signupButton, loading && styles.signupButtonDisabled]}
                activeOpacity={0.9}
                onPress={handleSignup}
                disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signupButtonText}>Sign Up</Text>}
              </TouchableOpacity>

              <View style={styles.inlineFooter}>
                <Text style={styles.inlineFooterText}>Already have an account?</Text>
                <Link href="/UserManagement/login" asChild>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.inlineFooterLink}>Log In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 100,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
  },
  cardContainer: {
    marginTop: -40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
  signupButton: {
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
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
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
  passwordRequirements: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  requirementsTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.brandGrayText,
    marginLeft: 8,
  },
  requirementMet: {
    color: colors.brandGreen,
  },
  togglePasswordButton: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
  },
  emailErrorText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginBottom: 8,
  },
});


