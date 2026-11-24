# CRM — Design-to-Implementation Gate (binding for Cursor UI tasks)

**Status:** ACTIVE • added after USER_UAT_REJECTED of TAX-PANEL-016, 2026-11-24.  
**Applies to:** CRM UI changes that use external design tools, beginning with the re-design of the existing tax-and-duty panel.  
**Owner of design judgment:** Design agent using Superdesign, audited with Impeccable; Cursor implementer must not silently substitute its own design decisions.

## Failure that motivated this gate

The TAX-PANEL-016 design record explicitly selected an **A/B hybrid**: compact rows of draft A **plus visible labelled action controls of draft B**. The shipped `tax-policy-settings-panel.tsx` implemented the actions with `styles.ghostButton` (`height: 28`, transparent background and border, `fontSize: 12`), making functional actions nearly indistinguishable from ordinary text. The chosen concept was **not faithfully implemented**. The existing functional DOM tests did not validate this perceptual mismatch. The user explicitly rejected the visual result.

This gate is about **designer ownership and independent fidelity checks**, **not prescribing a particular border, color, height or finished solution**. The designer must diagnose UX issues from the actual observed screen and produce its own solution.

## Required sequence (cannot claim design PASS if any evidence is missing)

1. **Grounding:** read current component, existing Superdesign A/B drafts, actual UAT screenshot as provided to the executing agent, Twenty design tokens and requirements. Record the design critique *before* proposing changes. Do not lead the designer by giving the CSS fix as its requested output; ask it to identify problematic interaction hierarchy and propose improvements.
2. **Designer-led proposal:** invoke authenticated Superdesign **again** to review/iterate the existing chosen concept, or create new alternatives if its critique recommends that. Capture exact project/draft IDs, CLI command or service calls, outputs and editable source of final proposal in `docs/design/`. No handwritten design passed off as generated.
3. **Design decision and fidelity contract:** designer authors a short `DESIGN-DECISION.md` stating **observable UX outcomes and non-negotiable interaction behaviors** and any deliberate departures from its earlier drafts. No silent hybrid reinterpretation. Include action hierarchy, readability and keyboard/mouse/mobile interactions; do not prescribe arbitrary CSS values without designer justification.
4. **Independent critique:** run Impeccable on the designer's output and on the implemented screen. Record actual commands/results and limitations; static accessibility scan alone is not acceptance. A separate reviewer/verification pass compares **selected source design vs served frontend**, not just unit tests.
5. **Implementation:** Cursor edits only the existing targeted UI component(s) to faithfully reproduce the designer-approved result using Twenty's native design system where feasible. Any design-affecting deviation (layout, contrast, action treatment, typography, density, affordance) is logged with reason and **returns to designer for approval before acceptance**. Cursor cannot approve its own visual compromises.
6. **Fidelity proof:** verify visible action controls are distinguishable from labels without hover and their hierarchy is clear; record DOM-computed presentation, tab/focus behavior, interaction actions and desktop/mobile widths. Verify designer-defined acceptance criteria in the running Dev host, not only prototype. No screenshots in automated test harness under existing project rule; user screenshots can be used as references.
7. **Gates:** design fidelity **PASS** requires evidence the designer's meaningful choices survived implementation. Functional tests PASS cannot override design FAIL. A user-rejected design is `USER_UAT_REJECTED` until user signs off; do not call it READY_FOR_USER_UAT solely because it deploys.
8. **Architecture protection:** do not change accounting adapter, tax/money domain, backend, database, PDF, historical revisions or permissions in a visual-design task. No :6080 changes, main worker restarts, live vendor access or financial writes.

## Immediate assignment — TAX-PANEL-016 design re-review

**Designer brief:** independently inspect the user-rejected tax panel, identify why the interaction controls and text hierarchy are confusing, and propose the best solution. Optimize for a Persian RTL merchant operator, few policies today but a growing list, unambiguous actions, minimal redundant microcopy and consistency with Twenty. Designer is free to change the UI concept, not the underlying business rules. **Do not hand the designer our hypothesized CSS solution**; let the designer discover and justify the response.

The already-correct finance semantics must stay: one policy with tax and duty rates, exactly one active default via server authority, secure delete/deactivate behavior, unchanged historical documents. For TAX-PANEL-016, independent financial/integrity blocker `S5-15c` (concurrent delete race) and previously detected tracked test DB credential exposure remain **OPEN** and must not be hidden by a new UI design PASS. Those problems require separately authorized narrow backend/security fixes; do not perform them as side effects of the design assignment.

**Deliverables:** designer's recorded diagnosis; Superdesign revised output and IDs; Impeccable audits; designer-owned design decision; implementation fidelity comparison; DOM UAT of all actions, mobile and desktop; user-facing test URL and honest gate state. `STOP_FOR_ARCHITECT` then user visual approval.
