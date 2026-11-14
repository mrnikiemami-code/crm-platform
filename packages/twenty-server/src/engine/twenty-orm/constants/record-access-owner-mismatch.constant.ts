// SQLSTATE raised by the record-access triggers when a row would carry a
// different owner than its customer.
//
// A dedicated code is used instead of the generic `check_violation` (23514) for
// two reasons: the mapping from error to client response must not depend on
// message text, and a real check violation elsewhere must keep its current
// (generic) behaviour. Class "PG" is not used by PostgreSQL itself, so the code
// cannot collide with a server-raised error.
export const RECORD_ACCESS_OWNER_MISMATCH_SQLSTATE = 'PGRAC';
