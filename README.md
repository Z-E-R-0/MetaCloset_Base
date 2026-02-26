# MetaCloset

A digital wardrobe and Dance Arena app: try on garments in AR or with static images, and drive a crew of 3D avatars from a single dance video using pose tracking.

## Features

- **Home & catalog** – Browse garments and choose AR try-on or upload a photo.
- **Dance Arena** – Upload a dance video; pose is tracked with MediaPipe and retargeted to multiple 3D avatars in formations (Line, V, Circle, Grid).
- **AR experience** – Live camera try-on with garment overlay.
- **Static image** – Upload a photo and see the garment on an avatar.
- **Edit & share** – Optional AI-powered edit flow (Gemini); share and download images.

## Run locally

**Prerequisites:** Node.js (v18+)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the dev server:
   ```bash
   npm run dev
   ```

3. Open the URL shown in the terminal (e.g. `http://localhost:5173`).

## Optional: Gemini API key (Edit page)

The **Edit** flow (e.g. background swap) uses Google’s Gemini API. To enable it:

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Create a file `.env.local` in the project root:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
3. Restart the dev server.

Without a key, the rest of the app (Home, Dance Arena, AR, Static image, Share) works as usual.

## Build for production

```bash
npm run build
```

Output is in the `dist` folder. Preview the build with:

```bash
npm run preview
```

## Tech stack

- React, TypeScript, Vite  
- Three.js (3D avatars and scene)  
- MediaPipe Pose Landmarker (dance video pose tracking)  
- Optional: Google Gemini API (edit flow)
