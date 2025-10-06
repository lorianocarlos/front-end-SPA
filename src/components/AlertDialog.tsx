import type { ReactNode } from "react";
import Dialog from "./Dialog";

type AlertTone = "info" | "success" | "warning" | "danger";

type AlertDialogProps = {
  open: boolean;
  title?: string;
  message: ReactNode;
  tone?: AlertTone;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
};

const toneSymbol: Record<AlertTone, string> = {
  info: "i",
  success: "+",
  warning: "!",
  danger: "!",
};

const toneTitle: Record<AlertTone, string> = {
  info: "Aviso",
  success: "Sucesso",
  warning: "Atencao",
  danger: "Erro",
};

const AlertDialog = ({
  open,
  title,
  message,
  tone = "info",
  confirmLabel = "OK",
  onConfirm,
  onClose,
}: AlertDialogProps) => {
  const body =
    typeof message === "string" ? <p className="modal-alert__message">{message}</p> : message;
  const resolvedTitle = title ?? toneTitle[tone];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={resolvedTitle}
      iconTone={tone}
      icon={<span className={`modal-symbol modal-symbol--${tone}`}>{toneSymbol[tone]}</span>}
      actions={
        <button type="button" className="button modal-alert__confirm" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      }
    >
      <div className="modal-alert__body">{body}</div>
    </Dialog>
  );
};

export default AlertDialog;
