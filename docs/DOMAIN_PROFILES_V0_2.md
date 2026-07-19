# Analysis Profiles v0.2

## Goal

Generalize PlanDelta without pretending that one model understands every kind
of image. An analysis profile is a versioned configuration and implementation
boundary for one family of revision documents.

## Profile contract

Each profile defines:

- stable ID and version;
- display name and description;
- accepted file types and page/image limits;
- CV/alignment/diff thresholds;
- category vocabulary and fallback category;
- OCR normalization hints and protected identifiers;
- impact/affected-discipline rules;
- allowed quantity units/helpers;
- RAG document types and retrieval filters;
- agent role instructions and answer terminology;
- disclaimers;
- fixture/evaluation dataset version.

The profile does not provide authorization, tool permissions, or cost limits.
Those remain global guardrails.

## Construction drawing profile

Preserve all current behavior and mappings:

- wall/linework;
- door;
- window;
- fixture/symbol;
- dimension;
- text/note;
- room label;
- unknown.

Preserve affected-trade inference and existing golden tolerances. Migration to
the registry must not silently change v0.1.0 results.

## Engineering schematic profile

Required v0.2 categories:

- component/symbol;
- connection/line;
- label/identifier;
- note;
- dimension/value;
- removed element;
- unknown.

Possible affected disciplines are generic and evidence-bound, for example
electrical, controls, instrumentation, mechanical, and documentation. Do not
claim circuit correctness, safety certification, or regulatory compliance.

Required committed sample:

- one baseline schematic;
- one revised schematic;
- visible line/component/label changes;
- one supporting technical note/specification;
- expected normalized regions;
- expected OCR/identifier deltas where stable;
- at least five grounded questions including one combined visual/RAG question,
  one conflict/insufficient-evidence question, and one impact question;
- cached public sample answers clearly labelled as sample data.

## Project and UI behavior

- Select a profile when creating a project.
- Show the profile on project, analysis, report, and chat surfaces.
- Use profile-specific vocabulary without changing the core evidence model.
- Disallow an unsafe profile change after revisions, analyses, or knowledge
  exist. Offer a new project or explicit re-analysis flow.
- Keep normalized coordinates and core change types shared across profiles.

## Future profiles

Mechanical drawings and packaging artwork may be documented as candidates.
They are not supported until they have profile code, fixtures, golden tests,
RAG questions, UI copy, limitations, and a complete end-to-end verification.
