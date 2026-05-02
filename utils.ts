@tailwind base;
@tailwind components;
@tailwind utilities;

/* LIGHT MODE */
:root {
  --button-outline: rgba(0, 0, 0, .10);
  --badge-outline: rgba(0, 0, 0, .05);
  --opaque-button-border-intensity: -8;
  --elevate-1: rgba(0, 0, 0, .03);
  --elevate-2: rgba(0, 0, 0, .08);
  --background: 220 20% 97%;
  --foreground: 220 20% 10%;
  --border: 220 15% 88%;
  --card: 220 20% 95%;
  --card-foreground: 220 20% 10%;
  --card-border: 220 15% 90%;
  --sidebar: 220 25% 93%;
  --sidebar-foreground: 220 20% 10%;
  --sidebar-border: 220 15% 88%;
  --sidebar-primary: 195 100% 42%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 195 20% 85%;
  --sidebar-accent-foreground: 220 20% 10%;
  --sidebar-ring: 195 100% 42%;
  --popover: 220 20% 94%;
  --popover-foreground: 220 20% 10%;
  --popover-border: 220 15% 88%;
  --primary: 195 100% 42%;
  --primary-foreground: 0 0% 100%;
  --secondary: 260 60% 55%;
  --secondary-foreground: 0 0% 100%;
  --muted: 220 15% 90%;
  --muted-foreground: 220 10% 45%;
  --accent: 195 20% 90%;
  --accent-foreground: 220 20% 10%;
  --destructive: 0 84% 48%;
  --destructive-foreground: 0 0% 98%;
  --input: 220 15% 75%;
  --ring: 195 100% 42%;
  --chart-1: 195 100% 42%;
  --chart-2: 260 60% 55%;
  --chart-3: 160 70% 40%;
  --chart-4: 35 90% 50%;
  --chart-5: 340 80% 50%;
  --font-sans: 'Space Grotesk', 'Inter', sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --radius: .5rem;
  --shadow-2xs: 0px 2px 0px 0px hsl(195 100% 42% / 0.00);
  --shadow-xs: 0px 2px 0px 0px hsl(195 100% 42% / 0.00);
  --shadow-sm: 0px 2px 0px 0px hsl(195 100% 42% / 0.00), 0px 1px 2px -1px hsl(195 100% 42% / 0.00);
  --shadow: 0px 2px 0px 0px hsl(195 100% 42% / 0.00), 0px 1px 2px -1px hsl(195 100% 42% / 0.00);
  --shadow-md: 0px 2px 0px 0px hsl(195 100% 42% / 0.00), 0px 2px 4px -1px hsl(195 100% 42% / 0.00);
  --shadow-lg: 0px 2px 0px 0px hsl(195 100% 42% / 0.00), 0px 4px 6px -1px hsl(195 100% 42% / 0.00);
  --shadow-xl: 0px 2px 0px 0px hsl(195 100% 42% / 0.00), 0px 8px 10px -1px hsl(195 100% 42% / 0.00);
  --shadow-2xl: 0px 2px 0px 0px hsl(195 100% 42% / 0.00);
  --tracking-normal: 0em;
  --spacing: 0.25rem;

  --sidebar-primary-border: hsl(var(--sidebar-primary));
  --sidebar-primary-border: hsl(from hsl(var(--sidebar-primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --sidebar-accent-border: hsl(var(--sidebar-accent));
  --sidebar-accent-border: hsl(from hsl(var(--sidebar-accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --primary-border: hsl(var(--primary));
  --primary-border: hsl(from hsl(var(--primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --secondary-border: hsl(var(--secondary));
  --secondary-border: hsl(from hsl(var(--secondary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --muted-border: hsl(var(--muted));
  --muted-border: hsl(from hsl(var(--muted)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --accent-border: hsl(var(--accent));
  --accent-border: hsl(from hsl(var(--accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --destructive-border: hsl(var(--destructive));
  --destructive-border: hsl(from hsl(var(--destructive)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
}

#replit-pill-host {
  display: none !important;
}

.dark {
  --button-outline: rgba(255, 255, 255, .10);
  --badge-outline: rgba(255, 255, 255, .05);
  --opaque-button-border-intensity: 9;
  --elevate-1: rgba(255, 255, 255, .04);
  --elevate-2: rgba(255, 255, 255, .09);
  --background: 225 25% 6%;
  --foreground: 210 20% 92%;
  --border: 225 20% 14%;
  --card: 225 22% 9%;
  --card-foreground: 210 20% 92%;
  --card-border: 225 20% 12%;
  --sidebar: 225 25% 8%;
  --sidebar-foreground: 210 20% 92%;
  --sidebar-border: 225 20% 12%;
  --sidebar-primary: 195 100% 50%;
  --sidebar-primary-foreground: 225 25% 6%;
  --sidebar-accent: 225 18% 14%;
  --sidebar-accent-foreground: 210 20% 92%;
  --sidebar-ring: 195 100% 50%;
  --popover: 225 22% 11%;
  --popover-foreground: 210 20% 92%;
  --popover-border: 225 20% 14%;
  --primary: 195 100% 50%;
  --primary-foreground: 225 25% 6%;
  --secondary: 260 60% 60%;
  --secondary-foreground: 0 0% 100%;
  --muted: 225 18% 14%;
  --muted-foreground: 220 10% 55%;
  --accent: 225 18% 12%;
  --accent-foreground: 210 20% 92%;
  --destructive: 0 84% 55%;
  --destructive-foreground: 0 0% 98%;
  --input: 225 18% 22%;
  --ring: 195 100% 50%;
  --chart-1: 195 100% 55%;
  --chart-2: 260 60% 65%;
  --chart-3: 160 70% 50%;
  --chart-4: 35 90% 60%;
  --chart-5: 340 80% 60%;
  --shadow-2xs: 0px 2px 0px 0px hsl(195 100% 50% / 0.00);
  --shadow-xs: 0px 2px 0px 0px hsl(195 100% 50% / 0.00);
  --shadow-sm: 0px 2px 0px 0px hsl(195 100% 50% / 0.00), 0px 1px 2px -1px hsl(195 100% 50% / 0.00);
  --shadow: 0px 2px 0px 0px hsl(195 100% 50% / 0.00), 0px 1px 2px -1px hsl(195 100% 50% / 0.00);
  --shadow-md: 0px 2px 0px 0px hsl(195 100% 50% / 0.00), 0px 2px 4px -1px hsl(195 100% 50% / 0.00);
  --shadow-lg: 0px 2px 0px 0px hsl(195 100% 50% / 0.00), 0px 4px 6px -1px hsl(195 100% 50% / 0.00);
  --shadow-xl: 0px 2px 0px 0px hsl(195 100% 50% / 0.00), 0px 8px 10px -1px hsl(195 100% 50% / 0.00);
  --shadow-2xl: 0px 2px 0px 0px hsl(195 100% 50% / 0.00);

  --sidebar-primary-border: hsl(var(--sidebar-primary));
  --sidebar-primary-border: hsl(from hsl(var(--sidebar-primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --sidebar-accent-border: hsl(var(--sidebar-accent));
  --sidebar-accent-border: hsl(from hsl(var(--sidebar-accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --primary-border: hsl(var(--primary));
  --primary-border: hsl(from hsl(var(--primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --secondary-border: hsl(var(--secondary));
  --secondary-border: hsl(from hsl(var(--secondary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --muted-border: hsl(var(--muted));
  --muted-border: hsl(from hsl(var(--muted)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --accent-border: hsl(var(--accent));
  --accent-border: hsl(from hsl(var(--accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
  --destructive-border: hsl(var(--destructive));
  --destructive-border: hsl(from hsl(var(--destructive)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply font-sans antialiased bg-background text-foreground;
  }
}

@layer utilities {
  input[type="search"]::-webkit-search-cancel-button {
    @apply hidden;
  }

  [contenteditable][data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: hsl(var(--muted-foreground));
    pointer-events: none;
  }

  .no-default-hover-elevate {}

  .no-default-active-elevate {}

  .toggle-elevate::before,
  .toggle-elevate-2::before {
    content: "";
    pointer-events: none;
    position: absolute;
    inset: 0px;
    border-radius: inherit;
    z-index: -1;
  }

  .toggle-elevate.toggle-elevated::before {
    background-color: var(--elevate-2);
  }

  .border.toggle-elevate::before {
    inset: -1px;
  }

  .hover-elevate:not(.no-default-hover-elevate),
  .active-elevate:not(.no-default-active-elevate),
  .hover-elevate-2:not(.no-default-hover-elevate),
  .active-elevate-2:not(.no-default-active-elevate) {
    position: relative;
    z-index: 0;
  }

  .hover-elevate:not(.no-default-hover-elevate)::after,
  .active-elevate:not(.no-default-active-elevate)::after,
  .hover-elevate-2:not(.no-default-hover-elevate)::after,
  .active-elevate-2:not(.no-default-active-elevate)::after {
    content: "";
    pointer-events: none;
    position: absolute;
    inset: 0px;
    border-radius: inherit;
    z-index: 999;
  }

  .hover-elevate:hover:not(.no-default-hover-elevate)::after,
  .active-elevate:active:not(.no-default-active-elevate)::after {
    background-color: var(--elevate-1);
  }

  .hover-elevate-2:hover:not(.no-default-hover-elevate)::after,
  .active-elevate-2:active:not(.no-default-active-elevate)::after {
    background-color: var(--elevate-2);
  }

  .border.hover-elevate:not(.no-hover-interaction-elevate)::after,
  .border.active-elevate:not(.no-active-interaction-elevate)::after,
  .border.hover-elevate-2:not(.no-hover-interaction-elevate)::after,
  .border.active-elevate-2:not(.no-active-interaction-elevate)::after,
  .border.hover-elevate:not(.no-hover-interaction-elevate)::after {
    inset: -1px;
  }

  .glow-cyan {
    box-shadow: 0 0 15px hsl(195 100% 50% / 0.15), 0 0 30px hsl(195 100% 50% / 0.08);
  }

  .glow-cyan-strong {
    box-shadow: 0 0 20px hsl(195 100% 50% / 0.25), 0 0 40px hsl(195 100% 50% / 0.12);
  }

  .glow-purple {
    box-shadow: 0 0 15px hsl(260 60% 60% / 0.15), 0 0 30px hsl(260 60% 60% / 0.08);
  }

  .speaking-ring {
    box-shadow: 0 0 0 3px hsl(160 70% 50% / 0.6), 0 0 15px hsl(160 70% 50% / 0.3);
  }

  @keyframes pulse-glow {

    0%,
    100% {
      opacity: 0.4;
    }

    50% {
      opacity: 1;
    }
  }

  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes sound-wave {
    0%, 100% {
      transform: scaleY(0.12);
      opacity: 0.5;
    }
    30% {
      transform: scaleY(0.75);
      opacity: 0.85;
    }
    60% {
      transform: scaleY(1);
      opacity: 1;
    }
    80% {
      transform: scaleY(0.45);
      opacity: 0.7;
    }
  }

  .animate-sound-wave {
    animation: sound-wave 0.65s ease-in-out infinite;
    transform-origin: center;
  }

  @keyframes pulse-ring {

    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(var(--primary), 0.4);
    }

    50% {
      box-shadow: 0 0 0 6px rgba(var(--primary), 0);
    }
  }

  .animate-pulse-ring {
    animation: pulse-ring 1.5s ease-in-out infinite;
  }

  .speaking-waves {
    animation: speaking-wave 1.2s ease-in-out infinite;
  }

  @keyframes speaking-wave {
    0% {
      box-shadow: 0 0 0 0 hsl(var(--primary) / 0.5), 0 0 0 0 hsl(var(--primary) / 0.3);
    }

    50% {
      box-shadow: 0 0 0 8px hsl(var(--primary) / 0), 0 0 0 16px hsl(var(--primary) / 0);
    }

    100% {
      box-shadow: 0 0 0 8px hsl(var(--primary) / 0), 0 0 0 16px hsl(var(--primary) / 0);
    }
  }
}