import bcrypt from "@/lib/bcrypt";
import { fontScale, scale } from "@/lib/responsive";
import { supabase } from "@/lib/supabase";
import { FontAwesome } from "@expo/vector-icons";
import * as Device from "expo-device";
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  brandGreen: "#3E9B4F",
  brandBlue: "#007AFF",
  brandGrayText: "#8A8A8E",
  brandGrayBorder: "#D1D1D6",
};

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

const generateUUID = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // fallback v4 uuid
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/** Philippine mobile: exactly 11 digits, starts with 09 (e.g. 09123456789). */
const PHONE_11_REGEX = /^09\d{9}$/;

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password requirements validation
  const getPasswordRequirements = (pwd: string) => {
    return {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      symbol: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
  };

  const passwordRequirements = getPasswordRequirements(password);

  // Check if all password requirements are met
  const allPasswordRequirementsMet = Object.values(passwordRequirements).every(
    (req) => req === true,
  );

  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [phoneExists, setPhoneExists] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const emailCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const phoneCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const canSubmit = useMemo(() => {
    const phoneOk = PHONE_11_REGEX.test(phone);
    return Boolean(
      name?.trim() &&
      email?.trim() &&
      phoneOk &&
      password &&
      confirmPassword &&
      password === confirmPassword &&
      allPasswordRequirementsMet &&
      !emailExists &&
      !phoneExists &&
      !checkingEmail &&
      !checkingPhone,
    );
  }, [
    name,
    email,
    phone,
    password,
    confirmPassword,
    allPasswordRequirementsMet,
    emailExists,
    phoneExists,
    checkingEmail,
    checkingPhone,
  ]);

  const validateName = (nameText: string): boolean => {
    if (!nameText.trim()) {
      setNameError(null);
      return true; // Allow empty for now, will validate on submit
    }
    // Allow letters, spaces, and common name characters like hyphens and apostrophes
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(nameText)) {
      setNameError("Please enter your full name using letters only.");
      return false;
    }
    setNameError(null);
    return true;
  };

  const validateEmail = (emailText: string): boolean => {
    if (!emailText.trim()) {
      setEmailError(null);
      return true; // Allow empty for now, will validate on submit
    }
    // Check if email contains gmail.com
    if (!emailText.toLowerCase().includes("gmail.com")) {
      setEmailError("Email must be a valid @gmail.com address.");
      return false;
    }
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailText)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError(null);
    return true;
  };

  const checkEmailExists = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes("@")) {
      setEmailExists(false);
      return;
    }

    setCheckingEmail(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("email", emailToCheck.trim())
        .maybeSingle();

      setEmailExists(!error && !!data);
    } catch (error) {
      console.error("Error checking email:", error);
      setEmailExists(false);
    } finally {
      setCheckingEmail(false);
    }
  };

  const checkPhoneExists = async (phoneToCheck: string) => {
    if (!PHONE_11_REGEX.test(phoneToCheck)) {
      setPhoneExists(false);
      return;
    }

    setCheckingPhone(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("phone_number")
        .eq("phone_number", phoneToCheck)
        .maybeSingle();

      setPhoneExists(!error && !!data);
    } catch (error) {
      console.error("Error checking phone:", error);
      setPhoneExists(false);
    } finally {
      setCheckingPhone(false);
    }
  };

  const validatePhone = (phoneText: string): boolean => {
    if (!phoneText.trim()) {
      setPhoneError(null);
      return true;
    }
    if (phoneText.length < 11) {
      setPhoneError(null);
      return true;
    }
    if (!PHONE_11_REGEX.test(phoneText)) {
      setPhoneError("Use 11 digits starting with 09 (example: 09123456789).");
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handleNameChange = (text: string) => {
    setName(text);
    validateName(text);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailExists(false);
    validateEmail(text);

    // Clear existing timeout
    if (emailCheckTimeoutRef.current) {
      clearTimeout(emailCheckTimeoutRef.current);
    }

    // Set new timeout to check email existence
    if (text.includes("@") && text.toLowerCase().includes("gmail.com")) {
      emailCheckTimeoutRef.current = setTimeout(() => {
        checkEmailExists(text);
      }, 500);
    }
  };

  const handlePhoneChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, "").slice(0, 11);
    setPhone(numericText);
    setPhoneExists(false);
    validatePhone(numericText);

    if (phoneCheckTimeoutRef.current) {
      clearTimeout(phoneCheckTimeoutRef.current);
    }

    if (PHONE_11_REGEX.test(numericText)) {
      phoneCheckTimeoutRef.current = setTimeout(() => {
        void checkPhoneExists(numericText);
      }, 500);
    } else {
      setPhoneExists(false);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (emailCheckTimeoutRef.current) {
        clearTimeout(emailCheckTimeoutRef.current);
      }
      if (phoneCheckTimeoutRef.current) {
        clearTimeout(phoneCheckTimeoutRef.current);
      }
    };
  }, []);

  const handleSignup = async () => {
    // Validate all fields
    let hasErrors = false;

    // Validate name
    if (!name.trim()) {
      setNameError("Full name is required");
      hasErrors = true;
    } else if (!validateName(name)) {
      hasErrors = true;
    }

    // Validate email
    if (!email.trim()) {
      setEmailError("Email address is required");
      hasErrors = true;
    } else if (!validateEmail(email)) {
      hasErrors = true;
    }

    // Check if email already exists
    if (emailExists) {
      setEmailError(
        "This email address is already registered. Please use a different email.",
      );
      hasErrors = true;
    }

    if (!phone.trim()) {
      setPhoneError("Phone number is required");
      hasErrors = true;
    } else if (!PHONE_11_REGEX.test(phone)) {
      setPhoneError(
        "Phone must be exactly 11 digits starting with 09 (example: 09123456789).",
      );
      hasErrors = true;
    }

    if (phoneExists) {
      setPhoneError(
        "This phone number is already registered. Please use a different number.",
      );
      hasErrors = true;
    }

    // Re-check phone uniqueness on submit to avoid race with debounced check
    if (!hasErrors && PHONE_11_REGEX.test(phone)) {
      const { data: phoneRow, error: phoneLookupError } = await supabase
        .from("user_profiles")
        .select("phone_number")
        .eq("phone_number", phone)
        .maybeSingle();
      if (!phoneLookupError && phoneRow) {
        setPhoneExists(true);
        setPhoneError(
          "This phone number is already registered. Please use a different number.",
        );
        hasErrors = true;
      }
    }

    // Check if all password requirements are met
    const requirements = getPasswordRequirements(password);
    const allRequirementsMet = Object.values(requirements).every(
      (req) => req === true,
    );

    if (!allRequirementsMet) {
      Alert.alert(
        "Password Requirements Not Met",
        "Please ensure your password meets all requirements before continuing.",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords Don't Match",
        "Your password and confirmation password do not match. Please try again.",
      );
      return;
    }

    if (hasErrors) {
      return;
    }

    if (!password || !confirmPassword) {
      Alert.alert(
        "Required Fields Missing",
        "Please fill in all required fields before continuing.",
      );
      return;
    }

    setLoading(true);
    try {
      // Get device information
      const deviceId = Device.osInternalBuildId || Device.modelId || "unknown";
      const deviceModel = Device.modelName || Device.modelId || "unknown";

      const hashedPassword = await bcrypt.hash(String(password ?? ""), 10);

      const newId = generateUUID();

      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          id: newId,
          name,
          email: email.trim(),
          phone_number: phone,
          password: hashedPassword,
          device_id: deviceId,
          device_model: deviceModel,
        });

      if (profileError) {
        Alert.alert("Sign Up Failed", profileError.message);
        setLoading(false);
        return;
      }

      Alert.alert(
        "Success",
        "Account created successfully. You can now log in.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/UserManagement/login"),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.signupScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.signupContainer}>
            <Text style={styles.signupTitle}>Sign Up</Text>
            <Text style={styles.signupSubtitle}>Create your account</Text>

            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Full name</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome
                  name="user"
                  size={16}
                  color={colors.brandGrayText}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Full name"
                  placeholderTextColor={colors.brandGrayText}
                  autoCapitalize="words"
                  value={name}
                  onChangeText={handleNameChange}
                  editable={!loading}
                  style={styles.input}
                />
              </View>
              {nameError && (
                <Text style={styles.fieldErrorText}>{nameError}</Text>
              )}

              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome
                  name="envelope"
                  size={16}
                  color={colors.brandGrayText}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="you@gmail.com"
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
                  <ActivityIndicator
                    size="small"
                    color={colors.brandGrayText}
                    style={styles.togglePasswordButton}
                  />
                )}
                {!checkingEmail &&
                  email &&
                  email.includes("@") &&
                  email.toLowerCase().includes("gmail.com") &&
                  !emailError && (
                    <FontAwesome
                      name={emailExists ? "times-circle" : "check-circle"}
                      size={18}
                      color={emailExists ? "#EF4444" : colors.brandGreen}
                      style={styles.togglePasswordButton}
                    />
                  )}
              </View>
              {emailError && (
                <Text style={styles.fieldErrorText}>{emailError}</Text>
              )}
              {!emailError && emailExists && (
                <Text style={styles.fieldErrorText}>
                  This email is already registered. Please use a different
                  email.
                </Text>
              )}

              <Text style={styles.fieldLabel}>Phone number</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome
                  name="phone"
                  size={18}
                  color={colors.brandGrayText}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="09123456789"
                  placeholderTextColor={colors.brandGrayText}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  editable={!loading}
                  style={styles.input}
                  maxLength={11}
                />
                {checkingPhone && (
                  <ActivityIndicator
                    size="small"
                    color={colors.brandGrayText}
                    style={styles.togglePasswordButton}
                  />
                )}
                {!checkingPhone &&
                  phone.length === 11 &&
                  PHONE_11_REGEX.test(phone) &&
                  !phoneError && (
                    <FontAwesome
                      name={phoneExists ? "times-circle" : "check-circle"}
                      size={18}
                      color={phoneExists ? "#EF4444" : colors.brandGreen}
                      style={styles.togglePasswordButton}
                    />
                  )}
              </View>
              {phoneError && (
                <Text style={styles.fieldErrorText}>{phoneError}</Text>
              )}
              {!phoneError && phoneExists && (
                <Text style={styles.fieldErrorText}>
                  This phone number is already registered. Please use a
                  different number.
                </Text>
              )}

              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome
                  name="lock"
                  size={18}
                  color={colors.brandGrayText}
                  style={styles.inputIcon}
                />
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
                  onPress={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                >
                  <FontAwesome
                    name={showPassword ? "eye-slash" : "eye"}
                    size={18}
                    color={colors.brandGrayText}
                  />
                </TouchableOpacity>
              </View>

              {/* Password Requirements */}
              {password.length > 0 && !allPasswordRequirementsMet && (
                <View style={styles.passwordRequirements}>
                  <Text style={styles.requirementsTitle}>Password must:</Text>
                  <View style={styles.requirementItem}>
                    <FontAwesome
                      name={
                        passwordRequirements.length
                          ? "check-circle"
                          : "times-circle"
                      }
                      size={16}
                      color={
                        passwordRequirements.length
                          ? colors.brandGreen
                          : "#EF4444"
                      }
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        passwordRequirements.length && styles.requirementMet,
                      ]}
                    >
                      Contain 8 to 30 characters
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <FontAwesome
                      name={
                        passwordRequirements.uppercase
                          ? "check-circle"
                          : "times-circle"
                      }
                      size={16}
                      color={
                        passwordRequirements.uppercase
                          ? colors.brandGreen
                          : "#EF4444"
                      }
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        passwordRequirements.uppercase && styles.requirementMet,
                      ]}
                    >
                      Contain both lower and uppercase letters
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <FontAwesome
                      name={
                        passwordRequirements.number
                          ? "check-circle"
                          : "times-circle"
                      }
                      size={16}
                      color={
                        passwordRequirements.number
                          ? colors.brandGreen
                          : "#EF4444"
                      }
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        passwordRequirements.number && styles.requirementMet,
                      ]}
                    >
                      Contain one number
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <FontAwesome
                      name={
                        passwordRequirements.symbol
                          ? "check-circle"
                          : "times-circle"
                      }
                      size={16}
                      color={
                        passwordRequirements.symbol
                          ? colors.brandGreen
                          : "#EF4444"
                      }
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        passwordRequirements.symbol && styles.requirementMet,
                      ]}
                    >
                      Contain one special character !@#$%^&*()_+
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.fieldLabel}>Confirm password</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome
                  name="lock"
                  size={18}
                  color={colors.brandGrayText}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Confirm password"
                  placeholderTextColor={colors.brandGrayText}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!loading}
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.togglePasswordButton}
                  activeOpacity={0.7}
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  disabled={loading}
                >
                  <FontAwesome
                    name={showConfirmPassword ? "eye-slash" : "eye"}
                    size={18}
                    color={colors.brandGrayText}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.signupButton,
                  (loading || !canSubmit) && styles.signupButtonDisabled,
                ]}
                activeOpacity={0.9}
                onPress={handleSignup}
                disabled={loading || !canSubmit}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.signupButtonText}>Sign Up</Text>
                )}
              </TouchableOpacity>

              <View style={styles.inlineFooter}>
                <Text style={styles.inlineFooterText}>
                  Already have an account?
                </Text>
                <Link href="/UserManagement/login" asChild>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.inlineFooterLink}>Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  signupScrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingTop: scale(36),
    paddingBottom: scale(28),
  },
  signupContainer: {
    flex: 1,
  },
  signupTitle: {
    fontFamily: fonts.bold,
    fontSize: fontScale(40),
    color: "#111827",
  },
  signupSubtitle: {
    marginTop: scale(4),
    marginBottom: scale(20),
    fontFamily: fonts.regular,
    fontSize: fontScale(14),
    color: "#6B7280",
  },
  form: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: fonts.medium,
    fontSize: fontScale(14),
    color: "#1F2937",
    marginBottom: scale(8),
    marginTop: scale(8),
  },
  inputWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  inputIcon: {
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
  input: {
    height: scale(48),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingLeft: 48,
    paddingRight: 42,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
  },
  signupButton: {
    backgroundColor: "#3E9B4F",
    borderRadius: 999,
    marginTop: 14,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 44,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
  },
  inlineFooter: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  inlineFooterText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.brandGrayText,
  },
  inlineFooterLink: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.brandBlue,
  },
  passwordRequirements: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  requirementsTitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#374151",
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  requirementText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
    marginLeft: 8,
  },
  requirementMet: {
    color: colors.brandGreen,
  },
  togglePasswordButton: {
    position: "absolute",
    right: 16,
    zIndex: 1,
  },
  emailErrorText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
    marginBottom: 8,
  },
  fieldErrorText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 4,
  },
});
