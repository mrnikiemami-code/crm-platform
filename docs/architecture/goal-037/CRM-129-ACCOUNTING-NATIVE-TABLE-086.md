# CRM-129 — Native table layout / user UAT correction 086

Candidate quotation@0.1.86. Base accepted 085, user UAT reported double vertical scrollbar, footer movement and pagination alignment.

Use existing Twenty Table primitives and SettingsPaginationControls. Desktop/normal-height lists: finite height flex chain from host, only table viewport scrolls; footer stays at the bottom regardless of row count. Forms and overview retain existing outer scroll. Very short viewports (<=620px) use a single outer scroll instead, to avoid inaccessible wrapped toolbar/footer. Documents history lives within the same scroll viewport. Numbered pager: max five adjacent numbers, independent first/previous/next/last controls, center aligned jump, native Twenty Input and Select, Persian digits and accessible labels. Align native header/cells in RTL. No financial, permissions, provider, API or selection changes.

Cursor: sync exact candidate, build front and quotation and dependencies, deploy clean Dev image, apply 0.1.86 and verify version/health only. Run focused pagination helper tests if available as build preflight. Do not edit product source, no screenshots, no Intranet, no outbound. User performs visual/functional acceptance. Do not claim UAT PASS before user checks.
