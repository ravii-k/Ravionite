# Ravionite
---
> *We are all living in a simulation*
---
<p align="center">
  <strong>This repository is a technical showcase of my skills in AI systems, prompt engineering, and product development, serving as a dedicated testing ground for high-quality writing and functional design. Please reach out if you are looking for premium, visually-driven websites with high-end animations, or custom software and mobile applications for both iOS and Android.</strong>
</p>

<p align="center">
  <a href="./index.html">Home</a> ·
  <a href="./startup-founder.html">Startup Founder</a> ·
  <a href="./research-intelligence.html">Research Intelligence</a> ·
  <a href="./agent-workflows.html">Agent Workflows</a> ·
  <a href="./memory-systems.html">Memory Systems</a>
</p>

## Overview

This repository contains information about me, my projects, and prompt-collection pages. The visual language is built around a blue-purple cinematic theme with custom hero animations, glass panels, interactive prompt tabs, and long-form landing page storytelling.

The site presents work across:

- AI systems and prompt engineering
- Research-driven prompt collections
- Writing and book sample chapters
- Software projects, including `R-Journal`
- Private admin request and inbox workflow backed by Supabase Edge Functions

## Included Pages

- `index.html` - Main landing page
- `startup-founder.html` - Founder-focused prompt collection for market, offer, growth, and scale decisions
- `research-intelligence.html` - Flagship research prompt collection
- `agent-workflows.html` - Prompt collection for orchestration and tool-driven agents
- `memory-systems.html` - Prompt collection for memory architecture and state design
- `narrative-analysis.html` - Archived page kept in the project but currently not featured on the landing page

## Design Notes

- Shared visual system lives in `theme.css`
- Shared animation logic lives in `theme.js`
- Collection page interactions live in `collection-page.js`
- Book sample chapters are intended to be served through private Supabase Storage signed URLs
- Public forms are routed through Supabase Edge Functions instead of direct browser-to-table writes

## Local Preview

Open `index.html` directly in a browser, or run a simple local server from this folder for smoother navigation:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Project Structure

```text
.
├── index.html
├── startup-founder.html
├── research-intelligence.html
├── agent-workflows.html
├── memory-systems.html
├── narrative-analysis.html
├── theme.css
├── theme.js
├── collection-page.js
└── supabase/
```

## 👨‍💻 Author

**Ravi Kashyap**
- GitHub: [@Ravionite](https://github.com/ravii-k)

---

> Built with ❤️
