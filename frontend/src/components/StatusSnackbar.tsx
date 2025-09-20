import { Snackbar, Alert } from "@mui/material";
import { SyntheticEvent } from "react";

export type StatusSnackbarProps = {
  open: boolean;
  message: string;
  severity?: "success" | "info" | "warning" | "error";
  onClose: () => void;
};

export default function StatusSnackbar({
  open,
  message,
  severity = "info",
  onClose,
}: StatusSnackbarProps) {
  const handleClose = (
    _event?: SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }
    onClose();
  };

  return (
    <Snackbar open={open} autoHideDuration={4000} onClose={handleClose}>
      <Alert onClose={handleClose} severity={severity} sx={{ width: "100%" }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
