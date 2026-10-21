# ScholarX · Profile first, possibilities next

The new entry screen starts with the student's own details. It keeps the existing ScholarX name, forest and mint palette, group chat, navigation, agent roles, research, results and application sections. Saved conversations and existing research workspaces continue opening normally.

## The flow

1. A new student sees the manual profile screen first, including all fourteen supported profile fields and optional resume/transcript uploads.
2. Saving the form stores the supplied facts and documents before requesting research. No opportunity search starts while the user is still filling the form.
3. Arjun checks uploaded documents. If current studies, intended degree/subject or country preferences are still missing, he asks one focused question in the group chat. He uses document-provided facts instead of asking for them again.
4. Once the essentials are available, the existing Nova → Sage → Mira → Leo workflow continues. Missing grades, nationality, test results and other unknowns remain explicit.
5. The student can compare researched opportunities and review the existing draft workflow. Applications are never submitted automatically.

## Visual direction

An original procedural Three.js sculpture, the **Possibility Atlas**, combines a porcelain globe, engraved meridians, warm metallic orbital paths, five destination markers and folded paper aircraft. It adapts the sculptural direction of the supplied [ThreeUI reference](https://threeui.com/hero/koi-mecha) to scholarship discovery; the artwork and implementation are created for ScholarX.

Drag the atlas to rotate it, use the arrow keys, double-click or press Home to reset, and pause motion using its controls. Text and form fields occupy a separate readable surface. Existing chat uses a quieter version behind the messages.

- The Three.js scene loads separately from the application bundle. It uses no remote 3D models or HDR downloads.
- Desktop hero rendering is capped at 30 frames per second; mobile at 24, with lower pixel density. The decorative chat scene uses a smaller rendering budget.
- Hidden tabs and off-screen scenes stop rendering. Geometry, materials, environment textures and renderer resources are released on unmount.
- Reduced-motion preferences and data-saving mode use a static atlas. WebGL failure also falls back to the static presentation without blocking the form.
- Light and dark modes keep the existing brand palette. Mobile form fields remain scrollable and use readable input text.

## Verification

The browser checks cover manual profile saving and file upload order, incomplete-profile handoff, real WebGL rotation/reset/pause, a 320-pixel phone layout, reduced motion and unavailable WebGL. The full browser suite also covers existing chat scrolling, themes, source cards, workspace switching, deletion, late replies and quota warnings.

[Desktop](../artifacts/profile-first-desktop.png) · [Dark](../artifacts/profile-first-dark.png) · [Phone](../artifacts/profile-first-phone.png) · [Real workflow check](../artifacts/profile-first-live-validation.json).

The hackathon feature paths are implemented. Full evidence completeness is a separate question: previous live packs retained unresolved funding, current-date and application gaps. Their demo workspaces have since been deleted, so the latest [requirements audit](requirements-audit.md) labels those reports as historical and does not recreate the deleted students or claim a fresh complete research pack.
