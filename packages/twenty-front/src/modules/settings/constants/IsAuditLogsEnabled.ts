// This deployment does not use audit logs (no ClickHouse event logging), so the
// whole security section is hidden rather than shown in a permanently disabled
// state. Revert by flipping this flag.
export const IS_AUDIT_LOGS_ENABLED = false;
