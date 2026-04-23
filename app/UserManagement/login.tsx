import { AdminAccessDeniedModal } from "@/components/admin-access-denied-modal";
import bcrypt from "@/lib/bcrypt";
import { isAdminRole } from "@/lib/isAdminRole";
import { fontScale, scale } from "@/lib/responsive";
import {
  invalidatePasswordResetCode,
  isPasswordResetEdgeEnabled,
  sendPasswordResetCode,
  verifyPasswordResetCode,
} from "@/lib/sendgrid";
import {
  clearSavedCredentials,
  getSavedCredentials,
  saveCredentials,
  saveLoggedInEmail,
} from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { FontAwesome } from "@expo/vector-icons";
import * as Device from "expo-device";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ blocked?: string }>();
  const blockedParam =
    typeof params.blocked === "string" ? params.blocked : undefined;

  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [adminDeniedVisible, setAdminDeniedVisible] = useState(false);

  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sentVerificationCode, setSentVerificationCode] = useState("");
  const [sentVerificationCodeExpiresAt, setSentVerificationCodeExpiresAt] =
    useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [forgotEmailMessage, setForgotEmailMessage] = useState<string | null>(
    null,
  );
  const [forgotEmailMessageType, setForgotEmailMessageType] = useState<
    "success" | "error" | null
  >(null);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const saved = await getSavedCredentials();
        if (saved) {
          setEmailOrPhone(saved.email);
          setPassword(saved.password);
          setRememberMe(true);
        }
      } catch (error) {
        console.error("Error loading saved credentials:", error);
      }
    };
    loadSavedCredentials();
  }, []);

  useEffect(() => {
    if (blockedParam === "admin") {
      setAdminDeniedVisible(true);
    }
  }, [blockedParam]);

  const handleLogin = async () => {
    if (!emailOrPhone || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const deviceId = Device.osInternalBuildId || Device.modelId || "unknown";
      const deviceModel = Device.modelName || Device.modelId || "unknown";

      const trimmedInput = emailOrPhone.trim();
      let userProfile: Record<string, any> | null = null;

      const { data: emailProfile, error: emailError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("email", trimmedInput)
        .maybeSingle();

      if (emailError) {
        Alert.alert(
          "Login Failed",
          emailError.message ||
            "An error occurred during login. Please try again.",
        );
        return;
      }

      if (emailProfile) {
        userProfile = emailProfile;
      } else {
        const { data: phoneProfile, error: phoneError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("phone_number", trimmedInput)
          .maybeSingle();

        if (phoneError) {
          Alert.alert(
            "Login Failed",
            phoneError.message ||
              "An error occurred during login. Please try again.",
          );
          return;
        }
        userProfile = phoneProfile;
      }

      if (!userProfile || typeof userProfile.email !== "string") {
        Alert.alert(
          "Login Failed",
          "Invalid email/phone number or password. Please check your credentials and try again.",
        );
        return;
      }

      const inputPassword = String(password ?? "");
      const storedPassword =
        typeof userProfile.password === "string"
          ? userProfile.password
          : String(userProfile.password ?? "");
      const isBcryptHash = /^\$2[aby]\$/.test(storedPassword);
      let passwordMatches = false;

      if (isBcryptHash) {
        try {
          passwordMatches = await bcrypt.compare(inputPassword, storedPassword);
        } catch (compareError) {
          console.warn("Password hash format issue, using legacy fallback.");
          passwordMatches = inputPassword === storedPassword;
        }
      } else {
        // Backward compatibility for accounts created outside mobile that may
        // still store plain text / non-bcrypt passwords.
        passwordMatches = inputPassword === storedPassword;
      }

      if (!passwordMatches) {
        Alert.alert(
          "Login Failed",
          "Invalid email/phone number or password. Please check your credentials and try again.",
        );
        return;
      }

      const userEmail = userProfile.email;

      if (isAdminRole(userProfile.role)) {
        setAdminDeniedVisible(true);
        return;
      }

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          device_id: deviceId,
          device_model: deviceModel,
        })
        .eq("email", userEmail);

      if (updateError) {
        console.warn("Failed to update device info:", updateError.message);
      }

      // Handle Remember Me
      try {
        if (rememberMe) {
          await saveCredentials(trimmedInput, password);
        } else {
          await clearSavedCredentials();
        }
        // Save logged in email for future reference
        await saveLoggedInEmail(userEmail);
      } catch (storageError: any) {
        console.warn("Error saving credentials:", storageError);
        // Don't block login if storage fails, but show warning
        Alert.alert(
          "Warning",
          "Login successful, but failed to save login preferences. You may need to log in again next time.",
          [{ text: "OK" }],
        );
      }

      router.replace({
        pathname: "/UserManagement/dashboard",
        params: { email: userEmail },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      Alert.alert(
        "Login Error",
        error.message ||
          "An unexpected error occurred. Please check your internet connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!forgotEmail) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      // Reset previous message
      setForgotEmailMessage(null);
      setForgotEmailMessageType(null);

      // Check if email exists in Supabase
      const { data: existingUser, error: fetchError } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("email", forgotEmail)
        .single();

      if (fetchError || !existingUser) {
        setForgotEmailMessage("Email address is not registered");
        setForgotEmailMessageType("error");
        setLoading(false);
        return;
      }

      const edgeEnabled = isPasswordResetEdgeEnabled();
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      if (edgeEnabled) {
        await sendPasswordResetCode(forgotEmail);
        setSentVerificationCode("");
        setSentVerificationCodeExpiresAt(null);
      } else {
        await sendPasswordResetCode(forgotEmail, code);
        setSentVerificationCode(code);
        setSentVerificationCodeExpiresAt(Date.now() + 10 * 60 * 1000);
      }

      setForgotStep(2);
      startCountdown();
      setForgotEmailMessage("Verification code sent to your email");
      setForgotEmailMessageType("success");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }

    setLoading(true);
    try {
      if (isPasswordResetEdgeEnabled()) {
        const valid = await verifyPasswordResetCode(
          forgotEmail,
          verificationCode.trim(),
        );
        if (!valid) {
          Alert.alert(
            "Invalid Code",
            "The verification code is incorrect or expired.",
          );
          return;
        }
      } else {
        const expiresAt = sentVerificationCodeExpiresAt ?? 0;
        if (!sentVerificationCode || Date.now() > expiresAt) {
          Alert.alert(
            "Code Expired",
            "Please request a new verification code.",
          );
          return;
        }
        if (verificationCode.trim() !== sentVerificationCode) {
          Alert.alert("Invalid Code", "The verification code is incorrect.");
          return;
        }
      }

      setForgotStep(3);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const hashedPassword = await bcrypt.hash(String(newPassword ?? ""), 10);

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ password: hashedPassword })
        .eq("email", forgotEmail);

      if (updateError) throw updateError;

      if (isPasswordResetEdgeEnabled()) {
        await invalidatePasswordResetCode(forgotEmail, verificationCode.trim());
      }

      Alert.alert(
        "Success",
        "Password has been reset. You can now log in with your new password.",
        [
          {
            text: "OK",
            onPress: () => {
              setShowForgotPassword(false);
              resetForgotPasswordForm();
            },
          },
        ],
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to reset password");
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
    setForgotEmail("");
    setVerificationCode("");
    setSentVerificationCode("");
    setSentVerificationCodeExpiresAt(null);
    setNewPassword("");
    setConfirmPassword("");
    setForgotStep(1);
    setCountdown(0);
    setForgotEmailMessage(null);
    setForgotEmailMessageType(null);
  };

  const renderOtpBoxes = (code: string) => {
    const slots = 6;
    const normalized = code.slice(0, slots);
    return (
      <View style={styles.otpBoxesRow}>
        {Array.from({ length: slots }).map((_, index) => {
          const char = normalized[index] ?? "";
          return (
            <View
              key={`otp-box-${index}`}
              style={[
                styles.otpBox,
                index === normalized.length && normalized.length < slots
                  ? styles.otpBoxActive
                  : null,
              ]}
            >
              <Text style={styles.otpBoxText}>{char}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (showForgotPassword) {
    return (
      <SafeAreaView style={styles.forgotSafeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.forgotKeyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.forgotScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={styles.forgotBackButton}
              onPress={() => {
                setShowForgotPassword(false);
                resetForgotPasswordForm();
              }}
              activeOpacity={0.8}
            >
              <FontAwesome name="chevron-left" size={14} color="#4B5563" />
            </TouchableOpacity>

            <View style={styles.forgotContent}>
              {forgotStep === 1 && (
                <>
                  <Text style={styles.forgotScreenTitle}>Forgot Password?</Text>
                  <Text style={styles.forgotScreenDescription}>
                    Enter your email address to get the password reset code.
                  </Text>

                  <Text style={styles.forgotLabel}>Email Address</Text>
                  <TextInput
                    style={styles.forgotInput}
                    placeholder="you@gmail.com"
                    placeholderTextColor="#9CA3AF"
                    value={forgotEmail}
                    onChangeText={(text) => {
                      setForgotEmail(text);
                      setForgotEmailMessage(null);
                      setForgotEmailMessageType(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  {forgotEmailMessage && (
                    <Text
                      style={[
                        styles.forgotEmailMessage,
                        forgotEmailMessageType === "success"
                          ? styles.forgotEmailMessageSuccess
                          : styles.forgotEmailMessageError,
                      ]}
                    >
                      {forgotEmailMessage}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.forgotPrimaryButton,
                      loading && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSendCode}
                    disabled={loading}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.forgotPrimaryButtonText}>
                      {loading ? "Sending..." : "Send Code"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {forgotStep === 2 && (
                <>
                  <Text style={styles.forgotScreenTitle}>OTP Verification</Text>
                  <Text style={styles.forgotScreenDescription}>
                    Enter the verification code we just sent.
                  </Text>

                  {renderOtpBoxes(verificationCode)}

                  <TextInput
                    style={styles.hiddenOtpInput}
                    value={verificationCode}
                    onChangeText={(text) =>
                      setVerificationCode(text.replace(/\D/g, "").slice(0, 6))
                    }
                    keyboardType="numeric"
                    maxLength={6}
                    autoFocus
                  />

                  <TouchableOpacity
                    style={styles.forgotPrimaryButton}
                    onPress={handleVerifyCode}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.forgotPrimaryButtonText}>Verify</Text>
                  </TouchableOpacity>

                  <Text style={styles.resendCountdownText}>
                    {countdown > 0
                      ? `Resend OTP in ${countdown}s`
                      : "Resend OTP in 0s"}
                  </Text>

                  <TouchableOpacity
                    style={styles.resendInlineButton}
                    onPress={handleSendCode}
                    disabled={countdown > 0}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.resendInlineButtonText,
                        countdown > 0 && styles.resendButtonTextDisabled,
                      ]}
                    >
                      Resend OTP
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {forgotStep === 3 && (
                <>
                  <Text style={styles.forgotScreenTitle}>
                    Create New Password
                  </Text>
                  <Text style={styles.forgotScreenDescription}>
                    Enter and confirm your new password.
                  </Text>

                  <Text style={styles.forgotLabel}>New Password</Text>
                  <TextInput
                    style={styles.forgotInput}
                    placeholder="New password"
                    placeholderTextColor="#9CA3AF"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />

                  <Text style={styles.forgotLabel}>Confirm Password</Text>
                  <TextInput
                    style={styles.forgotInput}
                    placeholder="Confirm password"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[
                      styles.forgotPrimaryButton,
                      loading && styles.sendButtonDisabled,
                    ]}
                    onPress={handleResetPassword}
                    disabled={loading}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.forgotPrimaryButtonText}>
                      {loading ? "Resetting..." : "Reset Password"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.loginScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.loginContainer}>
            <Text style={styles.loginTitle}>Login</Text>
            <Text style={styles.loginSubtitle}>
              Welcome back to the AgriHydra
            </Text>

            <View style={styles.form}>
              <Text style={styles.loginFieldLabel}>Email or Phone number</Text>
              <View>
                <TextInput
                  placeholder="you@gmail.com or 09123456789"
                  placeholderTextColor={colors.brandGrayText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="default"
                  value={emailOrPhone}
                  onChangeText={setEmailOrPhone}
                  editable={!loading}
                  style={styles.loginInput}
                />
              </View>

              <View style={styles.passwordLabelRow}>
                <Text style={styles.loginFieldLabel}>Password</Text>
                <TouchableOpacity
                  style={styles.forgotWrapper}
                  activeOpacity={0.7}
                  onPress={() => setShowForgotPassword(true)}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor={colors.brandGrayText}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                  style={styles.loginInput}
                />
                <TouchableOpacity
                  style={styles.togglePasswordButton}
                  activeOpacity={0.7}
                  onPress={() => setShowPassword((prev) => !prev)}
                >
                  <FontAwesome
                    name={showPassword ? "eye-slash" : "eye"}
                    size={18}
                    color={colors.brandGrayText}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.checkboxContainer}
                activeOpacity={0.7}
                onPress={() => setRememberMe(!rememberMe)}
                disabled={loading}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <FontAwesome name="check" size={12} color="#fff" />
                  )}
                </View>
                <Text style={styles.rememberMeText}>Keep me signed in</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  loading && styles.loginButtonDisabled,
                ]}
                activeOpacity={0.9}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              <View style={styles.separatorRow}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>or</Text>
                <View style={styles.separatorLine} />
              </View>

              <View style={styles.inlineFooter}>
                <Link href="/UserManagement/signup" asChild>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.createAccountButton}
                  >
                    <Text style={styles.createAccountButtonText}>
                      Create Account
                    </Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Signing in...</Text>
        </View>
      )}

      <AdminAccessDeniedModal
        visible={adminDeniedVisible}
        onDismiss={() => setAdminDeniedVisible(false)}
      />
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
  loginScrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingTop: scale(36),
    paddingBottom: scale(28),
  },
  loginContainer: {
    flex: 1,
  },
  loginTitle: {
    fontFamily: fonts.bold,
    fontSize: fontScale(40),
    color: "#111827",
  },
  loginSubtitle: {
    marginTop: scale(4),
    marginBottom: scale(24),
    fontFamily: fonts.regular,
    fontSize: fontScale(14),
    color: "#6B7280",
  },
  loginFieldLabel: {
    fontFamily: fonts.medium,
    fontSize: fontScale(14),
    color: "#1F2937",
    marginBottom: scale(8),
  },
  passwordLabelRow: {
    marginTop: scale(2),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loginInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: fontScale(14),
    color: "#111827",
    backgroundColor: "#fff",
  },
  phoneFrame: {
    flex: 1,
    backgroundColor: "#fff",
  },
  greenBackground: {
    backgroundColor: colors.brandGreen,
    paddingTop: scale(80),
    paddingBottom: scale(130),
    paddingHorizontal: scale(28),
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  header: {
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: scale(100),
    height: scale(100),
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontScale(32),
    color: "#fff",
    textAlign: "center",
    marginTop: 8,
  },
  cardContainer: {
    marginTop: -scale(80),
    paddingHorizontal: scale(20),
    paddingBottom: scale(40),
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 24,
    alignItems: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    color: "#3E9B4F",
    marginTop: 12,
  },
  form: {
    gap: 16,
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
  togglePasswordButton: {
    position: "absolute",
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
    fontSize: 12,
    color: "#000",
    backgroundColor: "#F8F8F8",
  },
  rememberMeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.brandGrayBorder,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.brandGreen,
    borderColor: colors.brandGreen,
  },
  rememberMeText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "#000",
  },
  forgotWrapper: {
    alignSelf: "flex-end",
  },
  forgotText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.brandBlue,
  },
  loginButton: {
    backgroundColor: "#3E9B4F",
    borderRadius: 999,
    marginTop: scale(8),
    justifyContent: "center",
    alignItems: "center",
    minHeight: 44,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
  },
  inlineFooter: {
    marginTop: 10,
  },
  separatorText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.brandGrayText,
  },
  separatorRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  createAccountButton: {
    backgroundColor: "#2F5BFF",
    borderRadius: 999,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  createAccountButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: "#fff",
  },
  inlineFooterText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.brandGrayText,
  },
  inlineFooterLink: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.brandBlue,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.brandGrayText,
  },
  forgotSafeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  forgotKeyboardAvoidingView: {
    flex: 1,
  },
  forgotScrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingTop: scale(10),
    paddingBottom: scale(30),
  },
  forgotBackButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  forgotContent: {
    marginTop: scale(34),
  },
  forgotScreenTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontScale(34),
    color: "#111827",
    marginBottom: scale(8),
  },
  forgotScreenDescription: {
    fontFamily: fonts.regular,
    fontSize: fontScale(14),
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: scale(28),
  },
  forgotLabel: {
    fontFamily: fonts.medium,
    fontSize: fontScale(14),
    color: "#1F2937",
    marginBottom: scale(8),
  },
  forgotInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: fontScale(14),
    color: "#111827",
    backgroundColor: "#fff",
    marginBottom: scale(14),
  },
  forgotPrimaryButton: {
    marginTop: scale(8),
    backgroundColor: "#3E9B4F",
    borderRadius: 999,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  forgotPrimaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontScale(14),
    color: "#fff",
  },
  otpBoxesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  otpBox: {
    width: 44,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  otpBoxActive: {
    borderColor: "#3E9B4F",
  },
  otpBoxText: {
    fontFamily: fonts.semibold,
    fontSize: fontScale(20),
    color: "#111827",
  },
  hiddenOtpInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 50,
    left: -1000,
  },
  resendCountdownText: {
    marginTop: scale(18),
    fontFamily: fonts.regular,
    fontSize: fontScale(13),
    color: "#6B7280",
    textAlign: "center",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  resendInlineButton: {
    marginTop: scale(6),
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  resendInlineButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontScale(14),
    color: "#3E9B4F",
    textAlign: "center",
  },
  resendButtonTextDisabled: {
    color: colors.brandGrayText,
  },
  forgotEmailMessage: {
    marginTop: -4,
    marginBottom: 8,
    fontFamily: fonts.regular,
    fontSize: fontScale(13),
    textAlign: "left",
    width: "100%",
  },
  forgotEmailMessageSuccess: {
    color: colors.brandGreen,
  },
  forgotEmailMessageError: {
    color: "#FF3B30",
  },
});
