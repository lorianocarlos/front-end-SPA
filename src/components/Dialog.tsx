import { createPortal } from "react-dom";
import { useEffect, useId } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { FiX } from "react-icons/fi";

type DialogTone = "info" | "success" | "warning" | "danger";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  iconTone?: DialogTone;
  actions?: ReactNode;
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
};

const Dialog = ({
  open,
  onClose,
  title,
  description,
  icon,
  iconTone,
  actions,
  children,
  size = "md",
}: DialogProps) => {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const handleOverlayClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const iconClassName = iconTone ? `modal-icon modal-icon--${iconTone}` : "modal-icon";

  return createPortal(
    <div className="modal-overlay" onClick={handleOverlayClick} role="presentation">
      <section
        className={`modal-card modal-card--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="modal-header">
          <div className="modal-header__info">
            {icon && (
              <span className={iconClassName} aria-hidden="true">
                {icon}
              </span>
            )}
            <div>
              {title && (
                <h3 id={titleId} className="modal-title">
                  {title}
                </h3>
              )}
              {description && (
                <p id={descriptionId} className="modal-description">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            <FiX aria-hidden="true" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {actions && <footer className="modal-actions">{actions}</footer>}
      </section>
    </div>,
    document.body
  );
};

export default Dialog;