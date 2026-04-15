import { useEffect, useRef, useState } from "react";
import { Alert, AlertButton } from "react-native";

import { StatusMessageModal } from "@/components/status-message-modal";

type DialogState = {
  visible: boolean;
  title: string;
  message: string;
  variant: "status" | "confirm";
  type: "success" | "error" | "warning";
  buttonText?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "default" | "destructive" | "muted";
  iconName?: "check-circle" | "times-circle" | "exclamation-triangle" | "sign-out";
  onConfirm?: () => void;
  onCancel?: () => void;
};

const initialState: DialogState = {
  visible: false,
  title: "",
  message: "",
  variant: "status",
  type: "success",
};

function inferStatusType(
  title: string,
  message: string,
): "success" | "error" | "warning" {
  const text = `${title} ${message}`.toLowerCase();
  if (
    text.includes("warning") ||
    text.includes("past") ||
    text.includes("outside") ||
    text.includes("caution") ||
    text.includes("permission")
  ) {
    return "warning";
  }
  if (
    text.includes("error") ||
    text.includes("failed") ||
    text.includes("invalid") ||
    text.includes("missing") ||
    text.includes("not found")
  ) {
    return "error";
  }
  return "success";
}

function toSafeText(value?: string): string {
  return typeof value === "string" ? value : "";
}

function normalizeButtons(buttons?: AlertButton[]): AlertButton[] {
  if (!buttons || buttons.length === 0) return [{ text: "OK" }];
  return buttons;
}

export function AlertOverrideProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dialog, setDialog] = useState<DialogState>(initialState);
  const nativeAlertRef = useRef(Alert.alert.bind(Alert));

  useEffect(() => {
    const nativeAlert = nativeAlertRef.current;

    Alert.alert = (title, message, buttons, options) => {
      const safeTitle = toSafeText(title);
      const safeMessage = toSafeText(message);
      const normalized = normalizeButtons(buttons);

      // Fallback for uncommon cases to keep native behavior.
      if (normalized.length > 2) {
        nativeAlert(safeTitle, safeMessage, normalized, options);
        return;
      }

      if (normalized.length === 1) {
        const ok = normalized[0];
        setDialog({
          visible: true,
          title: safeTitle,
          message: safeMessage,
          variant: "status",
          type: inferStatusType(safeTitle, safeMessage),
          buttonText: ok.text ?? "OK",
          onCancel: ok.onPress,
        });
        return;
      }

      const cancelButton =
        normalized.find((btn) => btn.style === "cancel") ?? normalized[0];
      const confirmButton =
        normalized.find((btn) => btn !== cancelButton) ?? normalized[1];
      const joined = `${safeTitle} ${safeMessage}`.toLowerCase();
      const isLogoutConfirm =
        joined.includes("log out") ||
        joined.includes("logout") ||
        joined.includes("sign out");

      setDialog({
        visible: true,
        title: safeTitle,
        message: safeMessage,
        variant: "confirm",
        type: isLogoutConfirm
          ? "warning"
          : inferStatusType(safeTitle, safeMessage),
        cancelText: cancelButton?.text ?? "Cancel",
        confirmText: confirmButton?.text ?? "OK",
        confirmVariant: isLogoutConfirm ? "destructive" : "default",
        iconName: isLogoutConfirm ? "sign-out" : undefined,
        onCancel: cancelButton?.onPress,
        onConfirm: confirmButton?.onPress,
      });
    };

    return () => {
      Alert.alert = nativeAlert;
    };
  }, []);

  const closeDialog = () => {
    const onCancel = dialog.onCancel;
    setDialog(initialState);
    if (onCancel) onCancel();
  };

  const confirmDialog = () => {
    const onConfirm = dialog.onConfirm;
    setDialog(initialState);
    if (onConfirm) onConfirm();
  };

  return (
    <>
      {children}
      <StatusMessageModal
        visible={dialog.visible}
        type={dialog.type}
        variant={dialog.variant}
        title={dialog.title}
        message={dialog.message}
        onClose={closeDialog}
        buttonText={dialog.buttonText}
        onConfirm={confirmDialog}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        confirmVariant={dialog.confirmVariant}
        iconName={dialog.iconName}
      />
    </>
  );
}

