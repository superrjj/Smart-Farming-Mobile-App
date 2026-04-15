import { FontAwesome } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type StatusType = "success" | "error" | "warning";
type ModalVariant = "status" | "confirm";
type ConfirmVariant = "default" | "destructive" | "muted";

type StatusMessageModalProps = {
  visible: boolean;
  type?: StatusType;
  variant?: ModalVariant;
  title: string;
  message: string;
  onClose: () => void;
  buttonText?: string;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: ConfirmVariant;
  iconName?: keyof typeof FontAwesome.glyphMap;
};

const palette = {
  success: {
    icon: "check-circle" as const,
    iconColor: "#166534",
    iconBg: "#DCFCE7",
    buttonBg: "#16A34A",
  },
  error: {
    icon: "times-circle" as const,
    iconColor: "#991B1B",
    iconBg: "#FEE2E2",
    buttonBg: "#DC2626",
  },
  warning: {
    icon: "exclamation-triangle" as const,
    iconColor: "#92400E",
    iconBg: "#FEF3C7",
    // Warning status dialogs should not look like success.
    buttonBg: "#64748B",
  },
};

export function StatusMessageModal({
  visible,
  type = "success",
  variant = "status",
  title,
  message,
  onClose,
  buttonText = "OK",
  onConfirm,
  confirmText = "OK",
  cancelText = "Cancel",
  confirmVariant = "default",
  iconName,
}: StatusMessageModalProps) {
  const theme = palette[type];
  const showConfirmActions = variant === "confirm";
  const resolvedIcon = iconName ?? theme.icon;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconCircle, { backgroundColor: theme.iconBg }]}>
            <FontAwesome name={resolvedIcon} size={24} color={theme.iconColor} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {showConfirmActions ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.confirmButton,
                  confirmVariant === "destructive" && styles.confirmButtonDestructive,
                  confirmVariant === "muted" && styles.confirmButtonMuted,
                ]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.buttonBg }]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </TouchableOpacity>
          )}
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
    maxWidth: 380,
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
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  cancelButtonText: {
    color: "#334155",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  confirmButtonDestructive: {
    backgroundColor: "#DC2626",
  },
  confirmButtonMuted: {
    backgroundColor: "#64748B",
  },
});

