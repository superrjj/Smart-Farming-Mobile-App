import { FontAwesome } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
};

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

/**
 * Shown when an administrator tries to use the mobile app.
 * Admins must use the AgriHydra web dashboard.
 */
export function AdminAccessDeniedModal({ visible, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconCircle}>
            <FontAwesome name="lock" size={24} color="#B45309" />
          </View>
          <Text style={styles.title}>Mobile access not available</Text>
          <Text style={styles.body}>
            Administrator accounts cannot sign in to the AgriHydra mobile app.
            Please use the web dashboard in your browser to manage users, roles,
            and system settings.
          </Text>
          <Text style={styles.footerNote}>
            Farmer accounts continue to use this app for field monitoring and
            irrigation.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>OK</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 10,
  },
  footerNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: "#fff",
  },
});
