// Calendar sync is not part of this deployment. Every calendar surface is
// hidden behind this single flag instead of removing objects or routes, so the
// decision stays reviewable in one place and can be reverted by one edit.
export const IS_CALENDAR_FEATURE_ENABLED = false;
