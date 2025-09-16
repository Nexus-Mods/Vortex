// Semantic color tokens from Figma design system
// These colors are contextual and adapt to light/dark themes

export const semanticColors = {
  // Surface colors - for backgrounds and containers
  surface: {
    base: {
      light: 'tw:bg-[#d4d4d8] tw:text-[#1d1d21]',
      dark: 'tw:bg-[#0f0f10] tw:text-[#f4f4f5]'
    },
    low: {
      light: 'tw:bg-[#e4e4e7] tw:text-[#1d1d21]',
      dark: 'tw:bg-[#1d1d21] tw:text-[#f4f4f5]'
    },
    mid: {
      light: 'tw:bg-[#f4f4f5] tw:text-[#1d1d21]',
      dark: 'tw:bg-[#29292e] tw:text-[#f4f4f5]'
    },
    high: {
      light: 'tw:bg-[#fafafa] tw:text-[#1d1d21]',
      dark: 'tw:bg-[#3e3e47] tw:text-[#f4f4f5]'
    },
    inverted: {
      light: 'tw:bg-[#0f0f10] tw:text-[#fafafa]',
      dark: 'tw:bg-[#fafafa] tw:text-[#0f0f10]'
    }
  },

  // Neutral text colors
  neutral: {
    strong: {
      light: 'tw:text-[#1d1d21]',
      dark: 'tw:text-[#f4f4f5]'
    },
    moderate: {
      light: 'tw:text-[#3e3e47]',
      dark: 'tw:text-[#d4d4d8]'
    },
    weak: {
      light: 'tw:text-[#71717a]',
      dark: 'tw:text-[#71717a]'
    },
    subdued: {
      light: 'tw:text-[#52525b]',
      dark: 'tw:text-[#a1a1aa]'
    },
    inverted: {
      light: 'tw:text-[#fafafa]',
      dark: 'tw:text-[#0f0f10]'
    }
  },

  // Status colors - Success, Info, Warning, Danger
  success: {
    weak: {
      light: 'tw:text-[#86efac] tw:bg-[#86efac]',
      dark: 'tw:text-[#166534] tw:bg-[#166534]'
    },
    subdued: {
      light: 'tw:text-[#22c55e] tw:bg-[#22c55e]',
      dark: 'tw:text-[#16a34a] tw:bg-[#16a34a]'
    },
    moderate: {
      light: 'tw:text-[#15803d] tw:bg-[#15803d]',
      dark: 'tw:text-[#22c55e] tw:bg-[#22c55e]'
    },
    strong: {
      light: 'tw:text-[#166534] tw:bg-[#166534]',
      dark: 'tw:text-[#86efac] tw:bg-[#86efac]'
    }
  },

  info: {
    weak: {
      light: 'tw:text-[#93c5fd] tw:bg-[#93c5fd]',
      dark: 'tw:text-[#1d4ed8] tw:bg-[#1d4ed8]'
    },
    subdued: {
      light: 'tw:text-[#60a5fa] tw:bg-[#60a5fa]',
      dark: 'tw:text-[#3b82f6] tw:bg-[#3b82f6]'
    },
    moderate: {
      light: 'tw:text-[#3b82f6] tw:bg-[#3b82f6]',
      dark: 'tw:text-[#60a5fa] tw:bg-[#60a5fa]'
    },
    strong: {
      light: 'tw:text-[#1d4ed8] tw:bg-[#1d4ed8]',
      dark: 'tw:text-[#93c5fd] tw:bg-[#93c5fd]'
    }
  },

  warning: {
    weak: {
      light: 'tw:text-[#eab308] tw:bg-[#eab308]',
      dark: 'tw:text-[#ca8a04] tw:bg-[#ca8a04]'
    },
    subdued: {
      light: 'tw:text-[#ca8a04] tw:bg-[#ca8a04]',
      dark: 'tw:text-[#facc15] tw:bg-[#facc15]'
    },
    moderate: {
      light: 'tw:text-[#854d0e] tw:bg-[#854d0e]',
      dark: 'tw:text-[#fde047] tw:bg-[#fde047]'
    },
    strong: {
      light: 'tw:text-[#422006] tw:bg-[#422006]',
      dark: 'tw:text-[#fef08a] tw:bg-[#fef08a]'
    }
  },

  danger: {
    weak: {
      light: 'tw:text-[#f87171] tw:bg-[#f87171]',
      dark: 'tw:text-[#991b1b] tw:bg-[#991b1b]'
    },
    subdued: {
      light: 'tw:text-[#ef4444] tw:bg-[#ef4444]',
      dark: 'tw:text-[#dc2626] tw:bg-[#dc2626]'
    },
    moderate: {
      light: 'tw:text-[#dc2626] tw:bg-[#dc2626]',
      dark: 'tw:text-[#ef4444] tw:bg-[#ef4444]'
    },
    strong: {
      light: 'tw:text-[#991b1b] tw:bg-[#991b1b]',
      dark: 'tw:text-[#f87171] tw:bg-[#f87171]'
    }
  },

  // Primary brand colors
  primary: {
    weak: {
      light: 'tw:text-[#c2410c] tw:bg-[#c2410c]',
      dark: 'tw:text-[#c2410c] tw:bg-[#c2410c]'
    },
    subdued: {
      light: 'tw:text-[#f97316] tw:bg-[#f97316]',
      dark: 'tw:text-[#f97316] tw:bg-[#f97316]'
    },
    moderate: {
      light: 'tw:text-[#fb923c] tw:bg-[#fb923c]',
      dark: 'tw:text-[#fb923c] tw:bg-[#fb923c]'
    },
    strong: {
      light: 'tw:text-[#fdba74] tw:bg-[#fdba74]',
      dark: 'tw:text-[#fdba74] tw:bg-[#fdba74]'
    }
  },

  // Border/stroke colors
  stroke: {
    neutralTranslucent: {
      weak: {
        light: 'tw:border-[#00000033]',
        dark: 'tw:border-[#ffffff19]'
      },
      subdued: {
        light: 'tw:border-[#00000033]',
        dark: 'tw:border-[#ffffff33]'
      },
      moderate: {
        light: 'tw:border-[#0000004c]',
        dark: 'tw:border-[#ffffff4c]'
      },
      strong: {
        light: 'tw:border-[#ffffff]',
        dark: 'tw:border-[#ffffff99]'
      }
    }
  },

  // Focus states
  focus: {
    subdued: {
      light: 'tw:ring-[#60a5fa] tw:ring-2',
      dark: 'tw:ring-[#3b82f6] tw:ring-2'
    }
  },

  // Translucent overlays
  translucent: {
    neutral: {
      weak: {
        light: 'tw:bg-[#0000007f]',
        dark: 'tw:bg-[#ffffff66]'
      },
      subdued: {
        light: 'tw:bg-[#000000b2]',
        dark: 'tw:bg-[#ffffff7f]'
      },
      moderate: {
        light: 'tw:bg-[#000000cc]',
        dark: 'tw:bg-[#ffffffb2]'
      },
      strong: {
        light: 'tw:bg-[#000000f2]',
        dark: 'tw:bg-[#fffffff2]'
      }
    },
    surface: {
      low: {
        light: 'tw:bg-[#ffffff0c]',
        dark: 'tw:bg-[#ffffff0c]'
      },
      mid: {
        light: 'tw:bg-[#ffffff19]',
        dark: 'tw:bg-[#ffffff19]'
      },
      high: {
        light: 'tw:bg-[#ffffff33]',
        dark: 'tw:bg-[#ffffff33]'
      }
    }
  }
} as const;

