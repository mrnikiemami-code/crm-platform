# Shared template creation and editing

Implemented in Communication 0.1.71 against a51ec331.

## Result

The existing native New command opens the same editor as the record page: title, one source selector, explicit recipient relation when needed, body, source-specific variables, sample and preview. It creates no record until Create. After successful creation it opens that record. Cancel/discard creates no record.

The native list, deletion, existing record layout and CAS edit save remain in place. No new table or user-data migration.

## Integration

- Host: SidePanelRecordCreationFormPage chooses the create component for the template object by stable identifier plus matching application ownership. All callers of the native creation-form provider use this route.
- App: create-template.front-component imports the same TemplateEditor used by template-variable-guide.front-component, with mode=create. The host supplies the draft UUID through the existing single-record execution context.
- Server: guarded create-template uses one native createMessageTemplate mutation with the full source model. An identical retry on the draft UUID returns the previous write; a different existing value fails without overwriting.
- Preview accepts a draft with an explicit validated source, without reading or writing a template. Existing preview requests with templateId still read that record under the caller's permissions.
- The fixed Communication bridge allow-list adds only create-template, not a generic data proxy.

## Deployment state

Not installed from this environment. Both local bridges returned Internal error. Update twenty-front and install Communication 0.1.71 together; the renderer package is unchanged. Reload the host source/build according to its existing runtime. The app tarball alone cannot replace the native host creation page.

## User acceptance still requiring main/4D

Open New from the existing template list. Before creating, switch through eligible sources, verify their own fields, insert a token, choose a sample and preview. Save once, verify one row with the complete body and source, reload, and edit it. Separately cancel an unsaved draft and verify no row was created. Use only disposable fixtures created for this check; soft-delete only their exact ids. Never modify user templates, provider variables or send SMS.