// Helper functions to get theme-aware colors
export function getSemanticColor(
  category: keyof typeof semanticColors,
  variant: string,
  intensity: string,
  theme: 'light' | 'dark' = 'dark'
): string {
  const colorGroup = semanticColors[category];
  if (!colorGroup || !colorGroup[variant] || !colorGroup[variant][intensity]) {
    return '';
  }
  return colorGroup[variant][intensity][theme] || '';
}

// Simplified semantic color tokens for easy use
export const semanticColorTokens = {
  // Surface tokens
  surfaceBase: 'tw:bg-[#d4d4d8] tw:dark:bg-[#0f0f10] tw:text-[#1d1d21] tw:dark:text-[#f4f4f5]',
  surfaceLow: 'tw:bg-[#e4e4e7] tw:dark:bg-[#1d1d21] tw:text-[#1d1d21] tw:dark:text-[#f4f4f5]',
  surfaceMid: 'tw:bg-[#f4f4f5] tw:dark:bg-[#29292e] tw:text-[#1d1d21] tw:dark:text-[#f4f4f5]',
  surfaceHigh: 'tw:bg-[#fafafa] tw:dark:bg-[#3e3e47] tw:text-[#1d1d21] tw:dark:text-[#f4f4f5]',

  // Text tokens
  textStrong: 'tw:text-[#1d1d21] tw:dark:text-[#f4f4f5]',
  textModerate: 'tw:text-[#3e3e47] tw:dark:text-[#d4d4d8]',
  textWeak: 'tw:text-[#71717a]',
  textSubdued: 'tw:text-[#52525b] tw:dark:text-[#a1a1aa]',

  // Border tokens
  borderWeak: 'tw:border-[#00000033] tw:dark:border-[#ffffff19]',
  borderModerate: 'tw:border-[#0000004c] tw:dark:border-[#ffffff4c]',
  borderStrong: 'tw:border-[#ffffff] tw:dark:border-[#ffffff99]',

  // Status tokens
  successText: 'tw:text-[#15803d] tw:dark:text-[#22c55e]',
  successBg: 'tw:bg-[#15803d] tw:dark:bg-[#22c55e]',
  infoText: 'tw:text-[#3b82f6] tw:dark:text-[#60a5fa]',
  infoBg: 'tw:bg-[#3b82f6] tw:dark:bg-[#60a5fa]',
  warningText: 'tw:text-[#854d0e] tw:dark:text-[#fde047]',
  warningBg: 'tw:bg-[#854d0e] tw:dark:bg-[#fde047]',
  dangerText: 'tw:text-[#dc2626] tw:dark:text-[#ef4444]',
  dangerBg: 'tw:bg-[#dc2626] tw:dark:bg-[#ef4444]',

  // Primary brand
  primaryText: 'tw:text-[#f97316]',
  primaryBg: 'tw:bg-[#f97316]',

  // Focus
  focusRing: 'tw:ring-[#60a5fa] tw:dark:ring-[#3b82f6] tw:ring-2'
} as const;

export type SemanticColorToken = keyof typeof semanticColorTokens;